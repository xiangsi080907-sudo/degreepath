import "dotenv/config";
import { createHash } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { PoliteFetcher } from "../src/ingestion/adapter";
import { assembleUW, UW_URLS } from "../src/ingestion/uw";
import { importAcademicData, RawSnapshot } from "../src/ingestion/import";
const db = new PrismaClient();
async function main() {
  const f = new PoliteFetcher();
  const raw: RawSnapshot[] = [];
  const fetch = async (url: string) => {
    const text = await f.fetch(url);
    raw.push({ url, text, retrievedAt: new Date().toISOString() });
    return text;
  };
  try {
    const cse = await fetch(UW_URLS.cse);
    const math = await fetch(UW_URLS.math);
    const offerings = await fetch(
      "https://www.washington.edu/students/timeschd/pub/AUT2026/cse.html",
    );
    const program = await fetch(UW_URLS.program);
    const data = assembleUW({
      cse,
      math,
      offerings,
      program,
      retrievedAt: new Date().toISOString(),
    });
    await importAcademicData(db, data, raw);
    console.log(
      `Imported ${data.courses.length} courses, ${data.offerings.length} offerings. Program review still required.`,
    );
  } catch (e) {
    // Preserve rejected fetch evidence separately; never replace accepted academic rows.
    await db.sourceSnapshot.createMany({
      data: raw.map((s) => ({
        sourceUrl: s.url,
        checksum: createHash("sha256").update(s.text).digest("hex"),
        rawText: s.text,
        retrievedAt: new Date(s.retrievedAt),
        status: "NEEDS_REVIEW",
        notes:
          "REJECTED: refresh failed; previous academic records remain active.",
      })),
      skipDuplicates: true,
    });

    await db.importRun.create({
      data: {
        source: "UW fetch/parse",
        status: "FAILED",
        completedAt: new Date(),
        errors: {
          message: e instanceof Error ? e.message : "Import failed",
          sources: raw.map((s) => s.url),
        },
      },
    });
    throw e;
  }
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
