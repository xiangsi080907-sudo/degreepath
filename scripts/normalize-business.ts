import { readFile, writeFile } from "node:fs/promises";
import { parseCourseCatalog } from "../src/ingestion/uw";
import {
  BUSINESS_CATALOGS,
  BUSINESS_COURSES,
  parseBusinessProgram,
} from "../src/ingestion/business";
async function main() {
  const base = "tests/fixtures/uw/business/";
  const manifest: { name: string; url: string; retrievedAt: string }[] =
    JSON.parse(await readFile(base + "manifest.json", "utf8"));
  const courses = [];
  for (const [name, subject] of BUSINESS_CATALOGS) {
    const source = manifest.find((s) => s.name === name)!;
    const parsed = parseCourseCatalog(
      await readFile(base + name + ".html", "utf8"),
      subject,
      source.url,
      source.retrievedAt,
      1,
    );
    courses.push(
      ...parsed
        .filter((c) => BUSINESS_COURSES.includes(c.id))
        .map((c) => ({ ...c, sourceUrl: source.url })),
    );
  }
  if (courses.length !== BUSINESS_COURSES.length)
    throw Error("Required Business course missing from official catalog");
  const program = parseBusinessProgram(
    await readFile(base + "program.html", "utf8"),
    manifest.find((s) => s.name === "program")!.retrievedAt,
  );
  const sources = manifest.map((s) => ({
    name:
      s.name === "program"
        ? "UW Business Administration catalog"
        : `UW ${s.name} course catalog`,
    url: s.url,
    retrievedAt: s.retrievedAt,
    status: "PARSED",
    notes:
      "Official source; selected shared-core courses imported. No Business offering data. Unsupported prerequisites remain under review.",
  }));
  await writeFile(
    "src/data/uw/business.json",
    JSON.stringify({ courses, programs: [program], sources }, null, 2),
  );
  console.log(
    `${courses.length} official Business/foundation courses normalized; no offerings inferred.`,
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
