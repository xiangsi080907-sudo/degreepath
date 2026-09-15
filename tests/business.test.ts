import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { demoData } from "../src/server/academic";
import snapshot from "../src/data/uw/snapshot.json";
import { demoState } from "../src/data/demo";
import {
  majorForKey,
  planningData,
  programKey,
  savedProgramKey,
  SUPPORTED_MAJORS,
} from "../src/data/majors";
import { stateSchema } from "../src/server/validation";
import { generatePlan, validatePlan } from "../src/domain/planner";
import { evaluateRequirement } from "../src/domain/requirements";
import { evaluatePrerequisite } from "../src/domain/prerequisites";
import {
  BUSINESS_COURSES,
  parseBusinessProgram,
} from "../src/ingestion/business";
import type { AcademicData, StudentCourse } from "../src/domain/types";
const business = demoData.programs.find((p) => p.id === "uw-seattle-business")!;
const data = planningData(demoData, business.id);
const prefs = { ...demoState.preferences, minCredits: 4, maxCredits: 15 };
const complete = (courseId: string): StudentCourse => ({
  courseId,
  status: "COMPLETED",
  grade: 3.5,
});

describe("multi-major academic definitions", () => {
  it("exposes only supported stable identifiers and rejects invalid/injected owners", () => {
    expect(SUPPORTED_MAJORS.map((m) => m.id)).toEqual([
      "uw-seattle-cs",
      "uw-seattle-business",
    ]);
    expect(
      stateSchema.safeParse({ ...demoState, programCatalogId: "fake" }).success,
    ).toBe(false);
    expect(
      stateSchema.safeParse({ ...demoState, userId: "other" }).success,
    ).toBe(false);
    expect(
      stateSchema.safeParse({
        ...demoState,
        programCatalogId: programKey(business),
      }).success,
    ).toBe(true);
    expect(majorForKey(programKey(business))?.school).toBe(
      "Foster School of Business",
    );
  });
  it("keeps historical saved snapshots associated with CS", () => {
    expect(savedProgramKey(demoState)).toBe(demoState.programCatalogId);
    expect(savedProgramKey({})).toBe(demoState.programCatalogId);
    expect(savedProgramKey({ programCatalogId: programKey(business) })).toBe(
      programKey(business),
    );
  });
  it("preserves exact established CS planning results", () => {
    const original = snapshot as AcademicData;
    const record = { courses: demoState.courses, programs: demoState.programs };
    expect(
      generatePlan(
        planningData(demoData, "uw-seattle-cs"),
        original.programs[0],
        record,
        demoState.preferences,
      ),
    ).toEqual(
      generatePlan(
        original,
        original.programs[0],
        record,
        demoState.preferences,
      ),
    );
  });
  it("imports every shared core course with source evidence and no invented offerings", () => {
    for (const id of BUSINESS_COURSES) {
      const course = data.courses.find((c) => c.id === id)!;
      expect(course.description.length).toBeGreaterThan(10);
      expect(course.sourceUrl).toMatch(/^https:\/\/www.washington.edu\//);
      expect(demoData.offerings.some((o) => o.courseId === id)).toBe(false);
    }
  });
  it("rejects a changed official core rather than silently retaining old requirements", () => {
    const html = readFileSync(
      "tests/fixtures/uw/business/program.html",
      "utf8",
    );
    expect(() =>
      parseBusinessProgram(
        html.replaceAll("MGMT 430", "MGMT 499"),
        new Date().toISOString(),
      ),
    ).toThrow(/changed/);
  });
  it("counts shared completed calculus once and leaves unmodeled policy under review", () => {
    const audit = evaluateRequirement(
      business.requirements,
      [complete("MATH 124"), complete("MATH 125"), complete("ECON 200")],
      data.courses,
    );
    const foundation = audit.children[0];
    expect(foundation.status).toBe("PARTIAL");
    expect(foundation.children[0].status).toBe("COMPLETE");
    expect(foundation.children[0].used).toEqual(["MATH 124"]);
    expect(audit.status).toBe("REVIEW");
  });
  it("retains credit evidence from courses outside the active major", () => {
    const history = [complete("CSE 121"), complete("MATH 124")];
    const scoped = planningData(demoData, business.id, history);
    expect(scoped.courses.some((c) => c.id === "CSE 121")).toBe(true);
    const full = evaluateRequirement(
      business.requirements,
      history,
      demoData.courses,
    );
    expect(
      evaluateRequirement(business.requirements, history, scoped.courses),
    ).toEqual(full);
  });
  it("enforces accounting prerequisite chains and statistics alternatives", () => {
    const acctg = data.courses.find((c) => c.id === "ACCTG 225")!;
    expect(
      evaluatePrerequisite(
        acctg.prerequisite,
        { courses: [complete("ACCTG 215")], programs: [] },
        data.courses,
      ).status,
    ).toBe("MISSING");
    expect(
      evaluatePrerequisite(
        acctg.prerequisite,
        {
          courses: [complete("ACCTG 215"), complete("ECON 200")],
          programs: [],
        },
        data.courses,
      ).status,
    ).toBe("SATISFIED");
    const stats = data.courses.find((c) => c.id === "QMETH 201")!;
    for (const id of ["MATH 112", "MATH 124"])
      expect(
        evaluatePrerequisite(
          stats.prerequisite,
          { courses: [complete(id)], programs: [] },
          data.courses,
        ).status,
      ).toBe("SATISFIED");
  });
  it("generates deterministic partial Business plans with valid timing", () => {
    const record = { courses: [complete("MATH 124")], programs: [] };
    const plan = generatePlan(data, business, record, prefs);
    expect(plan.terms.length).toBeGreaterThan(0);
    expect(plan.complete).toBe(false);
    expect(plan.estimatedGraduation).toBeUndefined();
    expect(
      validatePlan(plan, data, record, prefs).filter(
        (v) => v.severity === "ERROR",
      ),
    ).toEqual([]);
    expect(plan).toEqual(generatePlan(data, business, record, prefs));
    expect(plan.terms.flatMap((t) => t.courseIds)).not.toContain("MATH 124");
  });
  it("excludes unavailable courses and remains partial for impossible loads", () => {
    const record = { courses: [], programs: [] };
    const plan = generatePlan(data, business, record, {
      ...prefs,
      unavailable: ["ACCTG 215"],
    });
    expect(plan.terms.flatMap((t) => t.courseIds)).not.toContain("ACCTG 215");
    expect(
      generatePlan(data, business, record, {
        ...prefs,
        minCredits: 1,
        maxCredits: 1,
      }).complete,
    ).toBe(false);
  });
});
