import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

/** An error whose message and HTTP status are safe to return to a browser. */
export class PublicRequestError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

function originFromConfiguredUrl(value: string | undefined) {
  if (!value) return undefined;
  try {
    return new URL(value).origin;
  } catch {
    return undefined;
  }
}

export function sameOrigin(req: NextRequest) {
  const origin = req.headers.get("origin");
  const configuredOrigin = originFromConfiguredUrl(process.env.AUTH_URL);
  if (!origin || (origin !== req.nextUrl.origin && origin !== configuredOrigin))
    throw new PublicRequestError("Invalid request origin", 403);
}
export function errorResponse(error: unknown) {
  if (error instanceof PublicRequestError)
    return NextResponse.json(
      { error: error.message },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      { error: "Invalid request data" },
      { status: 400 },
    );
  return NextResponse.json(
    { error: "Request could not be completed. Please try again." },
    { status: 500 },
  );
}
