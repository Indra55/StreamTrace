import { randomUUID } from "node:crypto";
import { hash } from "argon2";
import type { Pool, PoolClient } from "pg";
import type { ApiConfig } from "../config.ts";
import { createApp } from "../app.ts";
export const config: ApiConfig = { DATABASE_URL: "postgresql://unused.invalid/test", JWT_SECRET: "test-secret-that-is-longer-than-32-characters",
  GROQ_API_KEY: "mock-key", GROQ_MODEL: "mock-model", AI_DAILY_BUDGET: 200, AI_RATE_LIMIT: 20, CORS_ORIGIN: "http://localhost:5173", NODE_ENV: "test", PORT: 3000 };
export async function fixture(getIp?: (c: import("hono").Context)=>string) {
  const caseId = randomUUID(), userId = randomUUID(), reportId = randomUUID();
  const passwordHash = await hash("test-only-random-password");
  const graph = { reaches: [{ id: "a", downstream: ["c"] }, { id: "b", downstream: ["c"] }, { id: "c", downstream: [] }],
    sites: [{ code: "001", reachId: "a", accessible: true },{code:"002",reachId:"b",accessible:true}], metadata: { topology_review_state: "prototype_confirmed" } };
  const reports: Record<string, unknown>[] = [];
  const decisions: Record<string, unknown>[] = [];
  const events:Record<string,unknown>[]=[];
  const calls: { sql: string; values: unknown[] }[] = [];
  let role = "", claims: { sub: string | null } = { sub: null };
  let previous: { role: string; claims: typeof claims } | undefined;
  const client = {
    async query(sql: string, values: unknown[] = []) {
      calls.push({ sql, values });
      let rows: unknown[] = [];
      if (sql.startsWith("begin")) previous = { role, claims };
      else if (sql.startsWith("set local role")) role = sql.split(" ").at(-1)!;
      else if (sql.startsWith("select set_config")) claims = JSON.parse(String(values[0]));
      else if (["commit", "rollback"].includes(sql) && previous) { ({ role, claims } = previous); previous=undefined; }
      else if (sql.includes("private.is_reviewer() as allowed")) rows = [{ allowed: role === "app_authenticated" && claims.sub === userId }];
      else if (sql.includes("private.login_user")) rows = values[0] === "reviewer@example.invalid" ? [{ id: userId, password_hash: passwordHash }] : [];
      else if (sql.startsWith("select 1 from public.sites")) rows = ["001","002"].includes(String(values[0])) && (values.length===1 || values[1] === caseId && values[2] === "foam") ? [{}] : [];
      else if (sql.startsWith("insert into public.reports")) reports.push({ id: values[0], ref:values[9], case_id: values[1], signal: values[2], site_code: values[3], value: values[4], confirmed: true, origin: values[5], observed_at: values[6], notes: values[7], review_state: "unreviewed",citizen_context:values[8] ? JSON.parse(String(values[8])) : {} });
      else if (sql.startsWith("select value,case_id,citizen_context from public.reports")) rows = reports.filter(r => r.id === values[0]);
      else if (sql.startsWith("select public.review_report")) {
        const old = decisions.find(d => d.report_id === values[0]);
        const next = { report_id: values[0], revision: Number(old?.revision ?? 0)+1, state: values[1], assumptions_acknowledged: values[2], absence_comparable: values[3],approval_reason:values[4] };
        events.push({...next,created_at:"2026-10-04T00:00:00Z"});
        if (old) Object.assign(old,next); else decisions.push(next);
      } else if (sql.includes("public.report_status")) rows=reports.filter(r=>r.ref===values[0]).map(r=>({state:decisions.find(d=>d.report_id===r.id)?.state ?? "unreviewed"}));
      else if (sql.includes("from public.public_reports")) rows=reports.filter(r => r.case_id!==null && (!sql.includes("where case_id=$1") || r.case_id===values[0]) && decisions.some(d => d.report_id===r.id && d.state==="approved")).map(r => ({id:r.id,case_id:r.case_id,site_id:r.site_code,signal:r.signal,value:r.value,observed_on:r.observed_at}));
      else if (sql.includes("from public.review_events")) rows = events;
      else if (sql.startsWith("select id,title,signal,assumptions")) rows = (!values.length || values[0] === caseId) ? [{ id: caseId, title:"Foam investigation",signal: "foam", assumptions: "Simulated", network_id: "mock-network", simulated: true }] : [];
      else if (sql.startsWith("select graph")) rows = [{ graph }];
      else if (sql.startsWith("select code,reach_id")) rows = graph.sites.map(site=>({code:site.code,reach_id:site.reachId,accessible:site.accessible,network_id:"mock-network"}));
      else if (sql.includes("select d.report_id")) rows=decisions;
      else if (sql.includes("from public.reports")) rows=sql.includes("where case_id=$1") ? reports.filter(r=>r.case_id===values[0]) : reports;
      else throw new Error("Unexpected mock query");
      return { rows, rowCount: rows.length };
    }, release() {},
  };
  const pool = { async connect() { return client; } } as unknown as Pool;
  const app = await createApp(pool,config,{ getIp, fetcher: async () => { throw new Error("Unreachable mock service"); } });
  const payload = { id:reportId,case_id:caseId,signal:"foam",site_code:"001",value:"absent",confirmed:true,observed_at:"2026-10-04T00:00:00Z" };
  async function post(path: string, body: unknown, cookie = "") {
    return app.request(path,{method:"POST",headers:{"Content-Type":"application/json", ...(cookie ? {Cookie:cookie} : {})},body:JSON.stringify(body)});
  }
  async function cookie() {
    const response=await post("/api/login",{email:"reviewer@example.invalid",password:"test-only-random-password"});
    if(response.status!==200) throw new Error("Fixture login failed");
    return response.headers.get("set-cookie")!.split(";")[0]!;
  }
  return {app,pool,client:client as unknown as PoolClient,post,cookie,payload,caseId,userId,reportId,reports,decisions,events,graph,calls};
}
