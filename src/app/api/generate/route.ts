import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/server/db";
import { auth } from "@/auth";
import { stateSchema } from "@/server/validation";
import { demoData, getAcademicData } from "@/server/academic";
import { generatePlans } from "@/domain/planner";
import { sameOrigin, errorResponse } from "@/server/http";
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const demo = req.nextUrl.searchParams.get("demo") === "true";
    const userId = demo ? undefined : (await auth())?.user?.id;
    if (!demo && !userId)
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    const state = stateSchema.parse(await req.json());
    const data = demo ? demoData : await getAcademicData();
    if (
      !data.campus.calendar.seasons.includes(state.preferences.start.season) ||
      (state.preferences.target &&
        !data.campus.calendar.seasons.includes(state.preferences.target.season))
    )
      throw Error("Invalid term");
    const program = data.programs.find(
      (p) => `${p.id}:${p.catalogId}` === state.programCatalogId,
    );
    if (!program) throw Error("Unsupported program/catalog");
    if (
      state.courses.some((c) => !data.courses.some((x) => x.id === c.courseId))
    )
      throw Error("Unknown course");
    const plans = generatePlans(
      data,
      program,
      { courses: state.courses, programs: state.programs },
      state.preferences,
    );
    if (userId)
      await db.studentProfile.update({
        where: { userId },
        data: {
          draftPlans: { state, plans } as unknown as Prisma.InputJsonValue,
        },
      });
    return NextResponse.json(plans);
  } catch (e) {
    return errorResponse(e);
  }
}
