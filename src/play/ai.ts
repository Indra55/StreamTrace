import { z } from "zod";
import { clarificationQuestions, DRAFT_PROMPT_VERSION, draftInputSchema, draftOutputSchema, parseDraft, taskResponseSchema, type DraftInput, type Draft } from "../../shared/ai.ts";
export const fallbackLabel = "Standard text (AI unavailable)";
export function standardDraft(input: DraftInput): Draft {
  const parsed = parseDraft(input);
  return { ...parsed, status: "fallback", source: "fallback", model: null, prompt_version: DRAFT_PROMPT_VERSION, latency_ms: 0,
    questions: clarificationQuestions(parsed.value, parsed.assumptions, input.round, input.answers) };
}
export const taskInputSchema = z.object({ site:z.string(), signal:z.literal("foam"), facts:taskResponseSchema.shape.facts }).strict();
export type TaskInput = z.infer<typeof taskInputSchema>;
export function standardTask(input:TaskInput): z.infer<typeof taskResponseSchema> {
  return {site:input.site, facts:input.facts, text_en:`From a safe public place at site ${input.site}, look for foam. Seen leaves ${input.facts.seen_leaves} possible reaches; not seen leaves ${input.facts.not_seen_leaves}, only after researcher checks. Reply Seen, Not seen or Cannot tell. Do not enter the water.`, source:"template", model:null, prompt_version:"task-v2-1", latency_ms:0};
}
function canonical(value:unknown):string {
  if(Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if(value && typeof value === "object") return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  return JSON.stringify(value);
}
async function keyFor(endpoint:string,input:unknown) {
  const bytes=new TextEncoder().encode(canonical({version:3,endpoint,input}));
  const digest=await crypto.subtle.digest("SHA-256",bytes);
  return "streamtrace.play.ai.v3."+Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,"0")).join("");
}
/** This client has no generic public request method and no persistence endpoints. */
export class MissionAI {
  private cache=new Map<string,unknown>();
  private pending=new Map<string,Promise<unknown>>();
  private controllers=new Set<AbortController>();
  private generation=0;
  cancel(){this.generation++;for(const controller of this.controllers)controller.abort();this.controllers.clear();this.pending.clear();}
  draft(input:DraftInput,regenerate=false){const clean=draftInputSchema.parse(input);return this.run("/api/draft",clean,draftOutputSchema,()=>standardDraft(clean),regenerate, value=>value.signal===clean.signal);}
  task(input:TaskInput,regenerate=false){const clean=taskInputSchema.parse(input);return this.run("/api/demo/task",clean,taskResponseSchema,()=>standardTask(clean),regenerate,value=>value.site===clean.site && canonical(value.facts)===canonical(clean.facts));}
  private async run<T>(endpoint:"/api/draft"|"/api/demo/task",input:unknown,schema:z.ZodType<T>,fallback:()=>T,regenerate:boolean,valid:(value:T)=>boolean):Promise<T> {
    const generation=this.generation, key=await keyFor(endpoint,input);
    if(generation!==this.generation) throw new DOMException("Cancelled","AbortError");
    if(!regenerate){
      let cached=this.cache.get(key);
      if(!cached)try{cached=JSON.parse(sessionStorage.getItem(key)??"null");}catch{/* Memory cache still works. */}
      const parsed=schema.safeParse(cached);
      if(parsed.success && valid(parsed.data)){this.cache.set(key,parsed.data);return parsed.data;}
      const pending=this.pending.get(key);if(pending)return pending as Promise<T>;
    }
    const controller=new AbortController();this.controllers.add(controller);
    let timer:ReturnType<typeof setTimeout>;
    let job!:Promise<T>;
    job=(async()=>{
      let response:T;
      try {
        response=await Promise.race([
          (async()=>{const r=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(input),signal:controller.signal});if(!r.ok)throw new Error("AI unavailable");const value=schema.parse(await r.json());if(!valid(value))throw new Error("Mismatched response");return value;})(),
          new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error("Deadline"));},5000);controller.signal.addEventListener("abort",()=>reject(new DOMException("Cancelled","AbortError")),{once:true});}),
        ]);
      }catch{response=fallback();}
      finally{clearTimeout(timer!);this.controllers.delete(controller);}
      if(generation!==this.generation)throw new DOMException("Cancelled","AbortError");
      // A superseded regeneration cannot overwrite the new cache entry.
      if(this.pending.get(key)===job){this.cache.set(key,response);try{sessionStorage.setItem(key,JSON.stringify(response));}catch{/* Storage may be blocked. */}}
      return response;
    })();
    this.pending.set(key,job);
    try{return await job;}finally{if(this.pending.get(key)===job)this.pending.delete(key);}
  }
}
