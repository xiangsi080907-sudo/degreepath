import { readFile, writeFile } from "node:fs/promises";
import { assembleUW } from "../src/ingestion/uw";
const base = "tests/fixtures/uw/";
async function main() {
  const manifest: { name: string; retrievedAt: string }[] = JSON.parse(
    await readFile(base + "manifest.json", "utf8"),
  );
  const sourceDates = Object.fromEntries(
    manifest.map((s) => [s.name, s.retrievedAt]),
  );
  const [cse, math, offerings, program] = await Promise.all(
    ["cse", "math", "offerings", "cs-program"].map((n) =>
      readFile(base + n + ".html", "utf8"),
    ),
  );
  const data = assembleUW({
    cse,
    math,
    offerings,
    program,
    retrievedAt: manifest[0].retrievedAt,
    sourceDates,
  });
  await writeFile("src/data/uw/snapshot.json", JSON.stringify(data, null, 2));
  console.log({
    courses: data.courses.length,
    offerings: data.offerings.length,
    review: data.courses.filter((c) => c.parseStatus === "NEEDS_REVIEW").length,
  });
}
main();
