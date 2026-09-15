import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/server/db";
import { readStudent, readSavedPlan, deleteSavedPlan } from "@/server/student";
import { getAcademicData } from "@/server/academic";
import { termSchema, programKeySchema } from "@/server/validation";
import { prepareEditedPlan } from "@/server/plans";
import { generatePlan } from "@/domain/planner";
import { planningData } from "@/data/majors";
import { sameOrigin, errorResponse, PublicRequestError } from "@/server/http";
export async function GET(req: NextRequest) {
  const userId = (await auth())?.user?.id;
  if (!userId)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  if (!id)
    return NextResponse.json({ error: "Plan id required" }, { status: 400 });
  const plan = await readSavedPlan(userId, id);
  return plan
    ? NextResponse.json(plan)
    : NextResponse.json({ error: "Plan not found" }, { status: 404 });
}
export async function DELETE(req: NextRequest) {
  const userId = (await auth())?.user?.id;
  if (!userId)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    sameOrigin(req);
    const { id } = z
      .object({ id: z.string() })
      .strict()
      .parse(await req.json());
    const result = await deleteSavedPlan(userId, id);
    return NextResponse.json({ deleted: result.count });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: NextRequest) {
  const userId = (await auth())?.user?.id;
  if (!userId)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    sameOrigin(req);
    const { name, workload, terms, programCatalogId } = z
      .object({
        programCatalogId: programKeySchema.optional(),
        terms: z
          .array(
            z
              .object({
                term: termSchema,
                courseIds: z.array(z.string().max(30)).max(12),
              })
              .strict(),
          )
          .max(24)
          .optional(),
        name: z.string().trim().min(1).max(80),
        workload: z.enum(["balanced", "fastest", "light"]),
      })
      .strict()
      .parse(await req.json());
    const { state, onboarded } = await readStudent(userId);
    if (programCatalogId && programCatalogId !== state.programCatalogId)
      throw new PublicRequestError(
        "Your active major changed. Reload before saving this plan.",
        409,
      );
    if (!onboarded) throw new PublicRequestError("Complete setup first");
    const data = await getAcademicData();
    const program = data.programs.find(
      (p) => `${p.id}:${p.catalogId}` === state.programCatalogId,
    );
    if (!program) throw new PublicRequestError("Program no longer supported");
    let plan = generatePlan(
      planningData(data, program.id, state.courses),
      program,
      { courses: state.courses, programs: state.programs },
      { ...state.preferences, workload },
    );
    if (terms)
      plan = prepareEditedPlan(
        plan,
        terms,
        data,
        { courses: state.courses, programs: state.programs },
        state.preferences,
        program,
      );
    const saved = await db.$transaction(async (tx) => {
      const saved = await tx.savedPlan.create({
        data: {
          userId,
          name,
          score: plan.score,
          config: state as unknown as Prisma.InputJsonValue,
          result: plan as unknown as Prisma.InputJsonValue,
        },
      });
      for (const t of plan.terms) {
        const termId = `${data.campus.id}:${t.term.year}:${t.term.season}`;
        await tx.academicTerm.upsert({
          where: { id: termId },
          create: {
            id: termId,
            campusId: data.campus.id,
            year: t.term.year,
            termType: t.term.season,
          },
          update: {},
        });
        await tx.savedPlanTerm.create({
          data: {
            savedPlanId: saved.id,
            academicTermId: termId,
            courses: { create: t.courseIds.map((courseId) => ({ courseId })) },
          },
        });
      }
      return saved;
    });
    return NextResponse.json(saved);
  } catch (e) {
    return errorResponse(e);
  }
}
