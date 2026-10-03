import { readFile } from "node:fs/promises";
import { migrate, testPool } from "./migrate.ts";
try {
  await migrate(true);
  const pool = testPool();
  try {
    await pool.query(await readFile(new URL("../db/tests/rls.sql", import.meta.url), "utf8"));
    console.log("RLS and reviewer lifecycle checks passed on TEST_DATABASE_URL");
  } finally { await pool.end(); }
} catch {
  console.error("RLS tests failed; use a separate disposable TEST_DATABASE_URL");
  process.exitCode=1;
}
