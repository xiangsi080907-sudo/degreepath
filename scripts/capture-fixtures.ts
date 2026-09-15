import { mkdir, writeFile } from "node:fs/promises";
import { PoliteFetcher } from "../src/ingestion/adapter";
import { UW_URLS } from "../src/ingestion/uw";
async function main() {
  const fetcher = new PoliteFetcher();
  const manifest = [];
  await mkdir("tests/fixtures/uw", { recursive: true });
  const urls = {
    cse: UW_URLS.cse,
    math: UW_URLS.math,
    offerings:
      "https://www.washington.edu/students/timeschd/pub/AUT2026/cse.html",
    programs: UW_URLS.programs,
    lists: UW_URLS.lists,
    "cs-program": UW_URLS.program,
  };
  for (const [name, url] of Object.entries(urls)) {
    const html = await fetcher.fetch(url);
    await writeFile(`tests/fixtures/uw/${name}.html`, html);
    manifest.push({ name, url, retrievedAt: new Date().toISOString() });
  }
  await writeFile(
    "tests/fixtures/uw/manifest.json",
    JSON.stringify(manifest, null, 2),
  );
  console.log(
    "Saved official source fixtures. Review before normalizing the demo dataset.",
  );
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
