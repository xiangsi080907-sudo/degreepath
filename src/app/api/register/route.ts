import { NextRequest, NextResponse } from "next/server";
import { registerSchema } from "@/server/validation";
import { hashPassword } from "@/server/password";
import { db } from "@/server/db";
import { sameOrigin } from "@/server/http";
import { allowAuthAttempt } from "@/server/rate-limit";
export async function POST(req: NextRequest) {
  try {
    sameOrigin(req);
    const result = registerSchema.safeParse(await req.json());
    if (!result.success)
      return NextResponse.json(
        {
          error: "Enter a name, valid email and password of 12–128 characters.",
        },
        { status: 400 },
      );
    const { name, email, password } = result.data;
    if (!(await allowAuthAttempt(`register:${email}`, 5)))
      return NextResponse.json(
        { error: "Too many attempts. Try again in 15 minutes." },
        { status: 429 },
      );
    await db.user.create({
      data: { name, email, passwordHash: await hashPassword(password) },
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch {
    return NextResponse.json(
      {
        error:
          "Unable to create account. This email may already be registered.",
      },
      { status: 400 },
    );
  }
}
