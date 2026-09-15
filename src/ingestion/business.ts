import { load } from "cheerio";
import type { Program, Requirement } from "../domain/types";
export const BUSINESS_URL =
  "https://www.washington.edu/students/gencat/program/S/Business-300.html";
export const BUSINESS_CATALOGS = [
  ["acctg", "ACCTG"],
  ["econ", "ECON"],
  ["finance", "FIN"],
  ["infosys", "I S"],
  ["intlbus", "I BUS"],
  ["mgmt", "MGMT"],
  ["mktg", "MKTG"],
  ["opmgmt", "OPMGT"],
  ["qmeth", "QMETH"],
  ["busecon", "B ECON"],
] as const;
export const LOWER_CORE = ["ACCTG 215", "ACCTG 225", "QMETH 201", "MGMT 200"];
export const UPPER_CORE = [
  "B ECON 300",
  "MKTG 301",
  "I S 300",
  "I BUS 300",
  "OPMGT 301",
  "FIN 350",
  "MGMT 300",
  "MGMT 320",
  "MGMT 430",
];
export const BUSINESS_COURSES = [
  ...LOWER_CORE,
  ...UPPER_CORE,
  "ECON 200",
  "ECON 201",
];

export function parseBusinessProgram(
  html: string,
  retrievedAt: string,
): Program {
  const text = load(html)("body").text().replace(/\s+/g, " ");
  const core =
    "Core courses (55-57 credits): ACCTG 215, ACCTG 225; QMETH 201; MGMT 200; B ECON 300; MKTG 301; I S 300; I BUS 300; OPMGT 301; FIN 350; MGMT 300; MGMT 320; MGMT 430.";
  const section = text.slice(
    text.indexOf("Completion Requirements"),
    text.indexOf(
      "Bachelor of Arts in Business Administration degree with a major in Accounting Credential",
    ),
  );
  if (
    !section.includes(core) ||
    !section.includes(
      "includes 5 credits in calculus (MATH 112, MATH 124, or MATH 134)",
    ) ||
    !section.includes("ECON 200 and ECON 201") ||
    !section.includes("180 credits")
  )
    throw Error("Business requirements changed; manual source review required");
  const r = (
    id: string,
    title: string,
    type: Requirement["type"],
    extra: Partial<Requirement> = {},
  ): Requirement => ({
    id: `uw-business-${id}`,
    title,
    type,
    parseStatus: "PARSED",
    sourceUrl: BUSINESS_URL,
    rawText: title,
    ...extra,
  });
  return {
    id: "uw-seattle-business",
    name: "Business",
    degreeType: "B.A.B.A.",
    catalogId: "uw-seattle-business-2026-09",
    catalogLabel: "Business source snapshot · September 2026 (review required)",
    sourceUrl: BUSINESS_URL,
    retrievedAt,
    status: "NEEDS_REVIEW",
    requirements: r("root", "Business Administration degree", "ALL_OF", {
      allowDoubleCount: true,
      children: [
        r("foundation", "Business foundations", "ALL_OF", {
          children: [
            r("calculus", "Calculus · one approved course", "ANY_OF", {
              courseIds: ["MATH 112", "MATH 124", "MATH 134"],
              chooseCount: 1,
              rawText:
                "Catalog calculus alternatives; Foster curriculum also lists additional alternatives. Adviser review required for substitutions.",
            }),
            ...["ECON 200", "ECON 201"].map((id) =>
              r(id, id, "COURSE", { courseIds: [id] }),
            ),
          ],
        }),
        r("lower", "Lower-division Business core", "ALL_OF", {
          rawText: core,
          children: LOWER_CORE.map((id) =>
            r(id, id, "COURSE", { courseIds: [id] }),
          ),
        }),
        r("upper", "Upper-division Business core", "ALL_OF", {
          rawText: core,
          children: UPPER_CORE.map((id) =>
            r(id, id, "COURSE", { courseIds: [id] }),
          ),
        }),
        r(
          "credits",
          "180 total credits · applicability requires review",
          "MINIMUM_TOTAL_CREDITS",
          { minCredits: 180 },
        ),
        ...[
          [
            "electives",
            "16 upper-division Business elective credits and specialization",
            "General BABA allows upper-division business electives; named majors have additional curricula. Elective applicability and specialization requirements are not modeled.",
          ],
          [
            "general",
            "General education, composition, and writing",
            "English composition, additional writing, diversity, and Areas of Inquiry require adviser review. Foster and catalog writing totals need reconciliation.",
          ],
          [
            "policy",
            "GPA, residency, admission, and credit restrictions",
            "Minimum cumulative GPA, six upper-division core courses including MGMT 430 in residence, 40 of 53 upper-division business credits at UW Seattle, final-credit residency, and credit caps require review. Selecting Business does not establish Foster admission.",
          ],
          [
            "substitutions",
            "Calculus and statistics substitutions",
            "Additional calculus alternatives on Foster curriculum and approved QMETH 201 substitutions require adviser review. Unknown substitutions are not automatically counted.",
          ],
        ].map(([id, title, rawText]) =>
          r(id, title, "MANUAL_REVIEW", {
            rawText,
            parseStatus: "NEEDS_REVIEW",
          }),
        ),
      ],
    }),
  };
}
