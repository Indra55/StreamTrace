import { Pool, type PoolClient } from "pg";

export function createPool(connectionString: string, localTest = false): Pool {
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol)) throw new Error("Invalid database configuration");
  if (localTest && !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) {
    throw new Error("Test TLS exception is restricted to loopback");
  }
  // Explicit TLS configuration wins over URL options, including driver overrides.
  for (const key of [...url.searchParams.keys()]) {
    if (key.startsWith("ssl") || key === "channel_binding") url.searchParams.delete(key);
  }
  const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: !localTest },
    max: 10, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 30_000 });
  pool.on("error", () => { console.error("Database connection unavailable"); });
  return pool;
}

export async function withUser<T>(pool: Pool, userId: string | null, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let damaged = false;
  try {
    await client.query("begin isolation level repeatable read");
    await client.query(userId ? "set local role app_authenticated" : "set local role app_anon");
    await client.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: userId })]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    try { await client.query("rollback"); } catch { damaged = true; }
    throw error;
  } finally { client.release(damaged); }
}

export async function assertRuntimeRole(pool: Pool): Promise<void> {
  const result = await pool.query<{ safe: boolean }>(`
    select current_user = 'app_login' and not r.rolsuper and not r.rolbypassrls
      and not r.rolcreaterole and not r.rolcreatedb and not r.rolreplication and not r.rolinherit
      and not exists (
        select 1 from pg_roles reachable where pg_has_role(current_user,reachable.oid,'MEMBER')
          and (reachable.rolsuper or reachable.rolbypassrls)
      ) and not exists (
        select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname in ('public','private','auth') and c.relkind in ('r','p','v','m')
          and pg_has_role(current_user,c.relowner,'MEMBER')
      ) and (select count(*)=2 from pg_auth_members m where m.member=r.oid)
      and pg_has_role(current_user,'app_anon','MEMBER')
      and pg_has_role(current_user,'app_authenticated','MEMBER')
      and not exists (
        select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname in ('public','private') and c.relkind in ('r','p')
          and (not c.relrowsecurity or not c.relforcerowsecurity)
      ) as safe from pg_roles r where r.rolname=current_user`);
  if (result.rows[0]?.safe !== true) throw new Error("Unsafe runtime database role or RLS configuration");
}
