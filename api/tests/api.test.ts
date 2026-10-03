import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import { createApp } from "../app.ts";
import { withUser } from "../db.ts";
import { makeDraft } from "../draft.ts";
import { fixture,config } from "./helpers.ts";

test("anonymous reviewer routes reject with 401 and forged sessions are rejected", async () => {
  const f=await fixture();
  assert.equal((await f.app.request("/api/reviewer/queue")).status,401);
  assert.equal((await f.post("/api/reviews",{})).status,401);
  assert.equal((await f.app.request("/api/reviewer/queue",{headers:{Cookie:"streamtrace_session=forged"}})).status,401);
  assert.equal((await f.app.request(`/api/cases/${f.caseId}/analysis`)).status,401);
  assert.equal((await f.app.request(`/api/cases/${f.caseId}/export?format=fhir`)).status,401);
});
test("submissions ignore forged approval, reviewer and revision fields and validate sites", async () => {
  const f=await fixture();
  const response=await f.post("/api/reports",{...f.payload,review_state:"approved",reviewer_id:f.userId,revision:999,assumptions_acknowledged:true});
  assert.equal(response.status,201);
  assert.deepEqual(await response.json(),{id:f.reportId,review_state:"unreviewed"});
  assert.equal(f.reports[0]?.review_state,"unreviewed");
  assert.equal(f.reports[0]?.reviewer_id,undefined);
  assert.equal(f.decisions.length,0);
  assert.equal((await f.post("/api/reports",{...f.payload,site_code:"missing"})).status,400);
  assert.equal((await f.post("/api/reports",{...f.payload,notes:"x".repeat(501)})).status,400);
});
test("unknown users and incorrect passwords have identical login errors; cookie is protected", async () => {
  const f=await fixture();
  const wrong=await f.post("/api/login",{email:"reviewer@example.invalid",password:"incorrect"});
  const unknown=await f.post("/api/login",{email:"unknown@example.invalid",password:"incorrect"});
  assert.equal(wrong.status,401); assert.equal(unknown.status,401);
  assert.deepEqual(await wrong.json(),await unknown.json());
  const success=await f.post("/api/login",{email:"reviewer@example.invalid",password:"test-only-random-password"});
  assert.equal(success.status,200);
  assert.match(success.headers.get("set-cookie")!,/HttpOnly/i);
  assert.match(success.headers.get("set-cookie")!,/SameSite=Strict/i);
  assert.equal((await f.post("/api/signup",{})).status,404);
});
test("login is rate limited per peer and cross-origin cookie writes are forbidden", async () => {
  const f=await fixture();
  for(let i=0;i<10;i++) assert.equal((await f.post("/api/login",{})).status,401);
  assert.equal((await f.post("/api/login",{})).status,429);
  const badOrigin=await f.app.request("/api/reviews",{method:"POST",headers:{Origin:"https://untrusted.invalid","Content-Type":"application/json"},body:"{}"});
  assert.equal(badOrigin.status,403);
  assert.notEqual(badOrigin.headers.get("access-control-allow-origin"),"https://untrusted.invalid");
});
test("approval then withdrawal restores the original candidates through the API and adapter", async () => {
  const f=await fixture(), cookie=await f.cookie();
  await f.post("/api/reports",{...f.payload,review_state:"approved"});
  const read=async () => (await (await f.app.request(`/api/cases/${f.caseId}/analysis`,{headers:{Cookie:cookie}})).json());
  assert.deepEqual((await read()).candidates,["a","b","c"]);
  const decision={report_id:f.reportId,state:"approved",assumptions_acknowledged:true,absence_comparable:true};
  assert.equal((await f.post("/api/reviews",decision,cookie)).status,200);
  assert.deepEqual((await read()).candidates,["b","c"]);
  const published=await (await f.app.request("/api/public/reports")).json();
  assert.deepEqual(Object.keys(published[0]).sort(),["id","case_id","site_id","signal","value","observed_on"].sort());
  assert.equal((await f.post("/api/reviews",{...decision,state:"unreviewed"},cookie)).status,200);
  assert.deepEqual((await read()).candidates,["a","b","c"]);
  assert.deepEqual(await (await f.app.request("/api/public/reports")).json(),[]);
});
test("transaction-scoped roles and JWT claims reset on success and rollback", async () => {
  const f=await fixture();
  await withUser(f.pool,f.userId,async () => 123);
  assert.equal(f.calls.at(-1)?.sql,"commit");
  await assert.rejects(withUser(f.pool,f.userId,async () => { throw new Error("Expected failure"); }));
  assert.equal(f.calls.at(-1)?.sql,"rollback");
  await withUser(f.pool,null,async () => undefined);
  const claim=f.calls.filter(c => c.sql.startsWith("select set_config")).at(-1);
  assert.equal(claim?.values[0],'{"sub":null}');
  assert.equal(f.calls.at(-3)?.sql,"set local role app_anon");
});
test("Groq unreachable, invalid input and malformed provider output use exact fallback", async () => {
  const f=await fixture();
  for(const body of [{text:"I see foam"},{text:"x".repeat(501)},{text:""}]) {
    const response=await f.post("/api/draft",body);
    assert.equal(response.status,502); assert.deepEqual(await response.json(),{error:"fallback"});
  }
  const bad=await createApp(f.pool,config,{fetcher:async () => new Response('{"choices":[{"message":{"content":"not JSON"}}]}')});
  const response=await bad.request("/api/draft",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({text:"I see foam"})});
  assert.equal(response.status,502); assert.deepEqual(await response.json(),{error:"fallback"});
});
test("drafts clamp confidence, normalize unclear and reject chemical or cause fields", async () => {
  for(const [confidence,expected] of [[5,1],[-5,0]]) {
    const draft=await makeDraft({text:"Maybe foam"},"mock","mock",async (_url,init) => {
      const body=JSON.parse(String(init?.body)); assert.equal(body.temperature,0); assert.deepEqual(body.response_format,{type:"json_object"});
      return Response.json({choices:[{message:{content:JSON.stringify({value:"unclear",confidence})}}]});
    });
    assert.deepEqual(draft,{value:"cannot_tell",confidence:expected,source:"ai_draft"});
  }
  await assert.rejects(makeDraft({text:"Foam"},"mock","mock",async () => Response.json({choices:[{message:{content:JSON.stringify({value:"present",confidence:1,cause:"chemical"})}}]})));
});
test("draft timeout returns within five seconds when the provider stalls", async () => {
  const start=Date.now();
  await assert.rejects(makeDraft({text:"Foam"},"mock","mock",async () => new Promise<Response>(() => {})));
  assert.ok(Date.now()-start>=4_900 && Date.now()-start<7_000);
});
test("FHIR R4 collection has unique URLs, required fields and resolving Location focus", async () => {
  const f=await fixture(),cookie=await f.cookie();
  await f.post("/api/reports",f.payload);
  const response=await f.app.request(`/api/cases/${f.caseId}/export?format=fhir`,{headers:{Cookie:cookie}});
  assert.equal(response.status,200); assert.equal(response.headers.get("content-type"),"application/fhir+json");
  const bundle=await response.json();
  const resource=z.discriminatedUnion("resourceType",[
    z.object({resourceType:z.literal("Location"),id:z.string(),status:z.literal("active"),mode:z.literal("instance"),name:z.string(),description:z.string()}).strict(),
    z.object({resourceType:z.literal("Observation"),id:z.uuid(),status:z.literal("preliminary"),code:z.object({text:z.string()}),focus:z.array(z.object({reference:z.string()})).min(1),effectiveDateTime:z.iso.datetime(),valueCodeableConcept:z.object({text:z.string()}),note:z.array(z.object({text:z.string()}))}).strict(),
  ]);
  z.object({resourceType:z.literal("Bundle"),type:z.literal("collection"),entry:z.array(z.object({fullUrl:z.string().regex(/^urn:uuid:/),resource})).min(2)}).strict().parse(bundle);
  assert.equal(new Set(bundle.entry.map((e:{fullUrl:string})=>e.fullUrl)).size,bundle.entry.length);
  for(const e of bundle.entry) {
    assert.equal(e.resource.meta,undefined);
    if(e.resource.resourceType==="Observation") assert.ok(bundle.entry.some((location:typeof e)=> location.resource.resourceType==="Location" && location.fullUrl===e.resource.focus[0].reference));
  }
});
