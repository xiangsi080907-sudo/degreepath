import { Prisma } from "@prisma/client";
import { db } from "./db";
import { StudentState, stateSchema, programKeySchema } from "./validation";
import { getAcademicData } from "./academic";
import { PublicRequestError } from "./http";
import { StudentCourse } from "../domain/types";
export const defaultPreferences = {
  start: { year: 2026, season: "Autumn" },
  minCredits: 8,
  maxCredits: 16,
  includeSummer: false,
  workload: "balanced" as const,
  unavailable: [],
};
export function studentStateKey(state: StudentState): string {
  const sorted = {
    ...state,
    courses: [...state.courses].sort((a, b) =>
      a.courseId.localeCompare(b.courseId),
    ),
  };
  const canonical = (value: unknown): unknown =>
    Array.isArray(value)
      ? value.map(canonical)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.entries(value)
              .filter(([, v]) => v !== undefined)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([k, v]) => [k, canonical(v)]),
          )
        : value;
  return JSON.stringify(canonical(sorted));
}
export async function readStudent(userId: string) {
  const [profile, courses, plans] = await Promise.all([
    db.studentProfile.findUnique({ where: { userId } }),
    db.studentCourse.findMany({ where: { userId } }),
    db.savedPlan.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        name: true,
        result: true,
        config: true,
        createdAt: true,
      },
    }),
  ]);
  const state = {
    programCatalogId:
      profile?.programCatalogId ?? "uw-seattle-cs:uw-seattle-current-2026-09",
    courses: courses.map((c) => ({
      courseId: c.courseId,
      status: c.status,
      grade: c.grade ?? undefined,
      credits: c.credits ?? undefined,
      term: (c.term ?? undefined) as StudentCourse["term"],
    })),
    preferences: (profile?.preferences ??
      defaultPreferences) as StudentState["preferences"],
    programs: profile?.programStatuses ?? [],
  };
  const draft = profile?.draftPlans as unknown as
    { state?: StudentState; plans?: unknown[] } | undefined;
  return {
    state,
    onboarded: !!profile,
    draftPlans:
      draft?.state && studentStateKey(draft.state) === studentStateKey(state)
        ? (draft.plans ?? [])
        : [],
    plans,
  };
}
export async function saveStudent(userId: string, input: unknown) {
  const state = stateSchema.parse(input);
  const data = await getAcademicData();
  if (
    !data.campus.calendar.seasons.includes(state.preferences.start.season) ||
    (state.preferences.target &&
      !data.campus.calendar.seasons.includes(
        state.preferences.target.season,
      )) ||
    state.courses.some(
      (c) => c.term && !data.campus.calendar.seasons.includes(c.term.season),
    )
  )
    throw new PublicRequestError("Invalid term for this campus");
  const program = data.programs.find(
    (p) => `${p.id}:${p.catalogId}` === state.programCatalogId,
  );
  if (!program)
    throw new PublicRequestError(
      "Unsupported program/catalog; run the official data import first",
    );
  for (const row of state.courses) {
    const c = data.courses.find((c) => c.id === row.courseId);
    if (!c) throw new PublicRequestError("Unknown course");
    if (
      row.credits !== undefined &&
      (row.credits < c.minCredits || row.credits > c.maxCredits)
    )
      throw new PublicRequestError("Credits outside official course range");
  }
  await db.$transaction(async (tx) => {
    await tx.studentProfile.upsert({
      where: { userId },
      create: {
        userId,
        campusId: data.campus.id,
        programCatalogId: state.programCatalogId,
        preferences: state.preferences as Prisma.InputJsonValue,
        programStatuses: state.programs,
      },
      update: {
        programCatalogId: state.programCatalogId,
        preferences: state.preferences as Prisma.InputJsonValue,
        programStatuses: state.programs,
      },
    });
    await tx.studentCourse.deleteMany({ where: { userId } });
    await tx.studentCourse.createMany({
      data: state.courses.map((c) => ({
        ...c,
        userId,
        term: c.term as Prisma.InputJsonValue | undefined,
      })),
    });
  });
  return state;
}
export async function readSavedPlan(userId: string, id: string) {
  return db.savedPlan.findFirst({ where: { id, userId } });
}
export async function deleteSavedPlan(userId: string, id: string) {
  return db.savedPlan.deleteMany({ where: { id, userId } });
}

export async function switchMajor(userId: string, input: unknown) {
  const key = programKeySchema.parse(input);
  const catalog = await db.programCatalog.findUnique({ where: { id: key } });
  if (!catalog)
    throw new PublicRequestError(
      "This major's academic data has not been imported yet.",
    );
  // Only active curriculum/drafts change. Academic history and saved plans are untouched.
  await db.studentProfile.update({
    where: { userId },
    data: { programCatalogId: key, draftPlans: Prisma.DbNull },
  });
  return { programCatalogId: key };
}
