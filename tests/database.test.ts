import "dotenv/config";
import { afterAll, describe, it, expect } from "vitest";
import { db } from "../src/server/db";
import { hashPassword, verifyPassword } from "../src/server/password";
import {
  readSavedPlan,
  deleteSavedPlan,
  readStudent,
  saveStudent,
  switchMajor,
} from "../src/server/student";
import { importAcademicData } from "../src/ingestion/import";
import { demoData } from "../src/server/academic";
import { demoState } from "../src/data/demo";
const created: string[] = [];
afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: created } } });
  await db.$disconnect();
});
describe("database integration (requires local migrated PostgreSQL)", () => {
  it("switches majors both ways without changing history or old saved snapshots", async () => {
    const user = await db.user.create({
      data: {
        email: `switch-${Date.now()}@example.com`,
        passwordHash: "unused",
      },
    });
    created.push(user.id);
    await saveStudent(user.id, demoState);
    const before = await db.studentCourse.findMany({
      where: { userId: user.id },
      orderBy: { courseId: "asc" },
    });
    const plan = await db.savedPlan.create({
      data: {
        userId: user.id,
        name: "Original CS",
        score: 0,
        config: { programCatalogId: demoState.programCatalogId },
        result: { terms: [] },
      },
    });
    await switchMajor(
      user.id,
      "uw-seattle-business:uw-seattle-business-2026-09",
    );
    expect((await readStudent(user.id)).state.programCatalogId).toContain(
      "business",
    );
    expect(
      await db.studentCourse.findMany({
        where: { userId: user.id },
        orderBy: { courseId: "asc" },
      }),
    ).toEqual(before);
    expect((await readStudent(user.id)).plans).toHaveLength(1);
    expect((await readSavedPlan(user.id, plan.id))?.config).toEqual(
      plan.config,
    );
    await switchMajor(user.id, demoState.programCatalogId);
    expect((await readStudent(user.id)).state.programCatalogId).toBe(
      demoState.programCatalogId,
    );
    await expect(switchMajor(user.id, "invalid")).rejects.toThrow();
    expect(
      await db.studentCourse.findMany({
        where: { userId: user.id },
        orderBy: { courseId: "asc" },
      }),
    ).toEqual(before);
  });
  it("hashes with independent salts and rejects wrong passwords", async () => {
    const a = await hashPassword("a sufficiently long password"),
      b = await hashPassword("a sufficiently long password");
    expect(a).not.toBe(b);
    expect(await verifyPassword("a sufficiently long password", a)).toBe(true);
    expect(await verifyPassword("wrong", a)).toBe(false);
  });
  it("user A cannot read or delete user B saved plans", async () => {
    const users = await Promise.all(
      ["a", "b"].map(async (tag) => {
        const u = await db.user.create({
          data: {
            email: `unit-${tag}-${Date.now()}@example.com`,
            passwordHash: await hashPassword("integration-test-password"),
          },
        });
        created.push(u.id);
        return u;
      }),
    );
    const plan = await db.savedPlan.create({
      data: {
        userId: users[0].id,
        name: "Private plan",
        score: 0,
        config: {},
        result: {},
      },
    });
    expect(await readSavedPlan(users[1].id, plan.id)).toBeNull();
    expect((await deleteSavedPlan(users[1].id, plan.id)).count).toBe(0);
    expect(await readSavedPlan(users[0].id, plan.id)).not.toBeNull();
  });
  it("student updates are scoped to server-provided user and reject injected ids", async () => {
    const a = await db.user.create({
      data: {
        email: `unit-state-${Date.now()}@example.com`,
        passwordHash: "unused",
      },
    });
    created.push(a.id);
    await saveStudent(a.id, demoState);
    expect((await readStudent(a.id)).state.courses).toHaveLength(4);
    await expect(
      saveStudent(a.id, { ...demoState, userId: "someone-else" }),
    ).rejects.toThrow();
  });
  it("failed transaction cannot corrupt previously valid academic data", async () => {
    const prior = await db.course.findUniqueOrThrow({
      where: { id: "CSE 311" },
    });
    const data = structuredClone(demoData);
    data.courses.find((c) => c.id === "CSE 311")!.title = "MUST ROLL BACK";
    await expect(
      importAcademicData(db, data, [
        {
          url: "https://www.washington.edu/failure-test",
          text: "broken snapshot",
          retrievedAt: "invalid date",
        },
      ]),
    ).rejects.toThrow();
    expect(
      (await db.course.findUniqueOrThrow({ where: { id: "CSE 311" } })).title,
    ).toBe(prior.title);
    expect(
      (await db.importRun.findFirst({ orderBy: { startedAt: "desc" } }))
        ?.status,
    ).toBe("FAILED");
  });
});
