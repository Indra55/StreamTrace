import { z } from "zod";
import type { PoolClient } from "pg";
import { HTTPException } from "hono/http-exception";
import { fromDatabase } from "../engine/adapter.ts";
import { type Value } from "../engine/index.ts";
import { engineTaskData } from "./task.ts";
import { signalSchema as citizenSignals, assumptionsSchema as citizenAssumptions } from "../shared/observations.ts";
export { citizenSignals, citizenAssumptions };
export const citizenContext=z.object({source:z.enum(["ai_draft","parser_draft","manual"]),assumptions:citizenAssumptions,site_distance_m:z.number().int().min(0).max(300).optional()}).strict();
const networkSchema=z.object({reaches:z.array(z.object({id:z.string(),downstream:z.array(z.string())}).passthrough()).min(1),sites:z.array(z.object({code:z.string(),reachId:z.string(),accessible:z.boolean(),landmark:z.string().max(200).optional()}).passthrough()),metadata:z.object({topology_review_state:z.string()}).passthrough()}).passthrough();
export async function publicNetwork(client:PoolClient,id:string) {
  const cases=await client.query<{id:string;title:string;signal:string;assumptions:string;network_id:string;simulated:boolean}>("select id,title,signal,assumptions,network_id,simulated from public.cases where id=$1",[id]);
  const c=cases.rows[0];if(!c)throw new HTTPException(404,{message:"Case not found"});
  const rows=await client.query<{graph:unknown}>("select graph from public.networks where id=$1",[c.network_id]);
  if(!rows.rows[0])throw new HTTPException(409,{message:"Case network unavailable"});
  const graph=networkSchema.parse(rows.rows[0].graph);
  const sites=await client.query<{code:string;reach_id:string;accessible:boolean}>("select code,reach_id,accessible,network_id from public.sites where network_id=$1 order by code",[c.network_id]);
  graph.sites=sites.rows.map(s=>({...graph.sites.find(original=>original.code===s.code),code:s.code,reachId:s.reach_id,accessible:s.accessible}));
  return {case:c,graph};
}
export async function taskFacts(client:PoolClient,id:string) {
  const data=await publicNetwork(client,id);
  const rows=await client.query<{id:string;case_id:string;site_id:string;signal:string;value:Value}>("select id,case_id,site_id,signal,value,observed_on from public.public_reports where case_id=$1 order by id",[id]);
  // The public view is filtered by the current approved decision. Database approval
  // constraints guarantee acknowledged assumptions and comparable absence.
  const reports=rows.rows.map(r=>({...r,site_code:r.site_id,confirmed:true}));
  const decisions=rows.rows.map(r=>({report_id:r.id,revision:1,state:"approved" as const,assumptions_acknowledged:true,absence_comparable:true}));
  return engineTaskData(data.graph,data.case,fromDatabase(reports,decisions));
}
