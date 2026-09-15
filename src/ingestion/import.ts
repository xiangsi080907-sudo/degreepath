import { Prisma, PrismaClient } from "@prisma/client";
import { createHash } from "node:crypto";
import { AcademicData, Requirement } from "../domain/types";
export type RawSnapshot = { url: string; text: string; retrievedAt: string };
export async function importAcademicData(
  db: PrismaClient,
  data: AcademicData,
  raw: RawSnapshot[],
) {
  const run = await db.importRun.create({
    data: { source: "UW Seattle", status: "RUNNING" },
  });
  try {
    if (
      !data.courses.length ||
      new Set(data.courses.map((c) => c.id)).size !== data.courses.length
    )
      throw Error("Empty or duplicate catalog");
    if (
      data.courses.some(
        (c) =>
          (!c.description && c.parseStatus !== "NEEDS_REVIEW") ||
          c.minCredits < 0 ||
          c.maxCredits < c.minCredits,
      )
    )
      throw Error("Invalid catalog record");
    await db.$transaction(
      async (tx) => {
        await tx.institution.upsert({
          where: { id: data.institution.id },
          create: { ...data.institution, slug: data.institution.id },
          update: { name: data.institution.name },
        });
        await tx.campus.upsert({
          where: { id: data.campus.id },
          create: {
            id: data.campus.id,
            name: data.campus.name,
            institutionId: data.institution.id,
            calendar: data.campus.calendar,
          },
          update: { calendar: data.campus.calendar },
        });
        for (const subject of new Set(data.courses.map((c) => c.subject))) {
          const id = `${data.campus.id}:${subject}`;
          await tx.department.upsert({
            where: { id },
            create: {
              id,
              campusId: data.campus.id,
              code: subject,
              name: subject,
            },
            update: {},
          });
        }
        for (const c of data.courses) {
          const row = {
            campusId: data.campus.id,
            departmentId: `${data.campus.id}:${c.subject}`,
            subject: c.subject,
            number: c.number,
            title: c.title,
            description: c.description,
            minCredits: c.minCredits,
            maxCredits: c.maxCredits,
            recommended: c.recommended,
            offeringPattern: c.offeringPattern,
            overlaps: c.overlaps,
            restrictions: c.restrictions ?? null,
            sourceUrl: c.sourceUrl,
            sourceUpdatedAt: new Date(c.retrievedAt),
          };
          await tx.course.upsert({
            where: { id: c.id },
            create: { id: c.id, ...row },
            update: row,
          });
          await tx.courseAttribute.deleteMany({ where: { courseId: c.id } });
          await tx.courseAttribute.createMany({
            data: c.attributes.map((attribute) => ({
              courseId: c.id,
              attribute,
            })),
            skipDuplicates: true,
          });
          const rule = {
            rawText: c.rawPrerequisite,
            normalizedRule: c.prerequisite as Prisma.InputJsonValue,
            parseStatus: c.parseStatus,
            sourceUrl: c.sourceUrl,
            retrievedAt: new Date(c.retrievedAt),
          };
          await tx.prerequisiteRule.upsert({
            where: { courseId: c.id },
            create: { courseId: c.id, ...rule },
            update: rule,
          });
        }
        // Replace only the successfully fetched term/subject offering set, inside this transaction.
        const scopes = new Map(
          data.offerings.map((o) => [
            `${o.term.year}:${o.term.season}:${data.courses.find((c) => c.id === o.courseId)?.subject}`,
            o,
          ]),
        );
        for (const o of scopes.values()) {
          const termId = `${data.campus.id}:${o.term.year}:${o.term.season}`;
          await tx.academicTerm.upsert({
            where: { id: termId },
            create: {
              id: termId,
              campusId: data.campus.id,
              year: o.term.year,
              termType: o.term.season,
            },
            update: {},
          });
          await tx.courseOffering.deleteMany({
            where: {
              termId,
              course: {
                subject: data.courses.find((c) => c.id === o.courseId)?.subject,
                campusId: data.campus.id,
              },
            },
          });
        }
        for (const o of data.offerings)
          await tx.courseOffering.create({
            data: {
              courseId: o.courseId,
              termId: `${data.campus.id}:${o.term.year}:${o.term.season}`,
              status: o.status,
              sourceUrl: o.sourceUrl,
              importedAt: new Date(
                data.sources.find((s) => s.url === o.sourceUrl)?.retrievedAt ??
                  data.sources[0].retrievedAt,
              ),
            },
          });
        for (const p of data.programs) {
          await tx.catalogVersion.upsert({
            where: { id: p.catalogId },
            create: {
              id: p.catalogId,
              campusId: data.campus.id,
              label: p.catalogLabel,
            },
            update: { label: p.catalogLabel },
          });
          await tx.program.upsert({
            where: { id: p.id },
            create: {
              id: p.id,
              campusId: data.campus.id,
              name: p.name,
              degreeType: p.degreeType,
            },
            update: { name: p.name },
          });
          const id = `${p.id}:${p.catalogId}`;
          await tx.programCatalog.upsert({
            where: { id },
            create: {
              id,
              programId: p.id,
              catalogVersionId: p.catalogId,
              sourceUrl: p.sourceUrl,
              retrievedAt: new Date(p.retrievedAt),
              status: p.status,
            },
            update: {
              sourceUrl: p.sourceUrl,
              retrievedAt: new Date(p.retrievedAt),
              status: p.status,
            },
          });
          await tx.requirementGroup.deleteMany({
            where: { programCatalogId: id },
          });
          const write = async (r: Requirement, parentId?: string) => {
            await tx.requirementGroup.create({
              data: {
                id: r.id,
                programCatalogId: id,
                parentId,
                title: r.title,
                type: r.type,
                minCredits: r.minCredits,
                chooseCount: r.chooseCount,
                normalizedRule: r as unknown as Prisma.InputJsonValue,
                sourceText: r.rawText,
                sourceUrl: r.sourceUrl,
                parseStatus: r.parseStatus,
                courses: {
                  create: (r.courseIds ?? [])
                    .filter((courseId) =>
                      data.courses.some((c) => c.id === courseId),
                    )
                    .map((courseId) => ({ courseId })),
                },
              },
            });
            for (const child of r.children ?? []) await write(child, r.id);
          };
          await write(p.requirements);
        }
        for (const s of raw) {
          const checksum = createHash("sha256").update(s.text).digest("hex");
          const source = data.sources.find((x) => x.url === s.url);
          await tx.sourceSnapshot.upsert({
            where: { sourceUrl_checksum: { sourceUrl: s.url, checksum } },
            create: {
              sourceUrl: s.url,
              checksum,
              rawText: s.text,
              retrievedAt: new Date(s.retrievedAt),
              status: source?.status ?? "NEEDS_REVIEW",
              notes: source?.notes ?? "Raw source preserved for review",
            },
            update: {
              retrievedAt: new Date(s.retrievedAt),
              status: source?.status ?? "NEEDS_REVIEW",
              notes: source?.notes ?? "Raw source preserved for review",
            },
          });
        }
        await tx.importRun.update({
          where: { id: run.id },
          data: {
            status: "SUCCESS",
            completedAt: new Date(),
            recordsProcessed:
              data.courses.length +
              data.offerings.length +
              data.programs.length,
          },
        });
      },
      { timeout: 60000 },
    );
    return run.id;
  } catch (error) {
    await db.importRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errors: {
          message: error instanceof Error ? error.message : "Import failed",
        },
      },
    });
    throw error;
  }
}
