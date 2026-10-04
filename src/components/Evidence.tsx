export interface ReviewControls { assumptions: boolean; comparable: boolean; reason: string; onChange: (patch: Partial<Omit<ReviewControls, "onChange">>) => void }
import { useState } from "react";
import { type Action, type DemoState, valueText } from "../demo.ts";
import { contextLabels, contextText, unknownContext } from "../../shared/observations.ts";
const now = () => new Date().toISOString();
export function Evidence({
  observation: r,
  decision: d,
  dispatch,
  live,
  checksId,
  controls,
  exampleReason,
}: {
  observation: DemoState["observations"][number];
  decision: DemoState["decisions"][number];
  dispatch: (a: Action) => void | Promise<void>;
  live?: { pending: boolean };
  checksId?: string;
  controls?: ReviewControls;
  exampleReason?: boolean;
}) {
  const [local, setLocal] = useState({ assumptions: false, comparable: false, reason: "" });
  const { assumptions, comparable, reason } = controls ?? local;
  const update = (patch: Partial<typeof local>) => controls ? controls.onChange(patch) : setLocal(v => ({ ...v, ...patch }));
  const setAssumptions = (assumptions: boolean) => update({ assumptions });
  const setComparable = (comparable: boolean) => update({ comparable });
  const setReason = (reason: string) => update({ reason });
  const unknown = unknownContext(r.citizen_context?.assumptions);
  const needsReason = r.value === "absent" && unknown.length > 0;
  const change = (state: typeof d.state) =>
    void Promise.resolve(dispatch({
      type: "review",
      id: r.id,
      state,
      assumptions,
      comparable,
      reason: state === "approved" ? reason.trim() : "",
      at: now(),
    })).catch(() => undefined);
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
        <span>{live ? "Citizen observation" : "Simulated citizen observation"}</span>
      </p>
      {r.citizen_context?.source==="ai_draft" && <span className="ai-badge">AI draft</span>}
      {r.notes && <p className="observation-notes">{r.notes}</p>}
      {r.observed_at && <p className="evidence-provenance">Observed <time dateTime={r.observed_at}>{new Date(r.observed_at).toLocaleString("en-GB")}</time></p>}
      <div className="review-checks" id={checksId}>
        <details className="evidence-assumptions"><summary>Read approval assumptions</summary><p>One persistent source, normal downstream flow, and comparable observations. An absence can eliminate reaches only if the signal persists and could be detected.</p></details>
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
      <div className="approval-row">
      {r.value === "absent" && <section className="approval-context" aria-label="Citizen context answers">
        <h3>Citizen context</h3>
        <dl>{Object.entries(contextLabels).map(([key,label]) => <div key={key} className={unknown.includes(key as keyof typeof contextLabels)?"context-unknown":""}><dt>{label}</dt><dd>{contextText(r.citizen_context?.assumptions[key as keyof typeof contextLabels])}</dd></div>)}</dl>
        {needsReason && <label className="approval-reason">Reason for approving with unknown answers<textarea minLength={10} maxLength={500} value={reason} onChange={e=>setReason(e.target.value)} aria-describedby={`reason-help-${r.id}`}/><small id={`reason-help-${r.id}`}>At least 10 characters. This reason is saved in the review event.</small></label>}
      </section>}
      {exampleReason && needsReason && <button onClick={() => setReason("Simulated field check confirms persistence and visibility despite unknown citizen context.")}>Use example reason</button>}
      <div className="review-actions">
        <button
          onClick={() => change("approved")}
          disabled={
            live?.pending || !assumptions ||
            (r.value === "absent" && !comparable) || (needsReason && reason.trim().length < 10) ||
            r.value === "cannot_tell"
          }
        >
          Approve
        </button>
        <button disabled={live?.pending} onClick={() => change("rejected")}>Reject</button>
        <button disabled={live?.pending} onClick={() => change("uncertain")}>Mark uncertain</button>
        <button
          onClick={() => change("unreviewed")}
          disabled={live?.pending || d.state === "unreviewed"}
        >
          Withdraw
        </button>
      </div>
      </div>
    </article>
  );
}
