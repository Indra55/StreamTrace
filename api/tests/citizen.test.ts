import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fixture } from "./helpers.ts";
import { referenceSchema } from "../../shared/observations.ts";
const context={source:"ai_draft",assumptions:{persistence:true,detectability:true,flow:true,recent_rain:"no"},site_distance_m:120};
test("random references expose only state and never accept internal report IDs",async()=>{
  const f=await fixture();const submitted=await f.post("/api/reports",{...f.payload,citizen_context:context,notes:"Private citizen notes"});assert.equal(submitted.status,201);
  const {ref}=await submitted.json();referenceSchema.parse(ref);assert.notEqual(ref,f.reportId);assert.deepEqual(f.reports[0]?.citizen_context,context);
  const status=await f.app.request(`/api/reports/${ref}/status`);assert.equal(status.status,200);assert.deepEqual(await status.json(),{state:"pending"});
  assert.equal((await f.app.request(`/api/reports/${f.reportId}/status`)).status,400);
  assert.equal((await f.app.request("/api/reports/AAAAAAAAAAAAAAAA/status")).status,404);
});
test("status lookup is limited per IP, including invalid references",async()=>{
  let ip="192.0.2.1";const f=await fixture(()=>ip);
  for(let i=0;i<30;i++)assert.equal((await f.app.request("/api/reports/invalid/status")).status,400);
  const blocked=await f.app.request("/api/reports/invalid/status");assert.equal(blocked.status,429);assert.ok(Number(blocked.headers.get("Retry-After"))>0);
  ip="192.0.2.2";assert.equal((await f.app.request("/api/reports/invalid/status")).status,400);
});
test("general-inbox reports have no case and can never affect candidates",async()=>{
  const f=await fixture(),cookie=await f.cookie();
  const inbox={...f.payload,case_id:null,signal:"other",site_code:null,notes:"Something else observed"};assert.equal((await f.post("/api/reports",inbox)).status,201);
  assert.equal(f.reports[0]?.case_id,null);
  assert.equal((await f.post("/api/reviews",{report_id:f.reportId,state:"approved",assumptions_acknowledged:true,absence_comparable:true,approval_reason:"A researcher checked this"},cookie)).status,400);
  const analysis=await (await f.app.request(`/api/cases/${f.caseId}/analysis`,{headers:{Cookie:cookie}})).json();assert.deepEqual(analysis.candidates,["a","b","c"]);
  assert.deepEqual(await (await f.app.request("/api/public/reports")).json(),[]);
  assert.equal((await f.post("/api/reports",{...inbox,id:randomUUID(),signal:"foam"})).status,400);
  assert.equal((await f.post("/api/reports",{...f.payload,id:randomUUID(),signal:"odour"})).status,400);
});
test("citizen APIs reject raw location fields and discover the current case title",async()=>{
  const f=await fixture();assert.equal((await f.post("/api/reports",{...f.payload,citizen_context:{...context,latitude:40,longitude:-8}})).status,400);
  const cases=await (await f.app.request("/api/cases")).json();assert.equal(cases[0].title,"Foam investigation");assert.equal((await f.app.request(`/api/cases/${f.caseId}/network`)).status,200);
});
test("tasks need approved evidence and enabled recommendations, and include engine facts",async()=>{
  const f=await fixture(),cookie=await f.cookie();assert.equal((await f.post("/api/task",{case_id:f.caseId})).status,409);
  await f.post("/api/reports",{...f.payload,citizen_context:context});assert.equal((await f.post("/api/task",{case_id:f.caseId})).status,409);
  assert.equal((await f.post("/api/reviews",{report_id:f.reportId,state:"approved",assumptions_acknowledged:true,absence_comparable:true},cookie)).status,200);
  const response=await f.post("/api/task",{case_id:f.caseId});assert.equal(response.status,200);const task=await response.json();
  assert.equal(task.site,"002");assert.deepEqual(task.facts,{total:2,seen_leaves:1,not_seen_leaves:1});assert.match(task.text_en,/Do not enter the water/);assert.equal(task.notes,undefined);
  f.graph.metadata.topology_review_state="needs_review";assert.equal((await f.post("/api/task",{case_id:f.caseId})).status,409);
  f.graph.metadata.topology_review_state="prototype_confirmed";Object.assign(f.graph.metadata,{geographic_recommendations_enabled:false});assert.equal((await f.post("/api/task",{case_id:f.caseId})).status,409);
});
test("unknown absence needs a meaningful reason that is saved in the review event",async()=>{
  const f=await fixture(),cookie=await f.cookie();await f.post("/api/reports",f.payload);
  const review={report_id:f.reportId,state:"approved",assumptions_acknowledged:true,absence_comparable:true};
  for(const approval_reason of [undefined,"short","          "])assert.equal((await f.post("/api/reviews",{...review,approval_reason},cookie)).status,400);
  assert.equal((await f.post("/api/reviews",{...review,approval_reason:"  Checked context on site  "},cookie)).status,200);
  assert.equal(f.events[0]?.approval_reason,"Checked context on site");
});
test("known No answers and Seen reports do not require a reason",async()=>{
  for(const value of ["absent","present"]){const f=await fixture(),cookie=await f.cookie();await f.post("/api/reports",{...f.payload,value,...(value==="absent"?{citizen_context:{...context,assumptions:{persistence:false,detectability:false,flow:false,recent_rain:"yes"}}}:{})});assert.equal((await f.post("/api/reviews",{report_id:f.reportId,state:"approved",assumptions_acknowledged:true,absence_comparable:true},cookie)).status,200);}
});
