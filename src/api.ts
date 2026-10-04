import { contextSchema } from "./citizen/model.ts";
import { z } from "zod";
import type { InvestigationResult } from "../engine/index.ts";
import type { StoredDecision } from "../engine/adapter.ts";
import type { DemoState, Network } from "./demo.ts";
const base=(import.meta.env.VITE_API_URL ?? "").replace(/\/$/,"");
export class ApiError extends Error {
  readonly status: number;
  constructor(status: number,message: string) { super(message);this.status=status; }
}
export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  let response: Response;
  try {response=await fetch(`${base}${path}`,{...options,credentials:"include",headers:{...options.headers,...(options.body && !(options.body instanceof FormData) ? {"Content-Type":"application/json"} : {})}});}
  catch(error) {if(error instanceof Error && error.name==="AbortError") throw error;throw new ApiError(0,"Backend unavailable. Check the connection and try again.");}
  const payload:unknown=await response.json().catch(()=>null);
  if(!response.ok) {
    const parsed=z.object({error:z.string()}).safeParse(payload);
    throw new ApiError(response.status,parsed.success ? parsed.data.error : "The backend could not complete this request.");
  }
  return payload as T;
}
export const caseSchema=z.object({id:z.uuid(),title:z.string().optional(),signal:z.string(),assumptions:z.string(),network_id:z.string().nullable(),simulated:z.boolean()});
export type LiveCase=z.infer<typeof caseSchema>;
export const casesSchema=z.array(caseSchema);
export const publicReportsSchema=z.array(z.object({id:z.uuid(),case_id:z.uuid(),site_id:z.string(),signal:z.string(),value:z.enum(["present","absent","cannot_tell"]),observed_on:z.iso.datetime({offset:true})}));
export type PublicReports=z.infer<typeof publicReportsSchema>;
const visibleNetwork=z.object({
  reaches:z.array(z.object({id:z.string(),downstream:z.array(z.string()),fromNode:z.number(),toNode:z.number(),names:z.array(z.string()),geometry:z.array(z.tuple([z.number(),z.number()])).min(2)})).min(1),
  sites:z.array(z.object({code:z.string(),reachId:z.string(),accessible:z.boolean(),osmNodeId:z.number(),coordinates:z.tuple([z.number(),z.number()])})),
  metadata:z.object({topology_review_state:z.string()}),
});
export const networkSchema=z.custom<Network>(value=>visibleNetwork.safeParse(value).success,"Invalid map data from server");
const decisionSchema=z.object({report_id:z.uuid(),revision:z.number().int().positive(),state:z.enum(["approved","rejected","uncertain","unreviewed"]),assumptions_acknowledged:z.boolean(),absence_comparable:z.boolean()});
const reportSchema=z.object({id:z.uuid(),case_id:z.uuid(),signal:z.string(),site_code:z.string(),value:z.enum(["present","absent","cannot_tell"]),confirmed:z.boolean(),observed_at:z.iso.datetime({offset:true}),notes:z.string(),origin:z.string(),review_state:z.literal("unreviewed"),citizen_context:contextSchema.optional().catch(undefined)});
const analysisSchema=z.object({candidates:z.array(z.string()),steps:z.array(z.object({reportId:z.string(),operation:z.enum(["intersect","subtract"]),upstream:z.array(z.string()),before:z.array(z.string()),after:z.array(z.string()),explanation:z.string()})),checkedSites:z.array(z.string()),status:z.enum(["awaiting_review","active","conflict","narrowed","no_useful_next_site"]),recommendation:z.object({siteCode:z.string(),present:z.array(z.string()),absent:z.array(z.string()),worstPartition:z.number()}).nullable(),message:z.string()});
export const snapshotSchema=z.object({case:caseSchema,graph:networkSchema,reports:z.array(reportSchema),decisions:z.array(decisionSchema),analysis:analysisSchema,
  events:z.array(z.object({report_id:z.uuid(),revision:z.number().int(),state:z.string(),created_at:z.iso.datetime({offset:true}),approval_reason:z.string().default("")}))});
export type Snapshot=z.infer<typeof snapshotSchema>;
export function viewState(snapshot:Snapshot,before:number):DemoState {
  const decisions:StoredDecision[]=snapshot.reports.map(r=>snapshot.decisions.find(d=>d.report_id===r.id) ?? {
    report_id:r.id,revision:0,state:"unreviewed",assumptions_acknowledged:false,absence_comparable:false,
  });
  return {observations:snapshot.reports.map(r=>({...r,title:snapshot.case.simulated ? "Simulated observation" : "Submitted observation"})),decisions,
    history:snapshot.events.map((event,i)=>({id:i,at:event.created_at,text:`Review ${event.revision}: ${event.state} for report ${event.report_id}.${event.approval_reason ? ` Reason: ${event.approval_reason}` : ""}`,before:0,after:0})),
    before,after:snapshot.analysis.candidates.length,sequence:snapshot.reports.length};
}
export function serverAnalysis(snapshot:Snapshot):InvestigationResult {return snapshot.analysis;}

export const inboxReportSchema=z.object({id:z.uuid(),case_id:z.null(),signal:z.literal("other"),site_code:z.string().nullable(),value:z.enum(["present","absent","cannot_tell"]),notes:z.string(),observed_at:z.iso.datetime({offset:true})});
export type InboxReport=z.infer<typeof inboxReportSchema>;
export function parseQueue(value:unknown) {const rows=z.array(z.object({case_id:z.string().nullable()}).passthrough()).parse(value);return {rows,inbox:rows.filter(r=>r.case_id===null).map(r=>inboxReportSchema.parse(r))};}
