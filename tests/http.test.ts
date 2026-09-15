import { describe, expect, it } from "vitest";
import { z } from "zod";
import { errorResponse, PublicRequestError } from "../src/server/http";

describe("API error responses", () => {
  it("returns intentional request messages and their status", async () => {
    const response = errorResponse(
      new PublicRequestError("Unknown course", 400),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Unknown course" });
  });

  it("does not expose unexpected error details", async () => {
    const response = errorResponse(
      new Error("database connection password=do-not-return-this"),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Request could not be completed. Please try again.",
    });
  });

  it("returns a safe validation response", async () => {
    let validationError: unknown;
    try {
      z.object({ courseId: z.string() }).parse({ courseId: 42 });
    } catch (error) {
      validationError = error;
    }

    const response = errorResponse(validationError);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid request data",
    });
  });
});
