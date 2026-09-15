import { describe, it, expect } from "vitest";
import {
  evaluatePrerequisite,
  referencedCourses,
} from "../src/domain/prerequisites";
import {
  detectPrerequisiteCycles,
  getCoursesUnlockedBy,
  getTransitivePrerequisites,
  shortestDependencyChain,
  shortestPrerequisiteSet,
} from "../src/domain/graph";
import { evaluateRequirement } from "../src/domain/requirements";
import { getEligibleCourses } from "../src/domain/eligibility";
import { nextTerm, recordBeforeTerm } from "../src/domain/calendar";
import {
  generatePlan,
  generatePlans,
  validatePlan,
  whatIf,
} from "../src/domain/planner";
import { Rule } from "../src/domain/types";
import { course, completed, fixture, prefs, req } from "./factory";
const A: Rule = { type: "COURSE_COMPLETED", course: "A" },
  B: Rule = { type: "COURSE_COMPLETED", course: "B" },
  C: Rule = { type: "COURSE_COMPLETED", course: "C" };
const record = (...ids: string[]) => ({
  courses: ids.map((id) => completed(id)),
  programs: [],
});
describe("prerequisite expressions", () => {
  it("requires completed course", () => {
    expect(evaluatePrerequisite(A, record("A")).status).toBe("SATISFIED");
    expect(evaluatePrerequisite(A, record()).status).toBe("MISSING");
  });
  it("AND preserves all obligations", () =>
    expect(
      evaluatePrerequisite({ type: "AND", rules: [A, B] }, record("A")).status,
    ).toBe("MISSING"));
  it("OR allows one branch", () =>
    expect(
      evaluatePrerequisite({ type: "OR", rules: [A, B] }, record("B")).status,
    ).toBe("SATISFIED"));
  it("nested expressions stay distinct", () => {
    const x: Rule = { type: "OR", rules: [{ type: "AND", rules: [A, B] }, C] },
      y: Rule = { type: "AND", rules: [A, { type: "OR", rules: [B, C] }] };
    expect(evaluatePrerequisite(x, record("C")).status).toBe("SATISFIED");
    expect(evaluatePrerequisite(y, record("C")).status).toBe("MISSING");
  });
  it("grade absence is unknown", () => {
    expect(
      evaluatePrerequisite(
        { type: "MIN_GRADE", course: "A", grade: 2 },
        record("A"),
      ).status,
    ).toBe("UNKNOWN");
    expect(
      evaluatePrerequisite(
        { type: "MIN_GRADE", course: "A", grade: 2 },
        { courses: [completed("A", 3)], programs: [] },
      ).status,
    ).toBe("SATISFIED");
  });
  it("low grades fail", () =>
    expect(
      evaluatePrerequisite(
        { type: "MIN_GRADE", course: "A", grade: 2 },
        { courses: [completed("A", 1)], programs: [] },
      ).status,
    ).toBe("MISSING"));
  it("concurrent only when allowed", () => {
    expect(
      evaluatePrerequisite(
        { type: "CONCURRENT_ALLOWED", course: "A" },
        { ...record(), concurrent: ["A"] },
      ).status,
    ).toBe("SATISFIED");
    expect(
      evaluatePrerequisite(A, { ...record(), concurrent: ["A"] }).status,
    ).toBe("MISSING");
  });
  it("unknown branches do not poison a satisfied OR", () =>
    expect(
      evaluatePrerequisite(
        {
          type: "OR",
          rules: [A, { type: "RAW_UNSUPPORTED", text: "permission" }],
        },
        record("A"),
      ).status,
    ).toBe("SATISFIED"));
  it.each(["RAW_UNSUPPORTED", "PERMISSION_REQUIRED"] as const)(
    "%s never silently passes",
    (type) =>
      expect(
        evaluatePrerequisite({ type, text: "Check with adviser" }, record())
          .status,
      ).toBe("UNKNOWN"),
  );
  it("program status must be supplied", () =>
    expect(
      evaluatePrerequisite(
        { type: "PROGRAM_STATUS", program: "major" },
        record(),
      ).status,
    ).toBe("UNKNOWN"));
  it("in-progress is not completion", () =>
    expect(
      evaluatePrerequisite(A, {
        courses: [{ courseId: "A", status: "IN_PROGRESS" }],
        programs: [],
      }).status,
    ).toBe("MISSING"));
  it("minimum credits uses official fixed credits", () =>
    expect(
      evaluatePrerequisite({ type: "MIN_CREDITS", credits: 4 }, record("A"), [
        course("A"),
      ]).status,
    ).toBe("SATISFIED"));
});
describe("graph", () => {
  const catalog = [
    course("A"),
    course("B", A),
    course("C", B),
    course("D", { type: "OR", rules: [B, C] }),
  ];
  it("transitive closure", () =>
    expect(getTransitivePrerequisites("C", catalog)).toEqual(["A", "B"]));
  it("direct unlocks", () =>
    expect(getCoursesUnlockedBy("A", catalog)).toEqual(["B"]));
  it("shortest dependency chain", () =>
    expect(shortestDependencyChain("A", "C", catalog)).toEqual([
      "A",
      "B",
      "C",
    ]));
  it("unreachable path", () =>
    expect(shortestDependencyChain("C", "A", catalog)).toBeNull());
  it("detects cycles without infinite recursion", () =>
    expect(
      detectPrerequisiteCycles([course("A", B), course("B", A)])[0],
    ).toEqual(["A", "B", "A"]));
  it("acyclic graph", () =>
    expect(detectPrerequisiteCycles(catalog)).toEqual([]));
  it("shortest valid course set includes AND branches", () =>
    expect(
      shortestPrerequisiteSet("D", new Set(), [
        course("A"),
        course("B"),
        course("D", { type: "AND", rules: [A, B] }),
      ]).courses,
    ).toEqual(["A", "B"]));
  it("records all OR edges", () =>
    expect(referencedCourses({ type: "OR", rules: [A, B] })).toEqual([
      "A",
      "B",
    ]));
});
describe("requirements", () => {
  const catalog = [course("A"), course("B"), course("C")];
  it("completed course", () =>
    expect(
      evaluateRequirement(req("A"), [completed("A")], catalog).status,
    ).toBe("COMPLETE"));
  it("partial minimum credits", () =>
    expect(
      evaluateRequirement(
        req("x", {
          type: "MIN_CREDITS_FROM",
          courseIds: ["A", "B"],
          minCredits: 8,
        }),
        [completed("A")],
        catalog,
      ).status,
    ).toBe("PARTIAL"));
  it("choose N unique courses", () =>
    expect(
      evaluateRequirement(
        req("x", {
          type: "CHOOSE_N",
          courseIds: ["A", "B", "C"],
          chooseCount: 2,
        }),
        [completed("A"), completed("B")],
        catalog,
      ).status,
    ).toBe("COMPLETE"));
  it("nested alternatives", () =>
    expect(
      evaluateRequirement(
        req("x", {
          type: "ALL_OF",
          children: [
            req("A"),
            req("z", { type: "ANY_OF", courseIds: ["B", "C"] }),
          ],
        }),
        [completed("A"), completed("C")],
        catalog,
      ).status,
    ).toBe("COMPLETE"));
  it("prevents implicit double counting", () =>
    expect(
      evaluateRequirement(
        req("x", {
          type: "ALL_OF",
          children: [req("A"), req("A2", { courseIds: ["A"] })],
        }),
        [completed("A")],
        catalog,
      ).status,
    ).not.toBe("COMPLETE"));
  it("allows explicit double counting", () =>
    expect(
      evaluateRequirement(
        req("x", {
          type: "ALL_OF",
          allowDoubleCount: true,
          children: [req("A"), req("A2", { courseIds: ["A"] })],
        }),
        [completed("A")],
        catalog,
      ).status,
    ).toBe("COMPLETE"));
  it("manual rules block certification", () =>
    expect(
      evaluateRequirement(req("x", { type: "MANUAL_REVIEW" }), [], catalog)
        .status,
    ).toBe("REVIEW"));
  it("grade missing remains review", () =>
    expect(
      evaluateRequirement(req("A", { minGrade: 2 }), [completed("A")], catalog)
        .status,
    ).toBe("REVIEW"));
  it("in-progress does not inflate completed audit", () =>
    expect(
      evaluateRequirement(
        req("A"),
        [{ courseId: "A", status: "IN_PROGRESS" }],
        catalog,
      ).earned,
    ).toBe(0));
});
describe("calendar and eligibility", () => {
  const data = fixture([course("A"), course("B", A)], req("B"));
  it("wraps academic year", () =>
    expect(nextTerm(prefs.start, data.campus.calendar)).toEqual({
      year: 2027,
      season: "Winter",
    }));
  it("skips summer", () =>
    expect(
      nextTerm({ year: 2027, season: "Spring" }, data.campus.calendar, false)
        .season,
    ).toBe("Autumn"));
  it("supports semester configuration", () =>
    expect(
      nextTerm({ year: 2026, season: "Fall" }, { seasons: ["Spring", "Fall"] }),
    ).toEqual({ year: 2027, season: "Spring" }));
  it("rejects unknown terms", () =>
    expect(() =>
      nextTerm({ year: 2026, season: "Invalid" }, data.campus.calendar),
    ).toThrow());
  it("only counts earlier in-progress terms", () =>
    expect(
      recordBeforeTerm(
        [{ status: "IN_PROGRESS", term: prefs.start }],
        prefs.start,
        data.campus.calendar,
      ),
    ).toEqual([]));
  it("eligible and excludes completed", () =>
    expect(
      getEligibleCourses(
        record("A"),
        prefs.start,
        data.courses,
        [],
        data.campus.calendar,
      ).map((e) => e.course.id),
    ).toEqual(["B"]));
  it("incomplete prerequisite excludes target", () =>
    expect(
      getEligibleCourses(
        record(),
        prefs.start,
        data.courses,
        [],
        data.campus.calendar,
      ).map((e) => e.course.id),
    ).toEqual(["A"]));
});
describe("planner and what-if", () => {
  const data = fixture(
    [course("A"), course("B", A), course("C", B)],
    req("all", { type: "ALL_OF", children: [req("A"), req("B"), req("C")] }),
  );
  const run = () => generatePlan(data, data.programs[0], record(), prefs);
  it("orders prerequisites, completes degree and does not duplicate", () => {
    const p = run();
    expect(p.complete).toBe(true);
    expect(p.terms.map((t) => t.courseIds)).toEqual([["A"], ["B"], ["C"]]);
    expect(new Set(p.terms.flatMap((t) => t.courseIds)).size).toBe(3);
    expect(
      validatePlan(p, data, record(), prefs).filter(
        (v) => v.severity === "ERROR",
      ),
    ).toEqual([]);
  });
  it("never exceeds credit limits", () =>
    expect(run().terms.every((t) => t.credits <= 8 && t.credits >= 4)).toBe(
      true,
    ));
  it("honors unavailable courses", () =>
    expect(
      generatePlan(data, data.programs[0], record(), {
        ...prefs,
        unavailable: ["B"],
      }).complete,
    ).toBe(false));
  it("impossible minimum returns partial", () =>
    expect(
      generatePlan(data, data.programs[0], record(), {
        ...prefs,
        minCredits: 6,
      }).complete,
    ).toBe(false));
  it("completed course not repeated", () =>
    expect(
      generatePlan(data, data.programs[0], record("A"), prefs).terms.flatMap(
        (t) => t.courseIds,
      ),
    ).not.toContain("A"));
  it("reports unknown availability", () =>
    expect(run().warnings.some((w) => w.includes("unknown"))).toBe(true));
  it("stable deterministic results", () => expect(run()).toEqual(run()));
  it("target not attainable is reported", () =>
    expect(
      generatePlan(data, data.programs[0], record(), {
        ...prefs,
        target: prefs.start,
      }).warnings.some((w) => w.includes("not established")),
    ).toBe(true));
  it("unsupported rules stop the search", () => {
    const d = fixture(
      [course("A", { type: "RAW_UNSUPPORTED", text: "petition" })],
      req("A"),
    );
    expect(generatePlan(d, d.programs[0], record(), prefs).complete).toBe(
      false,
    );
  });
  it("multiple optimization strategies", () => {
    const d = fixture(
      ["A", "B", "C", "D"].map((id) => course(id)),
      req("all", { type: "COURSE_LIST", courseIds: ["A", "B", "C", "D"] }),
    );
    const plans = generatePlans(d, d.programs[0], record(), prefs);
    expect(plans.map((p) => p.name)).toEqual([
      "Fastest",
      "Balanced",
      "Light workload",
    ]);
    expect(plans[0].terms.length).toBeLessThan(plans[2].terms.length);
  });
  it("removal flags dependent prerequisites", () => {
    const r = whatIf(run(), data, record(), prefs, { courseId: "A", from: 0 });
    expect(
      r.violations.some((v) => v.courseId === "B" && v.severity === "ERROR"),
    ).toBe(true);
  });
  it("moving after a dependent is invalid", () => {
    const r = whatIf(run(), data, record(), prefs, {
      courseId: "A",
      from: 0,
      to: 2,
    });
    expect(
      r.violations.some((v) => v.courseId === "B" && v.severity === "ERROR"),
    ).toBe(true);
  });
  it("changed credit limit revalidates", () =>
    expect(
      validatePlan(run(), data, record(), { ...prefs, maxCredits: 3 }).some(
        (v) => v.message.includes("outside"),
      ),
    ).toBe(true));
  it("performance bounded on 60 independent courses", () => {
    const d = fixture(
      Array.from({ length: 60 }, (_, i) => course(`T${i}`)),
      req("all", {
        type: "COURSE_LIST",
        courseIds: Array.from({ length: 60 }, (_, i) => `T${i}`),
      }),
    );
    const start = performance.now();
    const p = generatePlan(d, d.programs[0], record(), {
      ...prefs,
      maxCredits: 16,
    });
    expect(performance.now() - start).toBeLessThan(4000);
    expect(p.searchStates).toBeLessThan(16 * 12 * 49);
  });
});

import { prepareEditedPlan } from "../src/server/plans";
it("edited saved plans retain the edited term arrangement and reject invalid prerequisites", () => {
  const data = fixture(
    [course("A"), course("B", A)],
    req("all", { type: "COURSE_LIST", courseIds: ["A", "B"] }),
  );
  const record = { courses: [], programs: [] };
  const base = generatePlan(data, data.programs[0], record, prefs);
  const moved = base.terms.map((t, i) => ({
    ...t,
    term: { year: 2027, season: i ? "Spring" : "Winter" },
  }));
  const saved = prepareEditedPlan(
    base,
    moved,
    data,
    record,
    prefs,
    data.programs[0],
  );
  expect(saved.terms[0].term.year).toBe(2027);
  expect(saved.score).toBe(0);
  expect(() =>
    prepareEditedPlan(
      base,
      [{ term: prefs.start, courseIds: ["B"] }],
      data,
      record,
      prefs,
      data.programs[0],
    ),
  ).toThrow("Repair plan");
});
it("confirmed offering coverage excludes courses absent from that term", () => {
  const data = fixture([course("A"), course("B")], req("B"));
  data.offerings = [
    {
      courseId: "A",
      term: prefs.start,
      status: "CONFIRMED",
      sourceUrl: "https://example.edu/fixture",
    },
  ];
  data.offeringCoverage = [
    {
      term: prefs.start,
      subject: "TEST",
      sourceUrl: "https://example.edu/fixture",
    },
  ];
  const p = generatePlan(
    data,
    data.programs[0],
    { courses: [], programs: [] },
    prefs,
  );
  expect(p.terms[0].courseIds).not.toContain("B");
  expect(p.terms[1].courseIds).toContain("B");
});
it("shortest course set accounts for shared OR/AND prerequisites", () => {
  const catalog = [
    course("A"),
    course("B"),
    course("D", { type: "AND", rules: [{ type: "OR", rules: [A, B] }, B] }),
  ];
  expect(shortestPrerequisiteSet("D", new Set(), catalog).courses).toEqual([
    "B",
  ]);
});
it("planner can schedule explicitly permitted concurrent courses in one term", () => {
  const data = fixture(
    [course("A", { type: "CONCURRENT_ALLOWED", course: "B" }), course("B")],
    req("all", { type: "COURSE_LIST", courseIds: ["A", "B"] }),
  );
  const p = generatePlan(
    data,
    data.programs[0],
    { courses: [], programs: [] },
    { ...prefs, minCredits: 8, maxCredits: 8 },
  );
  expect(p.complete).toBe(true);
  expect(p.terms).toHaveLength(1);
  expect(new Set(p.terms[0].courseIds)).toEqual(new Set(["A", "B"]));
});
it("empty waiting terms cannot satisfy a hard minimum-credit constraint", () => {
  const data = fixture([course("A")], req("A"));
  const violations = validatePlan(
    { terms: [{ term: prefs.start, courseIds: [], credits: 0, reasons: {} }] },
    data,
    { courses: [], programs: [] },
    prefs,
  );
  expect(
    violations.some(
      (v) => v.severity === "ERROR" && v.message.includes("outside"),
    ),
  ).toBe(true);
});
