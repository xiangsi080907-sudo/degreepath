import "dotenv/config";
import { PrismaClient } from "@prisma/client";
const db = new PrismaClient();
async function main() {
  console.table(
    await db.importRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
      select: {
        source: true,
        status: true,
        startedAt: true,
        completedAt: true,
        recordsProcessed: true,
        errors: true,
      },
    }),
  );
  console.table(
    await db.prerequisiteRule.groupBy({ by: ["parseStatus"], _count: true }),
  );
  console.table(
    await db.programCatalog.findMany({
      select: { id: true, status: true, retrievedAt: true, sourceUrl: true },
    }),
  );
}
main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
