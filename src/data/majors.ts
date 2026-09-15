import type { AcademicData } from "../domain/types";

export const SUPPORTED_MAJORS = [
  {
    id: "uw-seattle-cs",
    displayName: "Computer Science",
    shortName: "CS",
    featuredCourseId: "CSE 311",
    university: "University of Washington",
    campus: "Seattle",
    school: "Paul G. Allen School of Computer Science & Engineering",
    description:
      "Fundamentals, mathematics, and prerequisite-aware course planning.",
    coverage: "Established partial coverage",
    catalogId: "uw-seattle-current-2026-09",
    subjects: ["CSE", "MATH"],
  },
  {
    id: "uw-seattle-business",
    displayName: "Business",
    shortName: "Business",
    featuredCourseId: "ACCTG 215",
    university: "University of Washington",
    campus: "Seattle",
    school: "Foster School of Business",
    description:
      "BABA shared core and foundations. Electives and specializations need review.",
    coverage: "New · shared core coverage",
    catalogId: "uw-seattle-business-2026-09",
    subjects: [
      "MATH",
      "ACCTG",
      "ECON",
      "QMETH",
      "MGMT",
      "MKTG",
      "FIN",
      "I S",
      "I BUS",
      "B ECON",
      "OPMGT",
    ],
  },
] as const;
export const programKey = (major: { id: string; catalogId: string }) =>
  `${major.id}:${major.catalogId}`;
export const majorForKey = (key: string) =>
  SUPPORTED_MAJORS.find((m) => programKey(m) === key);
export const DEFAULT_PROGRAM_KEY = programKey(SUPPORTED_MAJORS[0]);
export function savedProgramKey(config: unknown): string {
  if (
    config &&
    typeof config === "object" &&
    "programCatalogId" in config &&
    typeof config.programCatalogId === "string"
  )
    return config.programCatalogId;
  return DEFAULT_PROGRAM_KEY; // Legacy single-program snapshots without a key were CS.
}

// Limit scoring/dependency connections to a program's imported departments.
// Adding another program must not change the established CS search universe.
export function planningData(
  data: AcademicData,
  programId: string,
  history: { courseId: string }[] = [],
): AcademicData {
  const major = SUPPORTED_MAJORS.find((m) => m.id === programId);
  return major
    ? {
        ...data,
        courses: data.courses.filter(
          (c) =>
            (major.subjects as readonly string[]).includes(c.subject) ||
            history.some((record) => record.courseId === c.id),
        ),
      }
    : data;
}
