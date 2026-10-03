import { readConfig } from "../api/config.ts";
import { createPool,assertRuntimeRole,withUser } from "../api/db.ts";
const pool=createPool(readConfig().DATABASE_URL);
try {
  await assertRuntimeRole(pool);
  await withUser(pool,null,async client=>{await client.query("select id,case_id,site_id,signal,value,observed_on from public.public_reports limit 1");});
  console.log("Runtime role and anonymous public-view read passed on DATABASE_URL; no rows written");
} catch {console.error("Runtime security check failed");process.exitCode=1;}
finally {await pool.end();}
