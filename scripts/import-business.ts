import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { importAcademicData } from "../src/ingestion/import";
import business from "../src/data/uw/business.json";
import snapshot from "../src/data/uw/snapshot.json";
import type { AcademicData } from "../src/domain/types";

async function main() {
  const db = new PrismaClient();
  try {
    const manifest: { name: string; url: string; retrievedAt: string }[] =
      JSON.parse(
        await readFile("tests/fixtures/uw/business/manifest.json", "utf8"),
      );
    const raw = await Promise.all(
      manifest.map(async (s) => ({
        ...s,
        text: await readFile(
          `tests/fixtures/uw/business/${s.name}.html`,
          "utf8",
        ),
      })),
    );
    // Import only new Business records. Do not refresh CS courses, offerings, or student data.
    const data = {
      ...snapshot,
      ...business,
      offerings: [],
      offeringCoverage: [],
    } as AcademicData;
    await importAcademicData(db, data, raw);
    console.log(
      "Business shared core imported. Existing student records and plans preserved.",
    );
  } finally {
    await db.$disconnect();
  }
}
main().catch(() => {
  console.error(
    "Business import failed. Check the target database and import status; no credentials are logged.",
  );
  process.exitCode = 1;
});
