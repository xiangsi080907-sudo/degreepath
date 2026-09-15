import {
  AcademicData,
  Course,
  Preferences,
  Program,
  Requirement,
  Rule,
} from "../src/domain/types";
export const source = "https://example.edu/fixture";
export const req = (
  id: string,
  extra: Partial<Requirement> = {},
): Requirement => ({
  id,
  title: id,
  type: "COURSE",
  courseIds: [id],
  sourceUrl: source,
  rawText: "Synthetic test rule — not university data",
  parseStatus: "VERIFIED",
  ...extra,
});
export const course = (
  id: string,
  rule: Rule = { type: "TRUE" },
  credits = 4,
): Course => ({
  id,
  subject: "TEST",
  number: id.replace(/\D/g, "") || "100",
  title: id,
  description: "Synthetic test course, not UW data",
  minCredits: credits,
  maxCredits: credits,
  prerequisite: rule,
  rawPrerequisite: "fixture",
  parseStatus: "VERIFIED",
  attributes: [],
  sourceUrl: source,
  retrievedAt: "2026-01-01T00:00:00Z",
  recommended: "",
  offeringPattern: "",
  overlaps: [],
});
export const completed = (courseId: string, grade?: number) => ({
  courseId,
  status: "COMPLETED" as const,
  grade,
});
export const prefs: Preferences = {
  start: { year: 2026, season: "Autumn" },
  minCredits: 4,
  maxCredits: 8,
  includeSummer: false,
  workload: "balanced",
  unavailable: [],
};
export function fixture(
  courses: Course[],
  requirements: Requirement,
): AcademicData {
  const program: Program = {
    id: "synthetic",
    name: "Synthetic program",
    degreeType: "Test",
    catalogId: "test",
    catalogLabel: "Synthetic tests only",
    sourceUrl: source,
    retrievedAt: "2026-01-01T00:00:00Z",
    status: "VERIFIED",
    requirements,
  };
  return {
    institution: { id: "test", name: "Synthetic test institution" },
    campus: {
      id: "test",
      name: "Test",
      calendar: {
        seasons: ["Winter", "Spring", "Summer", "Autumn"],
        optionalSeason: "Summer",
      },
    },
    courses,
    programs: [program],
    offerings: [],
    sources: [],
  };
}
