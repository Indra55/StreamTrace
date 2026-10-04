import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID,randomBytes } from "node:crypto";
import { hash } from "argon2";
import type { Pool } from "pg";
import { migrate,adminTransaction,testDatabaseUrl,testPool } from "../../scripts/migrate.ts";
import { assertRuntimeRole,withUser } from "../db.ts";
import { createApp } from "../app.ts";
import { config } from "./helpers.ts";

// This test never substitutes DATABASE_URL when the separate test URL is missing.
test("real database reviewer lifecycle, RLS and startup role rejection", {skip:!process.env.TEST_DATABASE_URL}, async () => {
  const adminUrl=testDatabaseUrl();
  await migrate(true);
  const caseId=randomUUID(),userId=randomUUID(),outsiderId=randomUUID(),reportId=randomUUID(),siteCode=`test-${randomBytes(8).toString("hex")}`,networkId=`test-${caseId}`;
  const password=randomBytes(24).toString("base64url");
  const passwordHash=await hash(password);
  await adminTransaction(async client => {
    await client.query("insert into public.users(id,email,password_hash) values($1,$2,$3),($4,$5,$3)", [userId,`${userId}@example.invalid`,passwordHash,outsiderId,`${outsiderId}@example.invalid`]);
    await client.query("insert into public.reviewers values($1)",[userId]);
    const graph={reaches:[{id:"a",downstream:["c"]},{id:"b",downstream:["c"]},{id:"c",downstream:[]}],sites:[{code:siteCode,reachId:"a",accessible:true}],metadata:{topology_review_state:"prototype_confirmed"}};
    await client.query("insert into public.networks(id,label,graph,simulated) values($1,'Simulated integration test',$2,true)",[networkId,JSON.stringify(graph)]);
    await client.query("insert into public.cases(id,signal,assumptions,network_id,simulated) values($1,'foam','Simulated test assumptions',$2,true)",[caseId,networkId]);
    await client.query("insert into public.sites(code,reach_id,accessible,network_id) values($1,'a',true,$2)",[siteCode,networkId]);
  },true);
  const url=new URL(adminUrl); url.username="app_login";url.password=process.env.APP_LOGIN_PASSWORD!;
  const runtime=testPool(url.toString());
  try {
    await assertRuntimeRole(runtime);
    const app=await createApp(runtime,config,{fetcher:async () => {throw new Error("Provider unreachable");}});
    const post=(path:string,body:unknown,cookie="")=>app.request(path,{method:"POST",headers:{"Content-Type":"application/json",Cookie:cookie},body:JSON.stringify(body)});
    assert.equal((await app.request("/api/reviewer/queue")).status,401);
    assert.equal((await post("/api/reviews",{})).status,401);
    const wrong=await post("/api/login",{email:`${userId}@example.invalid`,password:"wrong"});
    const unknown=await post("/api/login",{email:`${randomUUID()}@example.invalid`,password:"wrong"});
    assert.deepEqual(await wrong.json(),await unknown.json());
    const login=await post("/api/login",{email:`${userId}@example.invalid`,password});
    assert.equal(login.status,200);const cookie=login.headers.get("set-cookie")!.split(";")[0]!;
    assert.equal((await post("/api/reports",{id:reportId,case_id:caseId,signal:"foam",site_code:siteCode,value:"absent",confirmed:true,observed_at:"2026-10-04T00:00:00Z",review_state:"approved",revision:999})).status,201);
    const state=await withUser(runtime,userId,async c=>(await c.query("select review_state from public.reports where id=$1",[reportId])).rows[0]);
    assert.equal(state.review_state,"unreviewed");
    const read=async ()=>(await(await app.request(`/api/cases/${caseId}/analysis`,{headers:{Cookie:cookie}})).json());
    assert.deepEqual((await read()).candidates,["a","b","c"]);
    assert.equal((await post("/api/reviews",{report_id:reportId,state:"approved",assumptions_acknowledged:true,absence_comparable:true,approval_reason:"Checked the unknown context"},cookie)).status,200);
    assert.deepEqual((await read()).candidates,["b","c"]);
    assert.equal((await post("/api/reviews",{report_id:reportId,state:"unreviewed",assumptions_acknowledged:false,absence_comparable:false},cookie)).status,200);
    assert.deepEqual((await read()).candidates,["a","b","c"]);
    await assert.rejects(withUser(runtime,outsiderId,c=>c.query("select public.review_report($1,'approved',true,true)",[reportId])));
    const fhir=await app.request(`/api/cases/${caseId}/export?format=fhir`,{headers:{Cookie:cookie}});
    assert.equal(fhir.status,200);const bundle=await fhir.json();assert.equal(bundle.resourceType,"Bundle");assert.equal(bundle.type,"collection");
    const draft=await post("/api/draft",{text:"Foam is visible"});assert.equal(draft.status,502);assert.deepEqual(await draft.json(),{error:"fallback"});
    await adminTransaction(async client => {
      const guardPool={query:client.query.bind(client)} as unknown as Pool;
      // Using the owner's connection is always refused.
      await assert.rejects(assertRuntimeRole(guardPool));
      const owner=(await client.query("select current_user as role")).rows[0].role as string;
      const ownerIdentifier='"'+owner.replaceAll('"','""')+'"';
      for(const scenario of ["bypass","owner","superuser"] as const) {
        if(scenario==="superuser" && !(await client.query("select rolsuper from pg_roles where rolname=current_user")).rows[0].rolsuper) continue;
        await client.query("savepoint unsafe_role");
        if(scenario==="bypass") await client.query("alter role app_login bypassrls");
        if(scenario==="superuser") await client.query("alter role app_login superuser");
        if(scenario==="owner") {await client.query("alter table public.reports owner to app_login");}
        await client.query("set local role app_login");
        await assert.rejects(assertRuntimeRole(guardPool));
        await client.query("rollback to savepoint unsafe_role");
        // Owner variable stays private and is never logged.
        await client.query(`set local role ${ownerIdentifier}`);
      }
    },true);
  } finally {await runtime.end();}
});
