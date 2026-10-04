import { Evidence } from "./components/Evidence.tsx";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  type Action,
  type DemoState,
  type Network,
  network,
  seed,
  transition,
  evaluate,
  siteSummary,
  valueText,
} from "./demo.ts";
import Routes from "./Routes.tsx";
import { useDemoState,demoDispatch,getDemoInbox } from "./citizen/demo-store.ts";
import type { InvestigationResult, Value } from "../engine/index.ts";
import { useReducedMotion } from "./useReducedMotion.ts";
import { StreamMap } from "./components/StreamMap.tsx";
import { NetworkDiagram, NetworkList } from "./components/NetworkViews.tsx";
import { Link } from "./citizen/navigation.tsx";
import { contextLabels, contextText, unknownContext } from "../shared/observations.ts";
import { GeneralInbox } from "./components/GeneralInbox.tsx";
import type { InboxReport } from "./api.ts";
import { GuidedTour } from "./components/GuidedTour.tsx";
import { VolunteerOutreach } from "./components/VolunteerOutreach.tsx";

type View = "Map" | "List" | "Diagram";
const views: View[] = ["Map", "List", "Diagram"];
const now = () => new Date().toISOString();
interface Props {
  shared?: boolean;
  data?: Network;
  initialView?: View;
}
export default Routes;
export function DemoApp({ data = network, initialView = "Map", shared=false }: Props) {
  const [local, setState] = useState(() => seed(data, now()));
  const sharedState=useDemoState();
  const state=shared ? sharedState : local;
  return <Atlas data={data} initialView={initialView} state={state} result={evaluate(state,data)}
    generalInbox={shared ? getDemoInbox() : []}
    dispatch={action=>shared ? demoDispatch(action) : setState(current=>transition(current,action,data))} offline />;
}
interface LiveControls {
  inbox: InboxReport[];
  header: ReactNode;
  signal: string;
  pending: boolean;
  error: string;
  onDraft: (text: string) => Promise<{ value: Value; confidence: number } | null>;
  onExport: (format: "json" | "fhir") => Promise<void>;
}
export function Atlas({ data, initialView = "Map", state, result, dispatch, live, generalInbox=[], offline=false }: Props & {
  data: Network; state: DemoState; result: InvestigationResult; generalInbox?: InboxReport[];
  dispatch: (action: Action) => void | Promise<void>; live?: LiveControls; offline?: boolean;
}) {
  const [view, setView] = useState<View>(initialView);
  const [selected, setSelected] = useState<string | null>(null);
  const [tileFailure, setTileFailure] = useState(false);
  const reducedMotion = useReducedMotion();
  const [liveTab, setLiveTab] = useState("Queue");
  const [readReport, setReadReport] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [openedNext, setOpenedNext] = useState(false);
  const [tourTarget, setTourTarget] = useState<number | null>(null);
  const [resetKey, setResetKey] = useState(0);
  const approved = state.decisions.find(d => d.report_id === "seed-3")?.state === "approved";
  const narrowed = approved && result.candidates.length < evaluate(seed(data, ""), data).candidates.length;
  const tourComplete = [readReport, approved, narrowed, openedNext];
  const select = (code: string) => {
    setSelected(code);
    if (narrowed && code === result.recommendation?.siteCode) setOpenedNext(true);
  };
  function focusTour(step: number) {
    setTourTarget(step);
    if (step < 2) { setReadReport(true); setReportOpen(true); }
    if (step === 2) setView("Map");
    setTimeout(() => {
      const id = ["pending-report", "pending-checks", "network-view", "recommended-site", "load-conflict"][step]!;
      const element = document.getElementById(id);
      const control = step === 1 ? element?.querySelector<HTMLInputElement>("input") : element;
      control?.focus();
      control?.scrollIntoView({ block: "center" });
    }, 0);
  }
  function reset() {
    void dispatch({ type: "reset", at: now() });
    setSelected(null); setReadReport(false); setReportOpen(false); setOpenedNext(false); setTourTarget(null); setResetKey(key => key + 1);
  }
  const status =
    result.status === "conflict"
      ? "Conflict"
      : result.status === "narrowed"
        ? "Single"
        : "OK";
  function tabKey(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    const target =
      event.key === "ArrowRight"
        ? (index + 1) % 3
        : event.key === "ArrowLeft"
          ? (index + 2) % 3
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? 2
              : null;
    if (target !== null) {
      event.preventDefault();
      setView(views[target]!);
      document.getElementById(`tab-${views[target]}`)?.focus();
    }
  }
  return (
    <>
      {live?.header}
      {!live && <div className="prototype-banner" role="note">
        <span className="banner-dot" aria-hidden="true" />
        Demo mode: simulated data, nothing is saved or sent.
      </div>}
      <main id="main-content" tabIndex={-1} className={`workspace ${live ? "live-workspace" : "demo-workspace"}`}>
        {live?.error && <p className="api-error" role="alert">{live.error}</p>}
        {live?.pending && <p role="status">Saving and refreshing evidence...</p>}
        {!live && <div className="demo-toolbar"><GuidedTour complete={tourComplete} conflicting={state.observations.some(r => r.id === "demo-conflict")} onStep={focusTour} onClose={() => setTourTarget(null)}/><button onClick={reset}>Reset demo</button></div>}
        {live && <>
          <div className="review-tabs" role="tablist" aria-label="Reviewer views">
            {["Queue", "Map", "Case", "Outreach"].map((tab, i, tabs) => <button key={tab} id={`review-tab-${tab}`} role="tab" aria-selected={liveTab === tab} aria-controls={`review-panel-${tab}`} tabIndex={liveTab === tab ? 0 : -1} onClick={() => setLiveTab(tab)} onKeyDown={event => {
              const index = event.key === "ArrowRight" ? (i + 1) % tabs.length : event.key === "ArrowLeft" ? (i + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
              if (index !== null) { event.preventDefault(); setLiveTab(tabs[index]!); document.getElementById(`review-tab-${tabs[index]}`)?.focus(); }
            }}>{tab}</button>)}
          </div>
          <section id="review-panel-Queue" role="tabpanel" aria-labelledby="review-tab-Queue" hidden={liveTab !== "Queue"} className="review-queue">
            <p className="eyebrow">Reviewer area <span className="mode-chip mode-live">Live mode</span></p>
            <h1>Review reports</h1>
            <p className="queue-intro">Pending reports for the selected case. Check each observation before approving it.</p>
            <h2>Pending reports</h2>
            {state.observations.filter(r => state.decisions.find(d => d.report_id === r.id)?.state === "unreviewed").map(r => <Evidence key={r.id} observation={r} decision={state.decisions.find(d => d.report_id === r.id)!} dispatch={dispatch} live={live}/>)}
            {!state.decisions.some(d => d.state === "unreviewed") && <p className="queue-intro">No pending reports in this case.</p>}
            <GeneralInbox reports={live.inbox}/><details className="reviewed-reports"><summary>Reviewed reports</summary>{state.observations.filter(r => state.decisions.find(d => d.report_id === r.id)?.state !== "unreviewed").map(r => <Evidence key={r.id} observation={r} decision={state.decisions.find(d => d.report_id === r.id)!} dispatch={dispatch} live={live}/>)}</details>
          </section>
          <section id="review-panel-Outreach" role="tabpanel" aria-labelledby="review-tab-Outreach" hidden={liveTab !== "Outreach"}>
            <VolunteerOutreach sites={data.sites} recommendedSite={result.recommendation?.siteCode}/>
          </section>
        </>}
        <section id={live ? "review-panel-Map" : undefined} role={live ? "tabpanel" : undefined} hidden={!!live && liveTab !== "Map"} className={`atlas${tourTarget === 2 ? " tour-highlight" : ""}`} aria-labelledby={live ? "review-tab-Map" : "atlas-title"}>
          <div className="atlas-heading">
            <div>
              <p className="eyebrow">Study area 01 / Portugal</p>
              {live ? <h2 id="atlas-title">Stream map</h2> : <h1 id="atlas-title">Interactive demo</h1>}
              <p className="atlas-subtitle">
                Rio Mondego & its upstream branches
              </p>
            </div>
            <div className="atlas-index">
              <strong>{result.candidates.length} candidate reaches</strong>
              <br />
              <span>of {data.reaches.length} in this case</span>
            </div>
          </div>
          <p className="map-explanation">Blue stretches could contain the source of this signal. Grey stretches are excluded by approved reports under the case assumptions. Select a numbered site to read or add an observation.</p>
          <div className="view-toolbar">
            <div role="tablist" aria-label="Network view">
              {views.map((v, i) => (
                <button
                  id={`tab-${v}`}
                  key={v}
                  role="tab"
                  aria-selected={view === v}
                  aria-controls="network-view"
                  tabIndex={view === v ? 0 : -1}
                  onKeyDown={(e) => tabKey(e, i)}
                  onClick={() => setView(v)}
                >
                  {v}
                </button>
              ))}
            </div>
            <span className="scale-note">
              {view === "Map" ? "Geographic view" : "No map tiles required"}
            </span>
          </div>
          {tileFailure && (
            <div className="tile-alert" role="status">
              Online map tiles could not load. Showing the bundled study-area map.{" "}
              <button onClick={() => setView("Diagram")}>Use Diagram</button>
            </div>
          )}
          <div
            id="network-view"
            tabIndex={-1}
            role="tabpanel"
            aria-labelledby={`tab-${view}`}
          >
            {view === "Map" ? (!live || liveTab === "Map") && (
              <StreamMap
                data={data}
                result={result}
                state={state}
                reducedMotion={reducedMotion}
                offline={offline}
                onSelect={select}
                onTileFailure={() => setTileFailure(true)}
              />
            ) : view === "List" ? (
              <NetworkList
                data={data}
                result={result}
                state={state}
                reducedMotion={reducedMotion}
                onSelect={select}
              />
            ) : (
              <NetworkDiagram
                data={data}
                result={result}
                state={state}
                reducedMotion={reducedMotion}
                onSelect={select}
              />
            )}
          </div>
          <div className="legend" aria-label="Reach legend">
            <span>
              <i className="legend-line candidate" />
              Candidate
            </span>
            <span>
              <i className="legend-line eliminated" />
              Eliminated
            </span>
            <span>
              <i className="legend-line priority" />
              Priority area
            </span>
            <span className="legend-direction">
              Flow follows stored OSM way direction
            </span>
          </div>
          {selected && (
            <SitePanel
              key={selected}
              code={selected}
              data={data}
              state={state}
              dispatch={dispatch}
              onClose={() => setSelected(null)}
              live={live}
            />
          )}
          <footer className="atlas-footer">
            OpenStreetMap contributors (ODbL)
            <span>Topology & access awaiting human confirmation</span>
          </footer>
        </section>
        <aside
          id={live ? "review-panel-Case" : "case-panel"}
          role={live ? "tabpanel" : undefined}
          className={`case-panel${tourTarget === 2 ? " tour-count-highlight" : ""}`}
          tabIndex={-1}
          aria-labelledby={live ? "review-tab-Case" : "case-title"}
          hidden={!!live && liveTab !== "Case"}
        >
          <p className="eyebrow">{live ? "Case overview" : "Simulated investigation"}</p>
          <div className="case-title-row">
            <h2 id="case-title">{live ? live.signal : "Visible foam"}</h2>
            <span className={`status-tag status-${status.toLowerCase()}`}>
              {status}
            </span>
          </div>
          <p className="case-description">
            Review observations, follow the evidence, and decide where to check
            next.
          </p>
          <div className="candidate-count">
            <strong data-testid="candidate-count">
              {result.candidates.length}
            </strong>
            <span>
              candidate reaches
              <br />
              <small>of {data.reaches.length} in the study area</small>
            </span>
          </div>
          <p className="change-count">
            Before latest change <b>{state.before}</b>
            <span aria-hidden="true">→</span> After <b>{state.after}</b>
          </p>
          <div
            className="sr-only"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            {result.candidates.length} candidate reaches remaining. Status{" "}
            {status}.
          </div>
          <section
            className={`next-card ${status === "Conflict" ? "next-conflict" : ""}`}
            aria-labelledby="next-title"
          >
            <p className="eyebrow" id="next-title">
              Where should we check next?
            </p>
            {status === "Conflict" ? (
              <>
                <h3>Investigation paused</h3>
                <p>Evidence conflicts. A researcher must review.</p>
              </>
            ) : status === "Single" ? (
              <>
                <h3>Priority area for further investigation</h3>
                <p>
                  One candidate reach remains. Review the evidence and plan a
                  field check.
                </p>
              </>
            ) : result.recommendation ? (
              <>
                <h3>
                  Site {result.recommendation.siteCode}{" "}
                  <span>Check here next</span>
                </h3>
                <p>
                  A present observation leaves{" "}
                  {result.recommendation.present.length} candidate reaches. An
                  absent observation leaves{" "}
                  {result.recommendation.absent.length}, if persistence and
                  detectability are confirmed.
                </p>
                <button id="recommended-site" className={tourTarget === 3 ? "tour-highlight" : undefined} onClick={() => select(result.recommendation!.siteCode)}>
                  Open recommended site
                </button>
                {!live && <Link className="next-task-link" href="/task?mode=demo">Open next field task</Link>}
              </>
            ) : (
              <>
                <h3>Researcher review required</h3>
                <p>
                  {data.metadata.topology_review_state !== "prototype_confirmed"
                    ? "Geographic recommendations disabled: topology unreviewed"
                    : "No useful accessible observation site remains."}
                </p>
              </>
            )}
            {data.metadata.topology_review_state !== "prototype_confirmed" &&
              (status === "Conflict" || status === "Single") && (
                <p className="topology-note">
                  Geographic recommendations disabled: topology unreviewed
                </p>
              )}
          </section>
          <details className="model-assumptions">
            <summary>Case model & assumptions</summary>
            <p>
              One persistent origin region, normal downstream flow, and
              comparable observations. Present retains upstream candidates.
              Absent excludes upstream candidates only after persistence and
              detectability are acknowledged.
            </p>
          </details>
          {!live && <><div className="section-label">
            <h3>Observation review</h3>
            <span>{state.observations.length} records</span>
          </div>
          <div className="evidence-list" key={resetKey}>
            {state.observations.filter(r => r.id === "seed-3" || state.decisions.find(d => d.report_id === r.id)?.state === "unreviewed").map((r) => (
              <details key={r.id} open={r.id === "seed-3" ? reportOpen : undefined} className={`pending-report${r.id === "seed-3" && (tourTarget === 0 || tourTarget === 1) ? " tour-highlight" : ""}`} onToggle={event => { if (r.id === "seed-3") { setReportOpen(event.currentTarget.open); if (event.currentTarget.open) setReadReport(true); } }}>
                <summary id={r.id === "seed-3" ? "pending-report" : undefined}>Read {state.decisions.find(d => d.report_id === r.id)?.state === "unreviewed" ? "pending" : "reviewed"} citizen report at site {r.site_code}</summary>
                <Evidence observation={r} decision={state.decisions.find(d => d.report_id === r.id)!} dispatch={dispatch} checksId={r.id === "seed-3" ? "pending-checks" : undefined}/>
              </details>
            ))}
            {generalInbox.length>0&&<GeneralInbox reports={generalInbox}/>} <details className="reviewed-reports"><summary>Reviewed reports</summary>{state.observations.filter(r => r.id !== "seed-3" && state.decisions.find(d => d.report_id === r.id)?.state !== "unreviewed").map((r) => (
              <Evidence
                key={r.id}
                observation={r}
                decision={state.decisions.find((d) => d.report_id === r.id)!}
                dispatch={dispatch}
                live={live}
              />
            ))}</details>
          </div></>}
          {!live && <div className="demo-actions">
            <button
              id="load-conflict"
              className={tourTarget === 4 ? "tour-highlight" : undefined}
              disabled={state.observations.some(
                (r) => r.id === "demo-conflict",
              )}
              onClick={() => dispatch({ type: "conflict", at: now() })}
            >
              Load conflicting evidence
            </button>
          </div>}
          {live && <div className="demo-actions"><button disabled={live.pending} onClick={()=>void live.onExport("json")}>Export JSON</button><button disabled={live.pending} onClick={()=>void live.onExport("fhir")}>Export FHIR</button></div>}
          <details className="history">
            <summary>
              Evidence history <span>{state.history.length} changes</span>
            </summary>
            <ol>
              {[...state.history].reverse().map((h) => (
                <li key={h.id}>
                  <time dateTime={h.at}>
                    {new Date(h.at).toLocaleTimeString("en-GB")}
                  </time>
                  <p>
                    {h.text}
                    {!live && <small>
                      {h.before} → {h.after} candidates
                    </small>}
                  </p>
                </li>
              ))}
            </ol>
          </details>
          <p className="claim">
            Supports investigation planning. Does not identify chemicals or
            certify water safety.
          </p>
        </aside>
      </main>
    </>
  );
}
function SitePanel({
  code,
  data,
  state,
  dispatch,
  onClose,
  live,
}: {
  code: string;
  data: Network;
  state: DemoState;
  dispatch: (a: Action) => void | Promise<void>;
  live?: LiveControls;
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [value, setValue] = useState<Value>("present");
  const [added, setAdded] = useState(false);
  const [draftText,setDraftText]=useState("");
  const [draftNote,setDraftNote]=useState("");
  const [drafting,setDrafting]=useState(false);
  const [submissionId,setSubmissionId]=useState<string | undefined>();
  const [observedAt,setObservedAt]=useState<string | undefined>();
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const site = data.sites.find((s) => s.code === code)!;
  const reach = data.reaches.find((r) => r.id === site.reachId)!;
  return (
    <section className="site-panel" aria-labelledby="site-title">
      <div className="site-panel-heading">
        <h2 id="site-title" tabIndex={-1} ref={heading}>
          Observation site {code}
        </h2>
        <button onClick={onClose} aria-label={`Close site ${code}`}>
          Close
        </button>
      </div>
      <p>
        {reach.names.join(" / ") || "Unnamed tributary"}{" "}
        <span className="coordinate-text">
          {site.coordinates[1]!.toFixed(5)}, {site.coordinates[0]!.toFixed(5)}
        </span>
      </p>
      <p>{siteSummary(state, code)}</p>
      <small>
        StreamTrace identifiers, not official OneAquaHealth sites. Access
        unreviewed.
      </small>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setAdded(false);
          const id=submissionId ?? crypto.randomUUID(), at=observedAt ?? now();
          setSubmissionId(id);setObservedAt(at);
          try {
            await dispatch({ type: "add", site: code, value, at, ...(live ? {id,notes:draftText} : {}) });
            setAdded(true);setSubmissionId(undefined);setObservedAt(undefined);
          } catch { /* The parent presents the server error. Keep the id for retry. */ }
        }}
      >
        <fieldset>
          <legend>{live ? "Submit an observation" : "Add a simulated observation"}</legend>
          {(["present", "absent", "cannot_tell"] as Value[]).map((v) => (
            <label key={v}>
              <input
                type="radio"
                name="value"
                checked={value === v}
                onChange={() => {
                  setValue(v);
                  setAdded(false);setSubmissionId(undefined);setObservedAt(undefined);
                }}
              />
              {valueText(v)}
            </label>
          ))}
        </fieldset>
        {live && <>
          <label className="draft-label">Observation notes
            <textarea maxLength={500} value={draftText} onChange={e=>{setDraftText(e.target.value);setSubmissionId(undefined);setObservedAt(undefined);}} />
          </label>
          <button type="button" disabled={live.pending || drafting || !draftText.trim()} onClick={async()=>{
            setDrafting(true);setDraftNote("");
            try {const draft=await live.onDraft(draftText);
              if(draft){setValue(draft.value);setSubmissionId(undefined);setObservedAt(undefined);setDraftNote("AI draft loaded. Check the value before submitting your observation.");}
              else setDraftNote("Draft unavailable. Select the observation value yourself.");
            } finally {setDrafting(false);}
          }}>Suggest a draft</button>
          {draftNote && <p role="status">{draftNote}</p>}
          <p className="evidence-provenance">Submitting confirms your observation. It remains pending until a reviewer approves it.</p>
        </>}
        <button type="submit" disabled={live?.pending || drafting}>{live ? "Submit observation" : "Add observation"}</button>
        {added && <span role="status">Added for review.</span>}
      </form>
    </section>
  );
}
