import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readStudent, saveStudent, switchMajor } from "@/server/student";
import { z } from "zod";
import { sameOrigin, errorResponse } from "@/server/http";
export async function GET() {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  return NextResponse.json(await readStudent(session.user.id));
}
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    sameOrigin(req);
    return NextResponse.json(
      await saveStudent(session.user.id, await req.json()),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  try {
    sameOrigin(req);
    const { programCatalogId } = z
      .object({ programCatalogId: z.string() })
      .strict()
      .parse(await req.json());
    return NextResponse.json(
      await switchMajor(session.user.id, programCatalogId),
    );
  } catch (e) {
    return errorResponse(e);
  }
}
