import { caseSnapshot, type MissionState } from "./model.ts";
import type { Network } from "../demo.ts";
import { ContextSummary } from "../components/ReportPanels.tsx";
export function CaseFile({state,data}:{state:MissionState;data:Network}) {
  const snapshot=caseSnapshot(state,data);
  function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(snapshot,null,2)],{type:"application/json"}));const a=document.createElement("a");a.href=url;a.download="streamtrace-simulated-case.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),0);}
  return <article id="case-file" className="mission-case">
    <p>{snapshot.label}</p><h2>{snapshot.initialCount} → {snapshot.finalCount} candidate reaches</h2><p>{snapshot.result}</p><p>{snapshot.claimBoundary}</p>
    <div className="mission-actions no-print"><button onClick={download}>Download JSON</button><button onClick={()=>window.print()}>Print report</button></div>
    <h3>Evidence trail</h3>{snapshot.evidence.map(r=>{const d=snapshot.decisions.find(d=>d.report_id===r.id)!;const report=snapshot.reports.find(s=>s.id===r.id);return <section key={r.id}><h4>{r.title} · site {r.site_code} · {r.value}</h4><p>{d.state} / revision {d.revision} · Assumptions: {d.assumptions_acknowledged?"acknowledged":"not acknowledged"} · Comparable absence: {d.absence_comparable?"yes":"no"}</p>{report?<><blockquote>{report.text}</blockquote><p>{report.provenance} · citizen confirmed</p><ContextSummary answers={report.assumptions}/><p>Clarification answers: {JSON.stringify(report.answers)}</p>{report.drafts.map((draft,i)=><details key={i}><summary>Draft {i+1}: {draft.source==="ai"?"Live AI draft":"Standard text (AI unavailable)"}</summary><pre>{JSON.stringify(draft,null,2)}</pre></details>)}</>:<p>Simulated seed or conflict evidence. Not a player report.</p>}</section>;})}
    <h3>Decisions and reasons</h3>{snapshot.reviews.map((r,i)=><p key={i}>{r.id}: {r.state}. Checks: assumptions {String(r.assumptions)}, comparable {String(r.comparable)}. {r.reason}</p>)}
    <h3>History including withdrawals</h3><ol>{snapshot.history.map(h=><li key={h.id}>{h.text} ({h.before} → {h.after})</li>)}</ol>
    <details><summary>Candidate reach IDs</summary><p>Initial: {snapshot.initialCandidateIds.join(", ")}</p><p>Final: {snapshot.finalCandidateIds.join(", ")}</p></details>
  </article>;
}
