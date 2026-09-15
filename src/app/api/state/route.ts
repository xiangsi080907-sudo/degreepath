import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { readStudent, saveStudent } from "@/server/student";
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
