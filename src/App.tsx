import { useEffect, useRef, useState, type KeyboardEvent } from "react";
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
import type { Value } from "../engine/index.ts";
import { useReducedMotion } from "./useReducedMotion.ts";
import { StreamMap } from "./components/StreamMap.tsx";
import { NetworkDiagram, NetworkList } from "./components/NetworkViews.tsx";

type View = "Map" | "List" | "Diagram";
const views: View[] = ["Map", "List", "Diagram"];
const now = () => new Date().toISOString();
interface Props {
  data?: Network;
  initialView?: View;
}
export default function App({ data = network, initialView = "Map" }: Props) {
  const [state, setState] = useState(() => seed(data, now()));
  const [view, setView] = useState<View>(initialView);
  const [selected, setSelected] = useState<string | null>(null);
  const [tileFailure, setTileFailure] = useState(false);
  const reducedMotion = useReducedMotion();
  const result = evaluate(state, data);
  const dispatch = (action: Action) =>
    setState((current) => transition(current, action, data));
  const reviewer = useRef<HTMLElement>(null);
  const select = (code: string) => setSelected(code);
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
      <a className="skip-link" href="#case-panel">
        Skip to case review
      </a>
      <header className="masthead">
        <a className="wordmark" href="#">
          StreamTrace<span>Field atlas / Coimbra</span>
        </a>
        <button
          className="reviewer-entry"
          onClick={() => {
            reviewer.current?.focus();
            reviewer.current?.scrollIntoView({
              behavior: "auto",
              block: "start",
            });
          }}
        >
          Try as reviewer <span aria-hidden="true">↗</span>
        </button>
      </header>
      <div className="prototype-banner" role="note">
        <span className="banner-dot" aria-hidden="true" />
        Prototype demo: simulated observations, not real reports
      </div>
      <main className="workspace">
        <section className="atlas" aria-labelledby="atlas-title">
          <div className="atlas-heading">
            <div>
              <p className="eyebrow">Study area 01 / Portugal</p>
              <h1 id="atlas-title">Following the water.</h1>
              <p className="atlas-subtitle">
                Rio Mondego & its upstream branches
              </p>
            </div>
            <div className="atlas-index">
              {data.reaches.length} reaches
              <br />
              <span>{data.sites.length} observation sites</span>
            </div>
          </div>
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
              Background map tiles could not load. The network is still
              available.{" "}
              <button onClick={() => setView("Diagram")}>Use Diagram</button>
            </div>
          )}
          <div
            id="network-view"
            role="tabpanel"
            aria-labelledby={`tab-${view}`}
          >
            {view === "Map" ? (
              <StreamMap
                data={data}
                result={result}
                state={state}
                reducedMotion={reducedMotion}
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
            />
          )}
          <footer className="atlas-footer">
            OpenStreetMap contributors (ODbL)
            <span>Topology & access awaiting human confirmation</span>
          </footer>
        </section>
        <aside
          id="case-panel"
          className="case-panel"
          tabIndex={-1}
          ref={reviewer}
          aria-labelledby="case-title"
        >
          <p className="eyebrow">Reviewer sandbox / simulated case</p>
          <div className="case-title-row">
            <h2 id="case-title">Visible foam</h2>
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
                <button onClick={() => select(result.recommendation!.siteCode)}>
                  Open recommended site
                </button>
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
          <div className="section-label">
            <h3>Observation review</h3>
            <span>{state.observations.length} records</span>
          </div>
          <div className="evidence-list">
            {state.observations.map((r) => (
              <Evidence
                key={r.id}
                observation={r}
                decision={state.decisions.find((d) => d.report_id === r.id)!}
                dispatch={dispatch}
              />
            ))}
          </div>
          <div className="demo-actions">
            <button
              disabled={state.observations.some(
                (r) => r.id === "demo-conflict",
              )}
              onClick={() => dispatch({ type: "conflict", at: now() })}
            >
              Load conflicting evidence
            </button>
            <button
              onClick={() => {
                dispatch({ type: "reset", at: now() });
                setSelected(null);
              }}
            >
              Reset demo
            </button>
          </div>
          <details className="history" open>
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
                    <small>
                      {h.before} → {h.after} candidates
                    </small>
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
function Evidence({
  observation: r,
  decision: d,
  dispatch,
}: {
  observation: DemoState["observations"][number];
  decision: DemoState["decisions"][number];
  dispatch: (a: Action) => void;
}) {
  const [assumptions, setAssumptions] = useState(false),
    [comparable, setComparable] = useState(false);
  const change = (state: typeof d.state) =>
    dispatch({
      type: "review",
      id: r.id,
      state,
      assumptions,
      comparable,
      at: now(),
    });
  return (
    <article
      className="evidence"
      aria-label={`${r.title} at site ${r.site_code}`}
    >
      <div className="evidence-heading">
        <span className="site-badge">{r.site_code}</span>
        <strong>{valueText(r.value)}</strong>
        <span className={`review-tag review-${d.state}`}>
          {d.state === "unreviewed" ? "Pending" : d.state}
        </span>
      </div>
      <p className="evidence-provenance">
        {r.title}
        <span>Demo reviewer / simulated observation</span>
      </p>
      <div className="review-checks">
        <label>
          <input
            type="checkbox"
            checked={assumptions}
            onChange={(e) => setAssumptions(e.target.checked)}
          />
          I acknowledge the case assumptions
        </label>
        {r.value === "absent" && (
          <label>
            <input
              type="checkbox"
              checked={comparable}
              onChange={(e) => setComparable(e.target.checked)}
            />
            Absence is comparable, persistent and detectable
          </label>
        )}
      </div>
      <div className="review-actions">
        <button
          onClick={() => change("approved")}
          disabled={
            !assumptions ||
            (r.value === "absent" && !comparable) ||
            r.value === "cannot_tell"
          }
        >
          Approve
        </button>
        <button onClick={() => change("rejected")}>Reject</button>
        <button onClick={() => change("uncertain")}>Mark uncertain</button>
        <button
          onClick={() => change("unreviewed")}
          disabled={d.state === "unreviewed"}
        >
          Withdraw
        </button>
      </div>
    </article>
  );
}
function SitePanel({
  code,
  data,
  state,
  dispatch,
  onClose,
}: {
  code: string;
  data: Network;
  state: DemoState;
  dispatch: (a: Action) => void;
  onClose: () => void;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  const [value, setValue] = useState<Value>("present");
  const [added, setAdded] = useState(false);
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
        onSubmit={(e) => {
          e.preventDefault();
          dispatch({ type: "add", site: code, value, at: now() });
          setAdded(true);
        }}
      >
        <fieldset>
          <legend>Add a simulated observation</legend>
          {(["present", "absent", "cannot_tell"] as Value[]).map((v) => (
            <label key={v}>
              <input
                type="radio"
                name="value"
                checked={value === v}
                onChange={() => {
                  setValue(v);
                  setAdded(false);
                }}
              />
              {valueText(v)}
            </label>
          ))}
        </fieldset>
        <button type="submit">Add observation</button>
        {added && <span role="status">Added for review.</span>}
      </form>
    </section>
  );
}
