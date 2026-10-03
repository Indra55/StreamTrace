import { serve } from "@hono/node-server";
import { getConnInfo } from "@hono/node-server/conninfo";
import { readConfig } from "./config.ts";
import { createPool, assertRuntimeRole } from "./db.ts";
import { createApp } from "./app.ts";

async function start() {
  const config = readConfig();
  const pool = createPool(config.DATABASE_URL);
  try {
    await assertRuntimeRole(pool);
    const app = await createApp(pool, config, { getIp: c => getConnInfo(c).remote.address ?? "unknown" });
    const server = serve({ fetch: app.fetch, port: config.PORT, hostname: "0.0.0.0" }, () => console.log("StreamTrace API ready"));
    let closing = false;
    const stop = () => {
      if (closing) return;
      closing = true;
      server.close(() => { pool.end().then(() => { process.exitCode=0; }).catch(() => { process.exitCode=1; }); });
      setTimeout(() => process.exit(1), 10_000).unref();
    };
    process.once("SIGINT", stop); process.once("SIGTERM", stop);
  } catch (error) { await pool.end(); throw error; }
}
start().catch(() => { console.error("API startup refused; verify environment, TLS and runtime database role"); process.exitCode=1; });
