import { useSyncExternalStore } from "react";
import { seed,transition,evaluate,network,demoCase,type DemoState,type Action } from "../demo.ts";
import { newReference, type CitizenDraft } from "./model.ts";
let state:DemoState=seed(network,new Date().toISOString());
const references=new Map<string,string>();
const inbox=new Map<string,CitizenDraft>();
const listeners=new Set<()=>void>();
const notify=()=>{for(const listener of listeners)listener();};
export function getDemoInbox(){return [...inbox.values()].map(r=>({id:r.id,case_id:null,signal:"other",site_code:r.site||null,value:r.value,notes:r.text,observed_at:r.observedAt} as const));}
export function getDemoState(){return state;}
export function useDemoState(){return useSyncExternalStore(listener=>{listeners.add(listener);return()=>{listeners.delete(listener);};},getDemoState,getDemoState);}
export function demoDispatch(action:Action){state=transition(state,action,network);notify();}
export function addDemoReport(draft:CitizenDraft) {
  const existing=[...references].find(([,id])=>id===draft.id)?.[0];if(existing)return existing;
  const ref=newReference();references.set(ref,draft.id);
  if(draft.general){inbox.set(draft.id,{...draft,assumptions:{...draft.assumptions}});state={...state};notify();return ref;}
  const before=evaluate(state,network).candidates.length;
  state={...state,observations:[...state.observations,{id:draft.id,case_id:demoCase.id,signal:draft.signal,site_code:draft.site,value:draft.value,confirmed:true,title:"Citizen simulated observation",notes:draft.text,observed_at:draft.observedAt,citizen_context:{source:draft.source,assumptions:draft.assumptions,site_distance_m:draft.distance}}],
    decisions:[...state.decisions,{report_id:draft.id,revision:1,state:"unreviewed",assumptions_acknowledged:false,absence_comparable:false}],history:[...state.history,{id:state.history.length,at:new Date().toISOString(),text:`Citizen submitted a simulated ${draft.signal.replaceAll("_"," ")} observation at ${draft.site}; pending review.`,before,after:before}],sequence:state.sequence+1};notify();return ref;
}
export function demoStatus(ref:string){const id=references.get(ref);if(id&&inbox.has(id))return {state:"pending"};const d=state.decisions.find(d=>d.report_id===id);return d ? {state:d.state==="unreviewed" ? "pending" : d.state} : null;}
export function resetDemo(){references.clear();inbox.clear();state=seed(network,new Date().toISOString());notify();}
export function demoTask() {
  const result=evaluate(state,network),site=result.recommendation;
  const approved=state.decisions.filter(d=>d.state==="approved").length;
  if(!site || !approved || result.status==="conflict" || network.metadata.geographic_recommendations_enabled===false)return null;
  return {case_id:demoCase.id,case_title:demoCase.title,facts:{candidate_count:result.candidates.length,present_count:site.present.length,absent_count:site.absent.length,approved_observations:approved,recommendations_enabled:true as const},site_code:site.siteCode,signal:"foam",instruction:`From a safe public path at site ${site.siteCode}, look for foam. Report seen, not seen or cannot tell.`,safety:"Stay on safe public paths. Do not enter the water. Skip the observation if it is unsafe.",reason:`This site separates ${result.candidates.length} candidate reaches into groups of ${site.present.length} and ${site.absent.length}.`,source:"template" as const,simulated:true};
}
