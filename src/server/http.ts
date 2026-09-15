import { NextRequest, NextResponse } from "next/server";
export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  if (
    !origin ||
    (origin !== req.nextUrl.origin && origin !== process.env.AUTH_URL)
  )
    throw Error("Invalid request origin");
}
export function errorResponse(error: unknown) {
  return NextResponse.json(
    { error: error instanceof Error ? error.message : "Request failed" },
    { status: 400 },
  );
}
