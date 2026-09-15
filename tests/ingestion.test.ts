import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  parseCourseCatalog,
  parsePrerequisite,
  parseOfferings,
  parseCSProgram,
  UW_URLS,
} from "../src/ingestion/uw";
const html = readFileSync("tests/fixtures/uw/cse.html", "utf8");
const courses = parseCourseCatalog(
  html,
  "CSE",
  UW_URLS.cse,
  "2026-09-14T05:35:52Z",
);
describe("official UW fixture parsers", () => {
  it("retains nonempty descriptions and prerequisite text", () => {
    const c = courses.find((c) => c.id === "CSE 311")!;
    expect(c.description).toContain("logic");
    expect(c.rawPrerequisite).toContain("minimum grade of 2.0");
    expect(c.prerequisite.type).toBe("AND");
  });
  it("recommended preparation does not block CSE 123", () => {
    const c = courses.find((c) => c.id === "CSE 123")!;
    expect(c.prerequisite.type).toBe("TRUE");
    expect(c.recommended).toContain("CSE 122");
  });
  it("retains unsupported AP alternatives", () => {
    const math = parseCourseCatalog(
      readFileSync("tests/fixtures/uw/math.html", "utf8"),
      "MATH",
      UW_URLS.math,
      "2026-09-14T00:00:00Z",
    );
    expect(math.find((c) => c.id === "MATH 125")?.parseStatus).toBe(
      "NEEDS_REVIEW",
    );
  });
  it("credit discrepancy uses actual course catalog value", () => {
    const math = parseCourseCatalog(
      readFileSync("tests/fixtures/uw/math.html", "utf8"),
      "MATH",
      UW_URLS.math,
      "2026-09-14T00:00:00Z",
    );
    expect(math.find((c) => c.id === "MATH 208")?.minCredits).toBe(4);
  });
  it("malformed source cannot become an empty success", () =>
    expect(() =>
      parseCourseCatalog("<html>sign in</html>", "CSE", UW_URLS.cse, ""),
    ).toThrow());
  it("duplicate records fail import parsing", () =>
    expect(() =>
      parseCourseCatalog(html + html, "CSE", UW_URLS.cse, ""),
    ).toThrow("Duplicate"));
  it("missing description requires review", () =>
    expect(courses.find((c) => c.id === "CSE 190")?.parseStatus).toBe(
      "NEEDS_REVIEW",
    ));
  it("does not partially parse unknown tails", () =>
    expect(parsePrerequisite("CSE 123 or instructor permission").status).toBe(
      "NEEDS_REVIEW",
    ));
  it("does not flatten mixed unparenthesized AND/OR", () =>
    expect(parsePrerequisite("CSE 123 and CSE 311 or CSE 143").status).toBe(
      "NEEDS_REVIEW",
    ));
  it("public course offerings parse and deduplicate", () => {
    const offerings = parseOfferings(
      readFileSync("tests/fixtures/uw/offerings.html", "utf8"),
      { year: 2026, season: "Autumn" },
      "https://www.washington.edu/students/timeschd/pub/AUT2026/cse.html",
    );
    expect(offerings.some((o) => o.courseId === "CSE 311")).toBe(true);
    expect(new Set(offerings.map((o) => o.courseId)).size).toBe(
      offerings.length,
    );
  });
  it("wrong quarter fails", () =>
    expect(() =>
      parseOfferings(
        readFileSync("tests/fixtures/uw/offerings.html", "utf8"),
        { year: 2027, season: "Spring" },
        "",
      ),
    ).toThrow());
  it("program marked partial, no invented full degree", () => {
    const p = parseCSProgram(
      readFileSync("tests/fixtures/uw/cs-program.html", "utf8"),
      "2026-09-14T00:00:00Z",
    );
    expect(p.status).toBe("NEEDS_REVIEW");
    expect(
      p.requirements.children?.some((r) => r.type === "MANUAL_REVIEW"),
    ).toBe(true);
  });
});

import snapshot from "../src/data/uw/snapshot.json";
import { AcademicData } from "../src/domain/types";
import { demoState } from "../src/data/demo";
import { generatePlan } from "../src/domain/planner";
it("demo does not schedule redundant prerequisite alternatives", () => {
  const data = snapshot as AcademicData;
  const plan = generatePlan(
    data,
    data.programs[0],
    { courses: demoState.courses, programs: demoState.programs },
    demoState.preferences,
  );
  const ids = plan.terms.flatMap((t) => t.courseIds);
  expect(ids).not.toContain("CSE 142");
  expect(ids).not.toContain("MATH 134");
  expect(ids).toContain("CSE 311");
});
it("changed requirement text fails rather than reusing old course rules", () => {
  const html = readFileSync("tests/fixtures/uw/cs-program.html", "utf8");
  expect(() =>
    parseCSProgram(
      html.replace("CSE 351. Minimum 2.0", "CSE 351, CSE 333. Minimum 2.0"),
      "2026-09-14T00:00:00Z",
    ),
  ).toThrow();
});
