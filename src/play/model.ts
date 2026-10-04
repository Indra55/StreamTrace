import { z } from "zod";
import { network, seed, evaluate, transition, type DemoState, type Network, type Observation, type Action } from "../demo.ts";
import { compileGraph, type Value } from "../../engine/index.ts";
import { draftOutputSchema, type Draft, type DraftInput } from "../../shared/ai.ts";
import { assumptionsSchema, emptyAssumptions, type Assumptions } from "../../shared/observations.ts";
import { standardDraft } from "./ai.ts";
export const LABEL="Simulated mission. AI may help with wording. No reports are saved.";
export const CLAIM="StreamTrace supports investigation planning; it does not identify chemicals or certify water safety.";
export const EXAMPLE_REASON="Simulated field check confirms persistence and visibility despite unknown citizen context.";
export interface FormState {
  site:string; text:string; value:Value; assumptions:Assumptions; confirmed:boolean; round:0|1|2;
  answers:NonNullable<DraftInput["answers"]>; drafts:Draft[]; replies:Record<string,string>; busy:boolean;
}
export const formInput=(form:FormState):DraftInput=>({text:form.text.trim() || exampleText(form.value),signal:"foam",siteHint:form.site,round:form.round,answers:form.answers});
export function exampleText(value:Value) {return value==="present" ? "I can see foam floating on the water at this site." : value==="absent" ? "I did not see any foam at this site." : "I cannot tell whether foam is visible here.";}
export function newForm(site:string,value:Value):FormState{return {site,text:"",value,assumptions:{...emptyAssumptions},confirmed:false,round:0,answers:{},drafts:[],replies:{},busy:false};}
export function applyDraft(form:FormState,draft:Draft):FormState {
  const a=draft.assumptions;
  return {...form,value:draft.value,confirmed:false,busy:false,drafts:[...form.drafts,structuredClone(draft)],replies:{},assumptions:{persistence:a.persistence==="unknown"?null:a.persistence==="yes",detectability:a.detectability==="unknown"?null:a.detectability==="yes",flow:a.flow_conditions==="unknown"?null:a.flow_conditions==="yes",recent_rain:a.recent_rain==="unknown"?"cannot_tell":a.recent_rain}};
}
const reportSchema=z.object({id:z.string(),site:z.string(),text:z.string().max(500),value:z.enum(["present","absent","cannot_tell"]),confirmed:z.literal(true),assumptions:assumptionsSchema,answers:z.record(z.string(),z.enum(["yes","no","unknown"])),drafts:z.array(draftOutputSchema),provenance:z.enum(["Player report","Simulated example"])});
export type ReportSnapshot=z.infer<typeof reportSchema>;
export interface MissionState { evidence:DemoState; initial:string[]; reports:ReportSnapshot[]; selected:string|null; attempts:string[]; reviewHistory:Extract<Action,{type:"review"}>[]; }
export function createMission(data:Network=network):MissionState {
  const base=seed(data,new Date().toISOString());
  const approved=new Set(base.decisions.filter(d=>d.state==="approved").map(d=>d.report_id));
  const evidence={...base,observations:base.observations.filter(r=>approved.has(r.id)),decisions:base.decisions.filter(d=>approved.has(d.report_id)),history:base.history.slice(0,2)};
  return {evidence,initial:[...evaluate(evidence,data).candidates],reports:[],selected:null,attempts:[],reviewHistory:[]};
}
export function partitions(state:MissionState,data:Network=network) {
  const result=evaluate(state.evidence,data), upstream=compileGraph(data).upstream;
  return data.sites.filter(s=>s.accessible).map(s=>({site:s.code,present:result.candidates.filter(id=>upstream.get(s.reachId)!.has(id)),absent:result.candidates.filter(id=>!upstream.get(s.reachId)!.has(id))}));
}
export function suggestedReport(state:MissionState,data:Network=network) {
  const count=evaluate(state.evidence,data).candidates.length;
  const choices=partitions(state,data).flatMap(p=>(["present","absent"] as const).map(value=>{
    const form={...newForm(p.site,value),text:exampleText(value),confirmed:true};
    let next=submitReport(state,form,"Simulated example",data);
    next=reviewReport(next,{type:"review",id:next.reports.at(-1)!.id,state:"approved",assumptions:true,comparable:true,reason:EXAMPLE_REASON,at:"2030-01-15T09:00:00Z"},data);
    const result=evaluate(next.evidence,data);
    return {site:p.site,value,count:result.candidates.length,informative:!!result.recommendation};
  })).filter(c=>c.count>0&&c.count<count).sort((a,b)=>Number(b.informative)-Number(a.informative)||a.count-b.count||a.site.localeCompare(b.site));
  return choices[0]??{site:data.sites.find(s=>s.accessible)?.code??"",value:"cannot_tell" as const};
}
export function canSubmit(form:FormState,data:Network=network){return form.confirmed&&!form.busy&&form.text.trim().length>0&&form.text.length<=500&&data.sites.some(s=>s.accessible&&s.code===form.site);}
export function submitReport(state:MissionState,form:FormState,provenance:ReportSnapshot["provenance"],data:Network=network):MissionState {
  if(!canSubmit(form,data)||state.reports.length>=2)return state;
  const id=`mission-report-${state.reports.length+1}`;
  const report=reportSchema.parse({id,site:form.site,text:form.text,value:form.value,confirmed:true,assumptions:form.assumptions,answers:form.answers,drafts:form.drafts,provenance});
  const last=form.drafts.at(-1);
  const observation:Observation={id,case_id:"coimbra-foam-demo",signal:"foam",site_code:form.site,value:form.value,confirmed:true,title:provenance,notes:form.text,observed_at:new Date().toISOString(),citizen_context:{source:last?.source==="ai"?"ai_draft":last?"parser_draft":"manual",assumptions:structuredClone(form.assumptions)}};
  const count=evaluate(state.evidence,data).candidates.length;
  return {...state,reports:[...state.reports,structuredClone(report)],evidence:{...state.evidence,observations:[...state.evidence.observations,observation],decisions:[...state.evidence.decisions,{report_id:id,revision:1,state:"unreviewed",assumptions_acknowledged:false,absence_comparable:false}],history:[...state.evidence.history,{id:state.evidence.history.length,at:observation.observed_at!,text:`${provenance} submitted at site ${form.site}; awaiting review.`,before:count,after:count}]}};
}
export function reviewReport(state:MissionState,action:Extract<Action,{type:"review"}>,data:Network=network) {
  const evidence=transition(state.evidence,action,data);
  if(evidence===state.evidence)return state;
  return {...state,evidence,reviewHistory:[...state.reviewHistory,structuredClone(action)]};
}
export function conflict(state:MissionState,data:Network=network){return {...state,evidence:transition(state.evidence,{type:"conflict",at:new Date().toISOString()},data)};}
export function recover(state:MissionState,data:Network=network) {
  const id=state.evidence.decisions.find(d=>d.report_id==="demo-conflict"&&d.state==="approved")?.report_id ?? [...state.reviewHistory].reverse().find(h=>h.state==="approved"&&state.evidence.decisions.some(d=>d.report_id===h.id&&d.state==="approved"))?.id;
  return id?reviewReport(state,{type:"review",id,state:"unreviewed",assumptions:false,comparable:false,at:new Date().toISOString()},data):state;
}
export function simulatedForm(site:string,value:Value){let form={...newForm(site,value),text:exampleText(value)};form=applyDraft(form,standardDraft(formInput(form)));return {...form,confirmed:true};}
export const caseSchema=z.object({version:z.literal(1),simulated:z.literal(true),label:z.string(),claimBoundary:z.literal(CLAIM),initialCandidateIds:z.array(z.string()),finalCandidateIds:z.array(z.string()),initialCount:z.number().int().nonnegative(),finalCount:z.number().int().nonnegative(),engineStatus:z.enum(["active","narrowed","conflict","awaiting_review","no_useful_next_site"]),result:z.string(),reports:z.array(reportSchema),evidence:z.array(z.object({id:z.string(),site_code:z.string(),value:z.enum(["present","absent","cannot_tell"]),title:z.string(),confirmed:z.boolean(),citizen_context:z.object({source:z.string(),assumptions:assumptionsSchema}).optional()}).passthrough()),decisions:z.array(z.object({report_id:z.string(),revision:z.number(),state:z.enum(["unreviewed","approved","uncertain","rejected"]),assumptions_acknowledged:z.boolean(),absence_comparable:z.boolean()})),reviews:z.array(z.object({type:z.literal("review"),id:z.string(),state:z.enum(["unreviewed","approved","uncertain","rejected"]),assumptions:z.boolean(),comparable:z.boolean(),reason:z.string().optional(),at:z.string()})),history:z.array(z.object({id:z.number(),at:z.string(),text:z.string(),before:z.number(),after:z.number()}))}).superRefine((s,ctx)=>{if(s.initialCount!==s.initialCandidateIds.length||s.finalCount!==s.finalCandidateIds.length)ctx.addIssue({code:"custom",message:"Candidate counts must match IDs"});});
export function caseSnapshot(state:MissionState,data:Network=network){const result=evaluate(state.evidence,data);return caseSchema.parse({version:1,simulated:true,label:LABEL,claimBoundary:CLAIM,initialCandidateIds:state.initial,finalCandidateIds:result.candidates,initialCount:state.initial.length,finalCount:result.candidates.length,engineStatus:result.status,result:result.message,reports:state.reports,evidence:state.evidence.observations,decisions:state.evidence.decisions,reviews:state.reviewHistory,history:state.evidence.history});}
