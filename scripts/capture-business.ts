import { mkdir, writeFile } from "node:fs/promises";
import { PoliteFetcher } from "../src/ingestion/adapter";

async function main() {
  const fetcher = new PoliteFetcher();
  const base = "tests/fixtures/uw/business";
  await mkdir(base, { recursive: true });
  const sources = [
    [
      "program",
      "https://www.washington.edu/students/gencat/program/S/Business-300.html",
    ],
    ...[
      "acctg",
      "econ",
      "finance",
      "infosys",
      "intlbus",
      "mgmt",
      "mktg",
      "opmgmt",
      "qmeth",
      "busecon",
    ].map((name) => [
      name,
      `https://www.washington.edu/students/crscat/${name}.html`,
    ]),
  ];
  const manifest = [];
  for (const [name, url] of sources) {
    const html = await fetcher.fetch(url);
    await writeFile(`${base}/${name}.html`, html);
    manifest.push({ name, url, retrievedAt: new Date().toISOString() });
    console.log(`Captured official ${name} source`);
  }
  await writeFile(`${base}/manifest.json`, JSON.stringify(manifest, null, 2));
}
main().catch(() => {
  console.error(
    "Business source capture failed; no database writes performed.",
  );
  process.exitCode = 1;
});
