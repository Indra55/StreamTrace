import { test } from "node:test";
import assert from "node:assert/strict";
import type { Pool } from "pg";
import { conductivityData, oahLoader, oahSource } from "../oneaquahealth.ts";
import { createApp } from "../app.ts";
import { config } from "./helpers.ts";

// Synthetic values test the adapter; the published data is fetched separately.
const csv = "date,location,coordinates,device,electrical_conductivity_mS_per_cm\n2025-4-14,Loc-Test,raw-coordinates,Test meter,3.25\n2024-11-21,Loc-Test,raw-coordinates,Test meter,4.5\n";

test("source adapter preserves identifiers and units, orders dates, and calculates a sample change", () => {
  const data = conductivityData(csv);
  assert.equal(data.kind,"published_reference_sample");
  assert.equal(data.unit,"mS/cm");
  assert.equal(data.sites[0]!.site,"Loc-Test");
  assert.deepEqual(data.sites[0]!.samples.map(r=>r.date),["2024-11-21","2025-04-14"]);
  assert.equal(data.sites[0]!.change,-1.25);
  assert.match(data.sha256,/^[a-f0-9]{64}$/);
  assert.equal(conductivityData(csv.split("\n").slice(0,2).join("\n")).sites[0]!.change,null);
  for (const invalid of [csv.replace("mS_per_cm","uS_per_cm"),csv.replace("3.25","NaN"),csv.replace("3.25","-1"),csv.replace("2025-4-14","2025-2-30"),csv.replace("2024-11-21","2025-4-14")]) assert.throws(()=>conductivityData(invalid));
});

test("source errors are explicit and retryable; concurrent and successful reads share the pinned fetch", async () => {
  let calls = 0;
  const load = oahLoader(async (url,init)=>{
    assert.equal(url,oahSource); assert.equal(init?.redirect,"error");
    calls++;
    return calls===1 ? new Response("unavailable",{status:503}) : new Response(csv);
  });
  await assert.rejects(load(),/OneAquaHealth sample unavailable/);
  const [a,b] = await Promise.all([load(),load()]);
  assert.deepEqual(a,b);
  await load(); assert.equal(calls,2);
});

test("public dataset endpoint uses the source adapter without accessing or changing case evidence", async () => {
  const pool = {connect:()=>{throw new Error("Dataset must not access case database");}} as unknown as Pool;
  const app = await createApp(pool,config,{fetcher:async ()=>new Response(csv)});
  const response = await app.request("/api/oneaquahealth/conductivity");
  assert.equal(response.status,200);
  assert.equal((await response.json()).sites[0].change,-1.25);
  const failed = await createApp(pool,config,{fetcher:async ()=>{throw new Error("Offline");}});
  const unavailable = await failed.request("/api/oneaquahealth/conductivity");
  assert.equal(unavailable.status,502);
  assert.match((await unavailable.json()).error,/sample unavailable/);
});
