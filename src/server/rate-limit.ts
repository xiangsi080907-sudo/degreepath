import { db } from "./db";
import { createHash } from "node:crypto";
export async function allowAuthAttempt(identity: string, limit = 15) {
  const key = createHash("sha256").update(identity).digest("hex");
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      { count: number }[]
    >`INSERT INTO "AuthAttempt" ("key","count","windowStart") VALUES (${key},1,NOW()) ON CONFLICT ("key") DO UPDATE SET "count"=CASE WHEN "AuthAttempt"."windowStart" < NOW()-INTERVAL '15 minutes' THEN 1 ELSE "AuthAttempt"."count"+1 END, "windowStart"=CASE WHEN "AuthAttempt"."windowStart" < NOW()-INTERVAL '15 minutes' THEN NOW() ELSE "AuthAttempt"."windowStart" END RETURNING "count"`;
    return rows[0].count <= limit;
  });
}
