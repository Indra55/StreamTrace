import { z } from "zod";
import type { Value } from "../../engine/index.ts";
import { draftInputSchema, parseDraft } from "../../shared/ai.ts";
export { draftOutputSchema as draftResponseSchema, taskResponseSchema as taskSchema } from "../../shared/ai.ts";
export const signals=[{id:"colour",label:"Colour",icon:"◒"},{id:"foam",label:"Foam",icon:"◌"},{id:"discharge",label:"Discharge",icon:"↧"},{id:"litter",label:"Litter",icon:"▱"},{id:"dead_fish",label:"Dead fish",icon:"◇"}] as const;
export { signalSchema, assumptionsSchema, emptyAssumptions } from "../../shared/observations.ts";
import { signalSchema, assumptionsSchema, emptyAssumptions, referenceAlphabet } from "../../shared/observations.ts";
export type Signal=z.infer<typeof signalSchema>;
export type Assumptions=z.infer<typeof assumptionsSchema>;
export function newReference() {let ref="";while(ref.length<16){for(const n of crypto.getRandomValues(new Uint8Array(24))){if(n<Math.floor(256/referenceAlphabet.length)*referenceAlphabet.length)ref+=referenceAlphabet[n%referenceAlphabet.length];if(ref.length===16)break;}}return ref;}
export const contextSchema=z.object({source:z.enum(["ai_draft","parser_draft","manual"]),assumptions:assumptionsSchema,site_distance_m:z.number().int().min(0).max(300).optional()});
export type CitizenContext=z.infer<typeof contextSchema>;
export const draftSchema=z.object({id:z.uuid(),observedAt:z.iso.datetime().default(()=>new Date().toISOString()),caseId:z.string(),general:z.boolean().default(false),site:z.string(),distance:z.number().int().min(0).max(300).optional(),signal:signalSchema,value:z.enum(["present","absent","cannot_tell"]),text:z.string().max(500),assumptions:assumptionsSchema,source:z.enum(["ai_draft","parser_draft","manual"])});
export type CitizenDraft=z.infer<typeof draftSchema>;
export const draftKey="streamtrace.unfinished-report.v1";
export function freshDraft():CitizenDraft{return {id:crypto.randomUUID(),observedAt:new Date().toISOString(),caseId:"",general:false,site:"",signal:"foam",value:"cannot_tell",text:"",assumptions:{...emptyAssumptions},source:"manual"};}
export function restoreDraft():CitizenDraft {
  try {const parsed=draftSchema.safeParse(JSON.parse(window.localStorage.getItem(draftKey) ?? "null"));if(parsed.success)return parsed.data;}catch{/* Storage can be disabled. */}
  return freshDraft();
}
export function saveDraft(draft:CitizenDraft):boolean {try{window.localStorage.setItem(draftKey,JSON.stringify(draftSchema.parse(draft)));return true;}catch{return false;}}
export function draftText(draft:CitizenDraft) {
  return draft.text.trim() || (draft.value === "present" ? `I see ${draft.signal.replaceAll("_", " ")}.` : draft.value === "absent" ? `I do not see ${draft.signal.replaceAll("_", " ")}.` : `I cannot tell whether ${draft.signal.replaceAll("_", " ")} is visible.`);
}
export function parseDescription(draft:CitizenDraft):CitizenDraft {
  if(draft.general)return {...draft,source:"manual"};
  const parsed=parseDraft(draftInputSchema.parse({text:draftText(draft),signal:draft.signal,siteHint:draft.site}));
  return {...draft,value:parsed.flags.length || draft.value==="cannot_tell" ? parsed.value : draft.value,source:"parser_draft"};
}
export const valueLabels:{[K in Value]:string}={present:"Seen",absent:"Not seen",cannot_tell:"Cannot tell"};
export function nearestSite(latitude:number,longitude:number,sites:readonly {code:string;coordinates:readonly number[]}[]) {
  if(!Number.isFinite(latitude)||!Number.isFinite(longitude))return null;
  const rad=(n:number)=>n*Math.PI/180;
  const found=sites.map(s=>{const [lon,lat]=s.coordinates;if(lon===undefined||lat===undefined)return {code:s.code,distance:Infinity};const a=Math.sin(rad(lat-latitude)/2)**2+Math.cos(rad(latitude))*Math.cos(rad(lat))*Math.sin(rad(lon-longitude)/2)**2;return {code:s.code,distance:6371000*2*Math.asin(Math.min(1,Math.sqrt(a)))};}).sort((a,b)=>a.distance-b.distance)[0];
  return found && found.distance<=300 ? {code:found.code,distance:Math.round(found.distance)} : null;
}
const receiptsKey="streamtrace.receipts.v1";
export function rememberReceipt(ref:string,simulated:boolean,caseId:string|null=null) {try{const existing=JSON.parse(window.localStorage.getItem(receiptsKey)??"{}");window.localStorage.setItem(receiptsKey,JSON.stringify({...existing,[ref]:{simulated,caseId}}));}catch{/* No coordinates or notes in receipts. */}}
export function simulatedReceipt(ref:string):boolean {try{const receipt=JSON.parse(window.localStorage.getItem(receiptsKey)??"{}")[ref];return receipt===true || receipt?.simulated===true;}catch{return false;}}
export const statusSchema=z.object({state:z.enum(["pending","approved","rejected","uncertain"])});

export function receiptCase(ref:string):string|null {try{return JSON.parse(window.localStorage.getItem(receiptsKey)??"{}")[ref]?.caseId??null;}catch{return null;}}
