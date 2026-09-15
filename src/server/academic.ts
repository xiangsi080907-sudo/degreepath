import { AcademicData, Course, Program, Requirement } from "../domain/types";
import snapshot from "../data/uw/snapshot.json";
import { db } from "./db";
export const demoData = snapshot as AcademicData;
export async function getAcademicData(): Promise<AcademicData> {
  const campus = await db.campus.findUnique({
    where: { id: "uw-seattle" },
    include: {
      institution: true,
      courses: {
        include: {
          attributes: true,
          prerequisite: true,
          offerings: { include: { term: true } },
        },
      },
      programs: {
        include: {
          catalogs: { include: { catalogVersion: true, requirements: true } },
        },
      },
    },
  });
  if (!campus)
    return {
      ...demoData,
      courses: [],
      offerings: [],
      programs: [],
      sources: [],
    };
  const courses: Course[] = campus.courses.map((c) => ({
    id: c.id,
    subject: c.subject,
    number: c.number,
    title: c.title,
    description: c.description,
    minCredits: c.minCredits,
    maxCredits: c.maxCredits,
    attributes: c.attributes.map((a) => a.attribute),
    prerequisite: (c.prerequisite?.normalizedRule ?? {
      type: "RAW_UNSUPPORTED",
      text: "No rule imported",
    }) as Course["prerequisite"],
    rawPrerequisite: c.prerequisite?.rawText ?? "",
    parseStatus: c.prerequisite?.parseStatus ?? "UNSUPPORTED",
    sourceUrl: c.sourceUrl,
    retrievedAt: c.sourceUpdatedAt.toISOString(),
    recommended: c.recommended,
    offeringPattern: c.offeringPattern,
    overlaps: c.overlaps,
    restrictions: c.restrictions ?? undefined,
  }));
  const programs: Program[] = campus.programs
    .flatMap((p) =>
      p.catalogs.map((c) => ({
        id: p.id,
        name: p.name,
        degreeType: p.degreeType,
        catalogId: c.catalogVersionId,
        catalogLabel: c.catalogVersion.label,
        sourceUrl: c.sourceUrl,
        retrievedAt: c.retrievedAt.toISOString(),
        status: c.status,
        requirements: c.requirements.find((r) => !r.parentId)
          ?.normalizedRule as unknown as Requirement,
      })),
    )
    .filter((p) => p.requirements);
  const snapshots = await db.sourceSnapshot.findMany({
    orderBy: { retrievedAt: "desc" },
    distinct: ["sourceUrl"],
    take: 20,
  });
  const imports = await db.importRun.findMany({
    orderBy: { startedAt: "desc" },
    take: 12,
  });
  return {
    importHistory: imports.map((r) => ({
      source: r.source,
      status: r.status,
      startedAt: r.startedAt.toISOString(),
      completedAt: r.completedAt?.toISOString(),
      recordsProcessed: r.recordsProcessed,
    })),
    institution: { id: campus.institution.id, name: campus.institution.name },
    campus: {
      id: campus.id,
      name: campus.name,
      calendar: campus.calendar as AcademicData["campus"]["calendar"],
    },
    courses,
    programs,
    offeringCoverage: snapshots
      .filter((s) => s.sourceUrl.includes("/timeschd/pub/AUT2026/cse.html"))
      .map((s) => ({
        term: { year: 2026, season: "Autumn" },
        subject: "CSE",
        sourceUrl: s.sourceUrl,
      })),
    offerings: campus.courses.flatMap((c) =>
      c.offerings.map((o) => ({
        courseId: c.id,
        term: { year: o.term.year, season: o.term.termType },
        status: o.status,
        sourceUrl: o.sourceUrl,
      })),
    ),
    sources: snapshots.map((s) => ({
      name:
        demoData.sources.find((x) => x.url === s.sourceUrl)?.name ??
        "Official source",
      url: s.sourceUrl,
      retrievedAt: s.retrievedAt.toISOString(),
      status: s.status,
      notes: s.notes,
    })),
  };
}
