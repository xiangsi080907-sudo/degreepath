import { load } from "cheerio";
import {
  AcademicData,
  Course,
  Offering,
  Program,
  Requirement,
  Rule,
  Term,
} from "../domain/types";
export const UW_URLS = {
  cse: "https://www.washington.edu/students/crscat/cse.html",
  math: "https://www.washington.edu/students/crscat/math.html",
  program:
    "https://www.washington.edu/students/gencat/program/S/ComputerScience-210.html",
  lists:
    "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/courses/",
  programs:
    "https://www.cs.washington.edu/academics/undergraduate/degree-requirements/",
};
export function parsePrerequisite(raw: string): {
  rule: Rule;
  status: Course["parseStatus"];
} {
  if (!raw.trim()) return { rule: { type: "TRUE" }, status: "PARSED" };
  const unsupported = () => ({
    rule: { type: "RAW_UNSUPPORTED" as const, text: raw },
    status: "NEEDS_REVIEW" as const,
  });
  // Only parse a closed grammar. Unconsumed text invalidates the entire parse.
  function clause(text: string): Rule | null {
    let s = text
      .trim()
      .replace(/^and\s+/i, "")
      .replace(/\.$/, "");
    const grade = s.match(/^(?:a )?minimum grade of (\d\.\d) in /i);
    if (grade) s = s.slice(grade[0].length);
    s = s.replace(/^either\s+/i, "");
    const ids = s.match(/[A-Z][A-Z &]* \d{3}/g) ?? [];
    if (!ids.length) return null;
    const residue = s
      .replace(/[A-Z][A-Z &]* \d{3}/g, "")
      .replace(/\b(?:and|or)\b|[,\s]/g, "");
    if (residue) return null;
    const hasAnd = /\band\b/.test(s),
      hasOr = /\bor\b/.test(s);
    if (hasAnd && hasOr) return null;
    const rules: Rule[] = ids.map((course) =>
      grade
        ? { type: "MIN_GRADE", course, grade: Number(grade[1]) }
        : { type: "COURSE_COMPLETED", course },
    );
    return rules.length === 1
      ? rules[0]
      : { type: hasOr ? "OR" : "AND", rules };
  }
  const parts = raw.split(";").map(clause);
  if (parts.some((p) => p === null)) return unsupported();
  return {
    rule:
      parts.length === 1 ? parts[0]! : { type: "AND", rules: parts as Rule[] },
    status: "PARSED",
  };
}
export function parseCourseCatalog(
  html: string,
  subject: string,
  sourceUrl: string,
  retrievedAt: string,
): Course[] {
  const $ = load(html);
  const courses: Course[] = [];
  $("p").each((_, el) => {
    const p = $(el),
      header = p.find("b").first().text().replace(/\s+/g, " ").trim();
    const m = header.match(
      /^([A-Z][A-Z &]*) (\d{3}) (.+?) \((\d+)(?:-(\d+))?(?:, max\. \d+)?\)(.*)$/,
    );
    if (!m || m[1] !== subject || Number(m[2]) >= 500) return;
    const clone = p.clone();
    clone.find("b,a[href]").remove();
    const description = clone.text().replace(/\s+/g, " ").trim();
    const rawPrerequisite = (
      description.match(
        /Prerequisite:\s*([\s\S]*?)(?=\s*(?:Recommended:|Offered:)|$)/i,
      )?.[1] ?? ""
    )
      .replace(/;\s*$/, "")
      .trim();
    const parsed = description
      ? parsePrerequisite(rawPrerequisite)
      : {
          rule: {
            type: "RAW_UNSUPPORTED" as const,
            text: "Catalog description is absent; review required",
          },
          status: "NEEDS_REVIEW" as const,
        };
    const recommended = (
      description.match(/Recommended:\s*(.*?)(?=Offered:|$)/i)?.[1] ?? ""
    ).trim();
    const offeringPattern = (
      description.match(/Offered:\s*(.*)$/)?.[1] ?? ""
    ).trim();
    const overlaps =
      (
        description.match(/Course overlaps with:\s*(.*?)(?=\.\s|$)/)?.[1] ?? ""
      ).match(/[A-Z][A-Z &]* \d{3}/g) ?? [];
    const restrictions = description.match(
      /(?:Cannot be taken for credit[^.]*\.|Course awarded based on[^.]*\.|Credit\/no-credit only\.)/i,
    )?.[0];
    courses.push({
      id: `${subject} ${m[2]}`,
      subject,
      number: m[2],
      title: m[3],
      minCredits: Number(m[4]),
      maxCredits: Number(m[5] ?? m[4]),
      attributes: m[6]
        .trim()
        .split(/[,/]/)
        .map((s) => s.trim())
        .filter(Boolean),
      description,
      rawPrerequisite,
      prerequisite: parsed.rule,
      parseStatus: parsed.status,
      recommended,
      offeringPattern,
      sourceUrl: `${sourceUrl}#${subject.toLowerCase()}${m[2]}`,
      retrievedAt,
      overlaps,
      restrictions,
    });
  });
  if (courses.length < 5)
    throw Error(`Catalog format changed or empty: ${sourceUrl}`);
  const seen = new Set<string>();
  for (const c of courses) {
    if (seen.has(c.id)) throw Error(`Duplicate course ${c.id}`);
    seen.add(c.id);
  }
  return courses;
}
export function parseOfferings(
  html: string,
  term: Term,
  sourceUrl: string,
): Offering[] {
  const $ = load(html);
  if (
    !$("h1")
      .text()
      .includes(`${term.season} Quarter ${term.year} Course Offerings`)
  )
    throw Error("Unexpected offering term or page");
  const ids = new Set<string>();
  $("a[name]").each((_, el) => {
    const code = $(el)
      .attr("name")
      ?.match(/^([a-z]+)(\d{3})$/);
    if (code) ids.add(`${code[1].toUpperCase()} ${code[2]}`);
  });
  if (!ids.size) throw Error("No offerings parsed; preserving previous data");
  return [...ids]
    .sort()
    .map((courseId) => ({ courseId, term, status: "CONFIRMED", sourceUrl }));
}
export function parseCSProgram(html: string, retrievedAt: string): Program {
  const $ = load(html);
  const text = $("body").text().replace(/\s+/g, " ");
  const required = [
    "CSE 311",
    "CSE 312",
    "CSE 331",
    "CSE 332",
    "CSE 351",
    "MATH 208",
    "33 additional",
  ];
  if (required.some((t) => !text.includes(t)))
    throw Error("CS program source changed; manual review required");
  const sourceUrl = UW_URLS.program;
  const r = (
    id: string,
    title: string,
    type: Requirement["type"],
    extra: Partial<Requirement> = {},
  ): Requirement => ({
    id: `uw-cs-${id}`,
    title,
    type,
    sourceUrl,
    rawText: title,
    parseStatus: "PARSED",
    ...extra,
  });
  const fundamentals = text.match(
    /Fundamental Courses.*?Minimum 2\.0 grade in each course\./,
  )?.[0];
  const math = text.match(
    /Mathematics \(15-19 credits\).*?Minimum 2\.0 grade in each course\./,
  )?.[0];
  const reviewedFundamentals =
    "Fundamental Courses (24-25 credits): CSE 123 or CSE 143, CSE 311, CSE 312, CSE 331, CSE 332, CSE 351. Minimum 2.0 grade in each course.";
  const reviewedMathematics =
    "Mathematics (15-19 credits): one of the following options: (1) MATH 124, MATH 125, MATH 126, MATH 208; (2) MATH 134, MATH 135, MATH 136. Minimum 2.0 grade in each course.";
  if (fundamentals !== reviewedFundamentals || math !== reviewedMathematics)
    throw Error(
      "Reviewed CS requirement text changed; preserve source for manual review before importing",
    );
  if (!fundamentals || !math)
    throw Error("Cannot safely isolate required course groups");
  const req = r("root", "Computer Science degree", "ALL_OF", {
    allowDoubleCount: true,
    children: [
      r("fundamentals", "Computer Science fundamentals", "ALL_OF", {
        rawText: fundamentals,
        children: [
          r("intro", "Introductory programming", "ANY_OF", {
            courseIds: ["CSE 123", "CSE 143"],
            chooseCount: 1,
            minGrade: 2,
          }),
          ...["311", "312", "331", "332", "351"].map((n) =>
            r(`cse${n}`, `CSE ${n}`, "COURSE", {
              courseIds: [`CSE ${n}`],
              minGrade: 2,
            }),
          ),
        ],
      }),
      r("math", "Mathematics", "ANY_OF", {
        rawText: math,
        children: [
          r(
            "standard-math",
            "Standard calculus + linear algebra",
            "COURSE_LIST",
            {
              courseIds: ["MATH 124", "MATH 125", "MATH 126", "MATH 208"],
              minGrade: 2,
            },
          ),
          r("honors-math", "Honors calculus sequence", "COURSE_LIST", {
            courseIds: ["MATH 134", "MATH 135", "MATH 136"],
            minGrade: 2,
          }),
        ],
      }),
      r("science", "Approved natural science · 5 credits", "MANUAL_REVIEW", {
        minCredits: 5,
        rawText:
          "5 credits from the approved CS natural science list. Biology, chemistry, physics, AP and petition alternatives have not been normalized.",
        parseStatus: "NEEDS_REVIEW",
      }),
      r("electives", "Core and electives · 33 credits", "MANUAL_REVIEW", {
        minCredits: 33,
        rawText:
          "Six CSE Core courses, at least four at 400 level; one additional Core or Capstone; approved electives to 33 credits. Course lists, cross-listed courses and allocation require review.",
        parseStatus: "NEEDS_REVIEW",
      }),
      r(
        "general",
        "General education, language and residency",
        "MANUAL_REVIEW",
        {
          sourceUrl: UW_URLS.programs,
          rawText:
            "Composition, foreign language, writing, diversity, Areas of Inquiry, residency and applicability of the 2023 checklist require adviser review. Current MATH 208 is 4 credits; the linked 2023 checklist says 3.",
          parseStatus: "NEEDS_REVIEW",
        },
      ),
      r("gpa", "Minimum 2.00 cumulative CSE GPA", "MANUAL_REVIEW", {
        rawText:
          "Minimum 2.00 cumulative GPA in all CSE courses. Repeat, transfer and grade policy need verification.",
        parseStatus: "NEEDS_REVIEW",
      }),
      r("total", "Minimum total credits", "MINIMUM_TOTAL_CREDITS", {
        minCredits: 180,
        sourceUrl: UW_URLS.programs,
        rawText:
          "The CS and CE programs each require 180 total credits to graduate.",
      }),
    ],
  });
  return {
    id: "uw-seattle-cs",
    name: "Computer Science",
    degreeType: "B.S.",
    catalogId: "uw-seattle-current-2026-09",
    catalogLabel: "Current source snapshot · September 2026 (review required)",
    sourceUrl,
    retrievedAt,
    status: "NEEDS_REVIEW",
    requirements: req,
  };
}
export function assembleUW(input: {
  cse: string;
  math: string;
  offerings: string;
  program: string;
  retrievedAt: string;
  sourceDates?: Record<string, string>;
}): AcademicData {
  const d = input.sourceDates ?? {};
  const courses = [
    ...parseCourseCatalog(
      input.cse,
      "CSE",
      UW_URLS.cse,
      d.cse ?? input.retrievedAt,
    ),
    ...parseCourseCatalog(
      input.math,
      "MATH",
      UW_URLS.math,
      d.math ?? input.retrievedAt,
    ),
  ];
  const sourceUrl =
    "https://www.washington.edu/students/timeschd/pub/AUT2026/cse.html";
  return {
    institution: { id: "uw", name: "University of Washington" },
    campus: {
      id: "uw-seattle",
      name: "Seattle",
      calendar: {
        seasons: ["Winter", "Spring", "Summer", "Autumn"],
        optionalSeason: "Summer",
      },
    },
    courses,
    offeringCoverage: [
      { term: { year: 2026, season: "Autumn" }, subject: "CSE", sourceUrl },
    ],
    offerings: parseOfferings(
      input.offerings,
      { year: 2026, season: "Autumn" },
      sourceUrl,
    ).filter((o) => courses.some((c) => c.id === o.courseId)),
    programs: [
      parseCSProgram(input.program, d["cs-program"] ?? input.retrievedAt),
    ],
    sources: [
      {
        name: "CSE course catalog",
        url: UW_URLS.cse,
        retrievedAt: d.cse ?? input.retrievedAt,
        status: "PARSED",
        notes:
          "Undergraduate descriptions; complex prerequisites remain under review.",
      },
      {
        name: "Mathematics course catalog",
        url: UW_URLS.math,
        retrievedAt: d.math ?? input.retrievedAt,
        status: "PARSED",
        notes: "AP alternatives and registration restrictions are not guessed.",
      },
      {
        name: "Autumn 2026 CSE Course Offerings",
        url: sourceUrl,
        retrievedAt: d.offerings ?? input.retrievedAt,
        status: "PARSED",
        notes:
          "Course presence only. Section, enrollment and major restrictions require official registration checks.",
      },
      {
        name: "Computer Science requirements",
        url: UW_URLS.program,
        retrievedAt: d["cs-program"] ?? input.retrievedAt,
        status: "NEEDS_REVIEW",
        notes:
          "Fundamentals and mathematics normalized. Full degree and historical catalog-year applicability not verified.",
      },
      {
        name: "Department requirements and course lists",
        url: UW_URLS.programs,
        retrievedAt: d.programs ?? input.retrievedAt,
        status: "NEEDS_REVIEW",
        notes:
          "MATH 208 credit conflict: linked 2023 checklist 3; current catalog 4. CE not yet supported.",
      },
    ],
  };
}
