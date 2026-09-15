export type ReviewStatus =
  "VERIFIED" | "PARSED" | "NEEDS_REVIEW" | "UNSUPPORTED";
export type Rule =
  | { type: "TRUE" }
  | { type: "COURSE_COMPLETED" | "CONCURRENT_ALLOWED"; course: string }
  | { type: "MIN_GRADE"; course: string; grade: number }
  | { type: "AND" | "OR"; rules: Rule[] }
  | { type: "MIN_CREDITS"; credits: number; subject?: string }
  | { type: "PROGRAM_STATUS"; program: string }
  | { type: "PERMISSION_REQUIRED" | "RAW_UNSUPPORTED"; text: string };
export type Term = { year: number; season: string };
export type Calendar = { seasons: string[]; optionalSeason?: string };
export type StudentCourse = {
  courseId: string;
  status: "COMPLETED" | "IN_PROGRESS" | "PLANNED";
  grade?: number;
  credits?: number;
  term?: Term;
};
export type RecordContext = {
  courses: StudentCourse[];
  programs: string[];
  concurrent?: string[];
};
export type Course = {
  id: string;
  subject: string;
  number: string;
  title: string;
  description: string;
  minCredits: number;
  maxCredits: number;
  attributes: string[];
  prerequisite: Rule;
  rawPrerequisite: string;
  recommended: string;
  parseStatus: ReviewStatus;
  sourceUrl: string;
  retrievedAt: string;
  offeringPattern: string;
  overlaps: string[];
  restrictions?: string;
};
export type Offering = {
  courseId: string;
  term: Term;
  status: "CONFIRMED" | "HISTORICAL_PATTERN";
  sourceUrl: string;
};
export type Requirement = {
  id: string;
  title: string;
  type:
    | "ALL_OF"
    | "ANY_OF"
    | "CHOOSE_N"
    | "MIN_CREDITS_FROM"
    | "COURSE"
    | "COURSE_LIST"
    | "SUBJECT_LEVEL"
    | "CATEGORY"
    | "GENERAL_EDUCATION_ATTRIBUTE"
    | "FREE_ELECTIVE"
    | "MINIMUM_TOTAL_CREDITS"
    | "MINIMUM_UPPER_DIVISION_CREDITS"
    | "MANUAL_REVIEW";
  children?: Requirement[];
  courseIds?: string[];
  minCredits?: number;
  chooseCount?: number;
  subject?: string;
  level?: number;
  attribute?: string;
  minGrade?: number;
  allowDoubleCount?: boolean;
  sourceUrl: string;
  rawText: string;
  parseStatus: ReviewStatus;
};
export type Program = {
  id: string;
  name: string;
  degreeType: string;
  catalogLabel: string;
  catalogId: string;
  sourceUrl: string;
  retrievedAt: string;
  status: ReviewStatus;
  requirements: Requirement;
};
export type AcademicData = {
  importHistory?: {
    source: string;
    status: string;
    startedAt: string;
    completedAt?: string;
    recordsProcessed: number;
  }[];
  institution: { id: string; name: string };
  campus: { id: string; name: string; calendar: Calendar };
  courses: Course[];
  offerings: Offering[];
  offeringCoverage?: { term: Term; subject: string; sourceUrl: string }[];
  programs: Program[];
  sources: {
    name: string;
    url: string;
    retrievedAt: string;
    status: ReviewStatus;
    notes: string;
  }[];
};
export type Preferences = {
  start: Term;
  target?: Term;
  minCredits: number;
  maxCredits: number;
  includeSummer: boolean;
  workload: "balanced" | "fastest" | "light";
  unavailable: string[];
};
export type PlanTerm = {
  term: Term;
  courseIds: string[];
  credits: number;
  reasons: Record<string, string[]>;
};
export type Plan = {
  id: string;
  name: string;
  terms: PlanTerm[];
  score: number;
  complete: boolean;
  warnings: string[];
  explanation: string;
  estimatedGraduation?: Term;
  searchStates: number;
};
