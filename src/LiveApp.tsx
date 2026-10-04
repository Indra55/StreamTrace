import { useEffect,useRef,useState,type FormEvent } from "react";
import { Atlas } from "./App.tsx";
import { ApiError,request,casesSchema,snapshotSchema,viewState,serverAnalysis,type LiveCase,type Snapshot,parseQueue,type InboxReport } from "./api.ts";
import { GeneralInbox } from "./components/GeneralInbox.tsx";
import { draftOutputSchema } from "../shared/ai.ts";
import { caseTitle } from "../shared/observations.ts";
import type { Action } from "./demo.ts";
import type { Value } from "../engine/index.ts";

import { Link,navigate } from "./citizen/navigation.tsx";

export default function LiveApp({loginOnly=false}:{loginOnly?:boolean}) {
  const [authenticated,setAuthenticated]=useState(false),[cases,setCases]=useState<LiveCase[]>([]);
  const [inbox,setInbox]=useState<InboxReport[]>([]);
  const [selected,setSelected]=useState(""),[snapshot,setSnapshot]=useState<Snapshot|null>(null);
  const [pending,setPending]=useState(false),[initializing,setInitializing]=useState(!loginOnly);
  const [error,setError]=useState(""),[before,setBefore]=useState(0),[queueCount,setQueueCount]=useState(0);
  const [email,setEmail]=useState(""),[password,setPassword]=useState("");
  const current=useRef<Snapshot|null>(null),generation=useRef(0),busy=useRef(false);
  current.current=snapshot;
  function expire() {generation.current++;setAuthenticated(false);setSnapshot(null);setCases([]);setInbox([]);setSelected("");current.current=null;navigate("/login",true);}
  async function load(id:string,signal?:AbortSignal) {
    const version=++generation.current;
    const [data,queue]=await Promise.all([
      request<unknown>(`/api/cases/${id}/export?format=json`,{signal}),
      request<unknown>("/api/reviewer/queue",{signal}),
    ]);
    const parsed=snapshotSchema.parse(data);
    if(parsed.case.simulated) throw new Error("Only live cases are available in the reviewer area.");
    const parsedQueue=parseQueue(queue),count=parsedQueue.rows.filter(r=>r.case_id===id).length;
    if(version!==generation.current || signal?.aborted) return;
    setBefore(current.current?.case.id===id ? current.current.analysis.candidates.length : parsed.graph.reaches.length);
    setSnapshot(parsed);setInbox(parsedQueue.inbox);setQueueCount(count);setSelected(id);setError("");
  }
  async function discover(signal?:AbortSignal) {
    const rows=casesSchema.parse(await request<unknown>("/api/reviewer/cases",{signal})).filter(c=>!c.simulated);
    if(signal?.aborted) return;
    const queue=parseQueue(await request<unknown>("/api/reviewer/queue",{signal}));
    if(signal?.aborted)return;
    setCases(rows);setInbox(queue.inbox);setAuthenticated(true);
    if(rows.length){
      const requested=new URLSearchParams(location.search).get("case");
      const next=rows.find(c=>c.id===requested) ?? rows.find(c=>queue.rows.some(r=>r.case_id===c.id)) ?? rows[0]!;
      await load(next.id,signal);
    }
  }
  useEffect(()=>{
    if(loginOnly || authenticated) {setInitializing(false);return;}
    const controller=new AbortController();
    setInitializing(true);
    async function initialize() {
      try {await discover(controller.signal);}
      catch(e) {
        if(controller.signal.aborted)return;
        if(e instanceof ApiError && e.status===401) expire();
        else setError(e instanceof Error ? e.message : "Unable to load reports.");
      }
      finally {if(!controller.signal.aborted) setInitializing(false);}
    }
    void initialize();return()=>{controller.abort();generation.current++;};
  },[loginOnly]);
  async function signIn(event:FormEvent) {
    event.preventDefault();if(busy.current)return;busy.current=true;setPending(true);setError("");
    try {await request("/api/login",{method:"POST",body:JSON.stringify({email,password})});setPassword("");await discover();navigate("/review",true);}
    catch(e) {expire();setError(e instanceof ApiError && e.status===401 ? "Email or password is incorrect. Try again." : e instanceof Error ? e.message : "Sign in failed. Try again.");}
    finally {busy.current=false;setPending(false);}
  }
  async function signOut() {
    if(busy.current)return;busy.current=true;setPending(true);
    try {await request("/api/logout",{method:"POST",body:"{}"});expire();setError("");}
    catch(e) {setError(e instanceof Error ? e.message : "Sign out failed.");}
    finally {busy.current=false;setPending(false);}
  }
  async function refresh(id=selected) {
    if(!id || busy.current)return;busy.current=true;setPending(true);setError("");
    try {await load(id);}
    catch(e) {if(e instanceof ApiError && [401,403].includes(e.status))expire();setError(e instanceof Error ? e.message : "Unable to refresh the case.");}
    finally {busy.current=false;setPending(false);}
  }
  async function dispatch(action:Action) {
    const active=current.current;
    if(!active || busy.current) throw new Error("Wait for the current request to finish.");
    busy.current=true;setPending(true);setError("");
    try {
      if(action.type==="review") await request("/api/reviews",{method:"POST",body:JSON.stringify({report_id:action.id,state:action.state,assumptions_acknowledged:action.state==="approved" && action.assumptions,absence_comparable:action.state==="approved" && action.comparable,approval_reason:action.state==="approved" ? action.reason ?? "" : ""})});
      else if(action.type==="add") await request("/api/reports",{method:"POST",body:JSON.stringify({id:action.id ?? crypto.randomUUID(),case_id:active.case.id,signal:active.case.signal,site_code:action.site,value:action.value,confirmed:true,origin:"web",observed_at:action.at,notes:action.notes ?? ""})});
      else throw new Error("Demo actions are unavailable in the live workspace.");
      try {await load(active.case.id);}
      catch(e) {if(e instanceof ApiError && [401,403].includes(e.status))expire();setError("Saved, but the case could not refresh. Reload it before reviewing further.");}
    } catch(e) {if(e instanceof ApiError && [401,403].includes(e.status))expire();setError(e instanceof Error ? e.message : "The change could not be saved.");throw e;}
    finally {busy.current=false;setPending(false);}
  }
  async function draft(text:string):Promise<{value:Value;confidence:number}|null> {
    try {return draftOutputSchema.parse(await request("/api/draft",{method:"POST",body:JSON.stringify({text,signal:current.current?.case.signal}),signal:AbortSignal.timeout(6500)}));}
    catch{return null;}
  }
  async function download(format:"json"|"fhir") {
    if(!selected)return;
    try {
      const payload=await request<unknown>(`/api/cases/${selected}/export?format=${format}`);
      const url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:format==="fhir" ? "application/fhir+json" : "application/json"}));
      const link=document.createElement("a");link.href=url;link.download=`streamtrace-${selected}.${format==="fhir" ? "fhir.json" : "json"}`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    } catch(e) {if(e instanceof ApiError && [401,403].includes(e.status))expire();setError(e instanceof Error ? e.message : "Export failed.");}
  }
  const controls=<section className="session-toolbar" aria-label="Reviewer session">
    <label>Case <select aria-label="Investigation case" value={selected} disabled={pending} onChange={e=>void refresh(e.target.value)}>{cases.map(c=><option key={c.id} value={c.id}>{caseTitle(c)}</option>)}</select></label>
    <span>{queueCount} pending reviews</span><Link href={`/task?mode=live&case=${encodeURIComponent(selected)}`}>Open field task</Link><button disabled={pending} onClick={()=>void refresh()}>Refresh case</button><button disabled={pending} onClick={()=>void signOut()}>Sign out</button>
  </section>;
  if(!loginOnly && authenticated && snapshot) return <Atlas data={snapshot.graph} state={viewState(snapshot,before)} result={serverAnalysis(snapshot)} dispatch={dispatch}
    live={{inbox,header:controls,signal:snapshot.case.signal,pending,error,onDraft:draft,onExport:download}} />;
  return <main id="main-content" tabIndex={-1} className="connection-page">
    <p className="eyebrow">{loginOnly ? "Reviewer access" : "Reviewer area"}</p>
    <h1>{loginOnly ? "Reviewer sign in" : "Review reports"}</h1>
    {initializing ? <p role="status">Loading reviewer session...</p> : loginOnly ? <>
      <p>Sign in to review live citizen reports.</p>
      <form className="login-form" onSubmit={signIn}>
        <label>Email<input type="email" autoComplete="username" value={email} onChange={e=>setEmail(e.target.value)} required /></label>
        <label>Password<input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} required /></label>
        <button disabled={pending} type="submit">{pending ? "Signing in..." : "Sign in"}</button>
      </form>
      <p>No reviewer credentials? <Link href="/demo">Open the interactive demo</Link>.</p>
    </> : authenticated ? <>
      <span className="mode-chip mode-live">Live mode</span>
      <GeneralInbox reports={inbox}/><h2>No live investigation cases yet</h2>
      <p>Your session is connected. A live case must be available before you can review reports.</p>
      <button disabled={pending} onClick={()=>void discover().catch(e=>{if(e instanceof ApiError && e.status===401)expire();else setError(e instanceof Error ? e.message : "Unable to load cases.");})}>Reload cases</button>
      <button disabled={pending} onClick={()=>void signOut()}>Sign out</button>
    </> : <button onClick={()=>location.reload()}>Retry connection</button>}
    {error && <p className="api-error" role="alert">{error}</p>}
  </main>;
}
