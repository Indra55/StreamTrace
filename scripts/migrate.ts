import { config } from "dotenv";
import { readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import type { PoolClient } from "pg";
import { createPool } from "../api/db.ts";
config({ quiet: true });

function identity(value: string): string {
  const u = new URL(value);
  return `${u.hostname.replace(/-pooler(?=\.)/, "")}:${u.port || "5432"}${u.pathname}`;
}
export function testDatabaseUrl(): string {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL must identify a disposable database");
  for (const value of [process.env.DATABASE_URL, process.env.DATABASE_URL_ADMIN, process.env.DB_KEY]) {
    if (value && /^postgres(ql)?:/.test(value) && identity(url) === identity(value)) {
      throw new Error("Refusing tests against the main database");
    }
  }
  return url;
}
export function testPool(url = testDatabaseUrl()) {
  const host = new URL(url).hostname;
  return createPool(url, ["localhost", "127.0.0.1", "[::1]"].includes(host));
}

// Only this module opens the privileged main-database connection. Seed entrypoints
// delegate here after confirmation; API modules cannot access the admin URL.
export async function adminTransaction<T>(fn: (client: PoolClient) => Promise<T>, test = false): Promise<T> {
  const url = test ? testDatabaseUrl() : process.env.DATABASE_URL_ADMIN;
  if (!url) throw new Error("DATABASE_URL_ADMIN is required");
  if (!test && new URL(url).hostname.includes("-pooler.")) throw new Error("Migration requires a direct host");
  const pool = test ? testPool(url) : createPool(url);
  let client: PoolClient | undefined;
  try {
    client = await pool.connect();
    await client.query("begin");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    if (client) await client.query("rollback").catch(() => undefined);
    throw error;
  } finally { client?.release(); await pool.end(); }
}

export async function migrate(test = false): Promise<void> {
  const password = process.env.APP_LOGIN_PASSWORD;
  if (!password || password.length < 24) throw new Error("APP_LOGIN_PASSWORD must contain at least 24 characters");
  await adminTransaction(async client => {
    await client.query("select pg_advisory_xact_lock(73629145)");
    await client.query("create schema if not exists private; revoke all on schema private from public");
    await client.query(`create table if not exists private.schema_migrations (
      name text primary key, checksum text not null, applied_at timestamptz not null default now())`);
    const folder = new URL("../db/migrations/", import.meta.url);
    for (const name of (await readdir(folder)).filter(n => n.endsWith(".sql")).sort()) {
      const sql = await readFile(new URL(name, folder), "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const existing = await client.query<{ checksum: string }>("select checksum from private.schema_migrations where name=$1", [name]);
      if (existing.rows[0]) {
        if (existing.rows[0].checksum !== checksum) throw new Error("Applied migration checksum mismatch");
      } else {
        await client.query(sql);
        await client.query("insert into private.schema_migrations(name,checksum) values($1,$2)", [name,checksum]);
      }
    }
    await client.query(await readFile(new URL("../db/bootstrap.sql", import.meta.url), "utf8"));
    // DDL has no parameter slot for a password. quote_literal is performed server-side.
    const quoted = await client.query<{ value: string }>("select quote_literal($1) as value", [password]);
    await client.query(`alter role app_login password ${quoted.rows[0]!.value}`);
    const unexpected = await client.query(`select 1 from pg_auth_members m
      join pg_roles r on r.oid=m.roleid join pg_roles u on u.oid=m.member
      where u.rolname='app_login' and r.rolname not in ('app_anon','app_authenticated')`);
    if (unexpected.rowCount) throw new Error("Unexpected app_login role membership");
  }, test);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrate(process.argv.includes("--test")).then(() => console.log("Database migration complete"))
    .catch(() => { console.error("Migration failed; verify privileged configuration and database permissions"); process.exitCode=1; });
}
