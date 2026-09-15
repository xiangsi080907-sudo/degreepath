import { StudentState } from "../server/validation";
export const demoState: StudentState = {
  programCatalogId: "uw-seattle-cs:uw-seattle-current-2026-09",
  courses: ["CSE 123", "MATH 124", "MATH 125", "MATH 126"].map((courseId) => ({
    courseId,
    status: "COMPLETED",
    grade: 3.5,
  })),
  preferences: {
    start: { year: 2026, season: "Autumn" },
    target: { year: 2028, season: "Spring" },
    minCredits: 8,
    maxCredits: 16,
    includeSummer: false,
    workload: "balanced",
    unavailable: [],
  },
  programs: ["uw-seattle-cs"],
};
