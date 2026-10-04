import { Opening, Process } from "./Story.tsx";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { network, evaluate, type Network, type Action } from "../demo.ts";
import { Link } from "../citizen/navigation.tsx";
import { useReducedMotion } from "../useReducedMotion.ts";
import { StreamMap } from "../components/StreamMap.tsx";
import { Evidence, type ReviewControls } from "../components/Evidence.tsx";
import { ContextSummary } from "../components/ReportPanels.tsx";
import volunteers from "../data/volunteers.json";
import { type DraftInput, type taskResponseSchema } from "../../shared/ai.ts";
import type { z } from "zod";
import { MissionAI, fallbackLabel, standardTask } from "./ai.ts";
import { applyDraft, canSubmit, CLAIM, conflict, createMission, EXAMPLE_REASON, exampleText, formInput, LABEL, newForm, partitions, recover, reviewReport, simulatedForm, submitReport, suggestedReport, type FormState, type MissionState } from "./model.ts";
import { timeline, canAdvance } from "./timeline.ts";
import { MissionReport } from "./Report.tsx";
import { CaseFile } from "./CaseFile.tsx";
import { Count, useSound } from "./effects.tsx";
import { clickAction, useAutoplay } from "./drivers.ts";
import "./play.css";
const emptyChecks={assumptions:false,comparable:false,reason:""};
export default function Mission({data=network,initialState}: {data?:Network;initialState?:MissionState}) {
  const [state,setState]=useState(()=>initialState??createMission(data));
  const suggestion=useMemo(()=>suggestedReport(initialState??createMission(data),data),[data,initialState]);
  const [chapter,setChapter]=useState(0),[form,setForm]=useState(()=>newForm(suggestion.site,suggestion.value));
  const [checks,setChecks]=useState(emptyChecks),[inspected,setInspected]=useState(false),[task,setTask]=useState<z.infer<typeof taskResponseSchema>|null>(null),[taskBusy,setTaskBusy]=useState(false);
  const [run,setRun]=useState(0),[effectsOff,setEffectsOff]=useState(false),[elapsed,setElapsed]=useState(false),[skipNote,setSkipNote]=useState("");
  const query=new URLSearchParams(location.search),[autoplay,setAutoplay]=useState(query.get("autoplay")==="1"),[speed,setSpeed]=useState(1);
  const systemReduced=useReducedMotion(),reduced=systemReduced||effectsOff,record=query.get("record")==="1"&&autoplay&&!reduced;
  const ai=useRef(new MissionAI()),epoch=useRef(0),stage=useRef<HTMLDivElement>(null),heading=useRef<HTMLHeadingElement>(null),sound=useSound();
  const result=useMemo(()=>evaluate(state.evidence,data),[state.evidence,data]),partitionsNow=useMemo(()=>partitions(state,data),[state,data]);
  const info=timeline[chapter]!,reportIndex=chapter===7?1:0,report=state.reports[reportIndex];
  const reviewing=chapter===4||(chapter===7&&!!report),role=reviewing?"researcher":info.role;
  const chosen=partitionsNow.find(p=>p.site===state.selected);
  const reviewAction=(action:Action)=>{if(action.type!=="review")return;setState(current=>reviewReport(current,action,data));sound.ping();};
  function cancel(){epoch.current++;ai.current.cancel();setTaskBusy(false);setForm(f=>({...f,busy:false}));}
  useEffect(()=>()=>{epoch.current++;ai.current.cancel();},[]);
  useEffect(()=>{heading.current?.focus();setElapsed(false);const timer=setTimeout(()=>setElapsed(true),info.seconds*1000);return()=>clearTimeout(timer);},[chapter,run,info.seconds]);
  function enter(next:number){cancel();setChapter(next);setChecks(emptyChecks);setInspected(false);if(next===7){setForm(newForm(state.selected??"","absent"));}sound.ping();}
  const ready=()=>canAdvance(chapter,state,data)&&!form.busy&&!taskBusy;
  function advance(){if(ready()&&chapter<9)enter(chapter+1);}
  function update(patch:Partial<FormState>){
    if("text" in patch||"site" in patch||"value" in patch){epoch.current++;ai.current.cancel();}
    setForm(f=>({...f,...patch,confirmed:patch.confirmed??false}));
  }
  async function assistant(regenerate=false,next=form){
    if(next.busy)return;
    const version=++epoch.current;setForm({...next,busy:true,confirmed:false});
    try{const draft=await ai.current.draft(formInput(next),regenerate);if(version===epoch.current)setForm(applyDraft(next,draft));}
    catch{if(version===epoch.current)setForm(f=>({...f,busy:false}));}
  }
  function answers(){const questions=form.drafts.at(-1)?.questions??[];if(form.round>=2||questions.some(q=>!form.replies[q.id]))return;const additions:DraftInput["answers"]={...form.answers};for(const q of questions){const answer=form.replies[q.id]!;additions[q.id]=answer.startsWith("Yes")?"yes":answer.startsWith("No")?"no":"unknown";}void assistant(false,{...form,answers:additions,round:(form.round+1) as 1|2});}
  function submit(){if(!canSubmit(form,data)||state.reports.length!==reportIndex)return;setState(s=>submitReport(s,form,"Player report",data));setChecks(emptyChecks);setInspected(false);}
  function pick(site:string){if(!partitionsNow.some(p=>p.site===site))return;setState(s=>({...s,selected:site,attempts:[...s.attempts,site]}));}
  function taskInput(){const p=partitionsNow.find(p=>p.site===state.selected);return p?{site:p.site,signal:"foam" as const,facts:{total:result.candidates.length,seen_leaves:p.present.length,not_seen_leaves:p.absent.length}}:null;}
  async function requestTask(){const input=taskInput();if(!input||taskBusy)return;const version=++epoch.current;setTaskBusy(true);try{const response=await ai.current.task(input);if(version===epoch.current)setTask(response);}finally{if(version===epoch.current)setTaskBusy(false);}}
  function skip(){
    cancel();let next=state;let usedExample=false;
    if(chapter===2&&!next.reports[0]){next=submitReport(next,simulatedForm(suggestion.site,suggestion.value),"Simulated example",data);usedExample=true;}
    if((chapter===4||chapter===7)&&next.reports[reportIndex]){const r=next.reports[reportIndex]!;const d=next.evidence.decisions.find(d=>d.report_id===r.id)!;if(d.state==="unreviewed")next=reviewReport(next,{type:"review",id:r.id,state:r.value==="cannot_tell"?"uncertain":"approved",assumptions:true,comparable:true,reason:EXAMPLE_REASON,at:new Date().toISOString()},data);}
    if(chapter===5){next={...next,selected:evaluate(next.evidence,data).recommendation?.siteCode??null};}
    if(chapter===6&&!task){const input=taskInput();if(input)setTask(standardTask(input));}
    if(chapter===7&&next.selected&&!next.reports[1]){next=submitReport(next,simulatedForm(next.selected,"absent"),"Simulated example",data);const r=next.reports[1]!;next=reviewReport(next,{type:"review",id:r.id,state:"approved",assumptions:true,comparable:true,reason:EXAMPLE_REASON,at:new Date().toISOString()},data);usedExample=true;}
    if(evaluate(next.evidence,data).status==="conflict")next=recover(next,data);
    setState(next);setSkipNote(usedExample?"Skipped with a labelled simulated example and standard draft.":"Skipped. Submitted player reports are preserved; missing review steps use simulated checks.");
    if(chapter<9){setChapter(chapter+1);setChecks(emptyChecks);setInspected(false);if(chapter===6)setForm(newForm(next.selected??"","absent"));}
  }
  function restart(){cancel();setState(initialState??createMission(data));setChapter(0);setForm(newForm(suggestion.site,suggestion.value));setChecks(emptyChecks);setInspected(false);setTask(null);setSkipNote("");setRun(n=>n+1);}
  // Each scripted action is a normal component handler or a click on an enabled control.
  function driverStep():boolean {
    if(result.status==="conflict")return clickAction(stage.current,'[data-action="withdraw"]');
    if((chapter===2||chapter===7)&&!report){
      if(!form.text)return clickAction(stage.current,'[data-action="example"]');
      if(form.busy)return false;
      if(!form.drafts.length)return clickAction(stage.current,'[data-action="assistant"]');
      const questions=form.round<2?form.drafts.at(-1)?.questions??[]:[];
      if(questions.length){if(questions.some(q=>!form.replies[q.id]))return clickAction(stage.current,'[data-action="example-answers"]');return clickAction(stage.current,'[data-action="answers"]');}
      if(!form.confirmed)return clickAction(stage.current,'[data-action="confirm"]');
      return clickAction(stage.current,'[data-action="submit"]');
    }
    if(reviewing&&report&&state.evidence.decisions.find(d=>d.report_id===report.id)?.state==="unreviewed"){
      if(!inspected)return clickAction(stage.current,'[data-action="context"]');
      const article=stage.current?.querySelector<HTMLElement>("#review");
      if(!checks.assumptions)return clickAction(article??null,'input[type="checkbox"]');
      if(report.value==="absent"&&!checks.comparable)return clickAction(article??null,'.review-checks label:nth-of-type(2) input');
      if(report.value==="absent"&&checks.reason.length<10){setChecks(c=>({...c,reason:EXAMPLE_REASON}));return true;}
      const buttons=Array.from(article?.querySelectorAll<HTMLButtonElement>(".review-actions button")??[]),button=buttons.find(b=>b.textContent===(report.value==="cannot_tell"?"Mark uncertain":"Approve"));if(button&&!button.disabled){button.click();return true;}return false;
    }
    if(chapter===5&&result.recommendation&&state.selected!==result.recommendation.siteCode)return clickAction(stage.current,'[data-action="best"]');
    if(chapter===6&&!task&&!taskBusy&&state.selected)return clickAction(stage.current,'[data-action="task"]');
    return false;
  }
  useAutoplay({enabled:autoplay,reduced,speed,chapter,step:driverStep,advance,ready});
  const reviewControls:ReviewControls={...checks,onChange:patch=>setChecks(c=>({...c,...patch}))};
  const reviewPanel=report&&<div id="review" className="mission-highlight"><button data-action="context" aria-expanded={inspected} onClick={()=>setInspected(v=>!v)}>Inspect citizen context</button>{inspected&&<><blockquote>{report.text}</blockquote><ContextSummary answers={report.assumptions}/><p>{report.value==="cannot_tell"?"Cannot tell is not narrowing evidence. Choose Mark uncertain.":"Unknown context remains visible. Check the assumptions before approving."}</p></>}<Evidence key={report.id} observation={state.evidence.observations.find(r=>r.id===report.id)!} decision={state.evidence.decisions.find(d=>d.report_id===report.id)!} dispatch={reviewAction} controls={reviewControls} exampleReason/><button disabled={state.evidence.observations.some(r=>r.id==="demo-conflict")} onClick={()=>setState(s=>conflict(s,data))}>Explore conflicting evidence</button></div>;
  const reportPanel=<MissionReport form={form} data={data} onChange={update} onExample={()=>update({text:exampleText(form.value)})} onAssistant={regenerate=>void assistant(regenerate)} onAnswers={answers} onSubmit={submit}/>;
  let content;
  switch(chapter){
    case 0:content=<Opening key={run} reduced={reduced}/>;break;
    case 1:content=<Process key={run} reduced={reduced}/>;break;
    case 2:content=report?<p role="status">Report submitted to the in-memory reviewer queue. Continue to see what arrived.</p>:reportPanel;break;
    case 3:content=<section id="carry"><h2>Arrived in the reviewer queue</h2><blockquote>{report?.text}</blockquote><p>{report?.provenance} · Citizen confirmed · Pending review</p>{report&&<><ContextSummary answers={report.assumptions}/><p>Context replies: {JSON.stringify(report.answers)}</p>{report.drafts.map((d,i)=><p key={i}>Draft {i+1}: {d.source==="ai"?"Live AI draft":fallbackLabel} · {d.value}</p>)}</>}</section>;break;
    case 4:content=reviewPanel;break;
    case 5:content=<section id="pick"><h2>Try a site</h2>{result.recommendation?<><p>Find a useful split with the smallest worst-case remainder. You can try as many sites as you like.</p><div className="mission-sites">{partitionsNow.map(p=><button key={p.site} aria-pressed={state.selected===p.site} onClick={()=>pick(p.site)}>Site {p.site}</button>)}</div>{chosen&&<p role="status">Site {chosen.site}: Seen leaves {chosen.present.length}; Not seen leaves {chosen.absent.length}. {chosen.site===result.recommendation.siteCode?"Best pick: matches the engine recommendation.":`The engine's best pick leaves at most ${result.recommendation.worstPartition}. Try again.`}</p>}<button data-action="best" onClick={()=>pick(result.recommendation!.siteCode)}>Use the best pick</button></>:<p>{result.message} There is no further site to choose. Continue to see the remaining workflow without inventing another reduction.</p>}</section>;break;
    case 6:content=<section id="task"><p className="mission-disclosure">Mockup. No messages are sent. Volunteers are fictional.</p>{state.selected?<><p>Fictional identities are associated illustratively with site {state.selected}.</p><button data-action="task" disabled={taskBusy} onClick={()=>void requestTask()}>Draft outreach task</button>{taskBusy&&<p role="status">Drafting task…</p>}{task&&<><p className="ai-badge">{task.source==="ai"?"Live AI":fallbackLabel}</p><blockquote>{task.text_en}</blockquote></>}<div className="mission-messages">{volunteers.slice(0,3).map((v,i)=><article key={v.id}><strong>{v.name}</strong><span>{["Delivered","Replied","No reply"][i]}</span>{i===1&&<p>“Not seen. I checked from the path.”</p>}</article>)}</div></>:<p>No useful next task is available. Outreach waits for researcher review.</p>}</section>;break;
    case 7:content=state.selected?(report?reviewPanel:reportPanel):<p>No useful accessible follow-up site remains. No additional report or count reduction is manufactured.</p>;break;
    case 8:content=<CaseFile state={state} data={data}/>;break;
    default:content=<section id="next"><h2>Future work</h2><ul>{["Validated field access and stream topology","Real volunteer messaging and consent","Longer-term signal and flow modelling","Field trials with researchers and citizens","External interoperability validation"].map(item=><li key={item}>{item} <strong>Not implemented</strong></li>)}</ul><div className="mission-actions"><button onClick={restart}>Replay mission</button><Link href="/demo">Interactive demo</Link><Link href="/report?mode=live">Live reporting</Link></div><p>{CLAIM}</p></section>;
  }
  const introduction=chapter<2;
  return <main id="main-content" tabIndex={-1} className={`mission ${introduction?"mission-story":""} ${record?"mission-record":""} ${reduced?"mission-reduced":""}`} ref={stage}>
    <header className="mission-header"><Link href="/">streamtrace<span className="wordmark-dot">.</span></Link><span className="mission-edition">Follow the foam</span>
      <div className={`mission-navigation ${record?"record-hidden":""}`}><button className="quiet-button" onClick={skip}>Skip</button><details className="mission-settings"><summary aria-label="Mission options">•••</summary><div className="mission-transport"><button onClick={restart}>Restart</button><label><input type="checkbox" checked={effectsOff||systemReduced} disabled={systemReduced} onChange={e=>setEffectsOff(e.target.checked)}/>Reduce effects</label><button aria-pressed={sound.enabled} onClick={sound.toggle}>Sound {sound.enabled?"on":"off"}</button><button aria-pressed={autoplay} onClick={()=>setAutoplay(v=>!v)}>{autoplay?"Pause autoplay":"Autoplay"}</button><label>Speed<select value={speed} onChange={e=>setSpeed(Number(e.target.value))}><option value={.75}>0.75×</option><option value={1}>1×</option><option value={1.5}>1.5×</option></select></label></div></details></div>
    </header>
    <p className="mission-disclosure-line">{LABEL}</p>
    {introduction?<div key={`${chapter}-${run}`} className="story-stage">{content}</div>:<>
      <div className="mission-title"><div><span className="story-kicker">{String(chapter+1).padStart(2,"0")} / {role==="citizen"?"From the riverbank":"At the research desk"}</span><h1 ref={heading} tabIndex={-1}>{info.title}</h1><p className="mission-caption" aria-live="polite" aria-atomic="true">{info.caption}</p></div>{chapter>=4&&<div className="mission-count"><Count value={result.candidates.length} reduced={reduced}/><span>possible reaches</span></div>}</div>
      {skipNote&&<p className="mission-skip" role="status">{skipNote}</p>}
      {result.status==="conflict"&&<aside role="alert" className="mission-conflict"><h2>Paused: researcher review needed</h2><p>Approved observations contradict one another. Withdraw the triggering approval to restore the prior candidate set.</p><button data-action="withdraw" onClick={()=>setState(s=>recover(s,data))}>Withdraw and continue</button></aside>}
      <div className={`mission-workspace role-${role} chapter-${chapter}`}>
        <section className={`mission-device ${role==="citizen"?"mission-phone":"mission-desk"}`} aria-label={role==="citizen"?"Citizen phone":"Researcher workspace"}>
          <div className="device-bar">{role==="citizen"?"Field note":"Research notebook"}<span>Now playing · {role}</span></div><motion.div key={`${chapter}-${run}-${role}`} initial={reduced?false:{opacity:0,y:12}} animate={{opacity:1,y:0}} transition={{duration:.65}}>{content}</motion.div>
        </section>
        {(chapter===4||chapter===5||reviewing)&&<div className={`mission-map ${result.status==="conflict"?"is-paused":""}`}><StreamMap data={data} state={state.evidence} result={result} reducedMotion={reduced} offline onSelect={chapter===5?pick:()=>{}} onTileFailure={()=>{}} missionPresentation/></div>}
      </div>
    </>}
    <footer className={`mission-footer ${record?"record-hidden":""}`}><div className="mission-progress"><span>{String(chapter+1).padStart(2,"0")} <i>/ 10</i></span><progress aria-label="Mission progress" value={chapter+1} max={10}/></div>{chapter<9&&<button className="mission-primary" disabled={!ready()} onClick={advance}>{chapter===0?"Why your observation matters":chapter===1?"Follow the foam":"Continue"}<span aria-hidden="true">↗</span></button>}{reduced&&<button className="quiet-button" onClick={()=>{if(!driverStep())advance();}}>Next autoplay step</button>}</footer>
    <div className="mission-fineprint"><p>AI responses are cached temporarily in this browser tab. Reports are not saved to the server.</p>{!introduction&&<p>{CLAIM}</p>}</div>
  </main>;
}
