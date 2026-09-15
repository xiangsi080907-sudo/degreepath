import "dotenv/config";
import { readFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { AcademicData } from "../src/domain/types";
import { importAcademicData } from "../src/ingestion/import";
import snapshot from "../src/data/uw/snapshot.json";
const db = new PrismaClient();
async function main() {
  const manifest: { url: string; name: string; retrievedAt: string }[] =
    JSON.parse(await readFile("tests/fixtures/uw/manifest.json", "utf8"));
  const raw = await Promise.all(
    manifest.map(async (s) => ({
      url: s.url,
      retrievedAt: s.retrievedAt,
      text: await readFile(`tests/fixtures/uw/${s.name}.html`, "utf8"),
    })),
  );
  await importAcademicData(db, snapshot as AcademicData, raw);
  console.log(
    "Imported saved official UW source snapshot. No student accounts seeded.",
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
