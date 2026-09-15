import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";
const pg = new EmbeddedPostgres({
  databaseDir: ".local-db",
  user: "degreepath",
  password: "degreepath",
  port: 54329,
  persistent: true,
  postgresFlags: ["-h", "127.0.0.1"],
  onLog: () => {},
  onError: console.error,
});
async function main() {
  if (!existsSync(".local-db/PG_VERSION")) await pg.initialise();
  await pg.start();
  const client = pg.getPgClient();
  await client.connect();
  const result = await client.query(
    "SELECT 1 FROM pg_database WHERE datname='degreepath'",
  );
  await client.end();
  if (!result.rowCount) await pg.createDatabase("degreepath");
  console.log("DegreePath development PostgreSQL listening on 127.0.0.1:54329");
}
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, async () => {
    await pg.stop();
    process.exit(0);
  });
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
