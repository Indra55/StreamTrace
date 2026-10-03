import cachedNetwork from "../data/coimbra.network.json" with { type: "json" };
import {
  fromDatabase,
  type StoredObservation,
  type StoredDecision,
} from "../engine/adapter.ts";
import {
  investigate,
  compileGraph,
  type InvestigationResult,
  type Value,
} from "../engine/index.ts";
export type Network = typeof cachedNetwork;
export const network: Network = cachedNetwork;
export const demoCase = { id: "coimbra-foam-demo", signal: "foam" };
export interface Observation extends StoredObservation {
  title: string;
}
export interface HistoryEvent {
  id: number;
  at: string;
  text: string;
  before: number;
  after: number;
}
export interface DemoState {
  observations: Observation[];
  decisions: StoredDecision[];
  history: HistoryEvent[];
  before: number;
  after: number;
  sequence: number;
}
export type Action =
  | { type: "add"; site: string; value: Value; at: string }
  | {
      type: "review";
      id: string;
      state: StoredDecision["state"];
      assumptions: boolean;
      comparable: boolean;
      at: string;
    }
  | { type: "conflict"; at: string }
  | { type: "reset"; at: string };
export const valueText = (value: Value) =>
  ({ present: "Present", absent: "Absent", cannot_tell: "Cannot tell" })[value];
export const valueSymbol = (value: Value) =>
  ({ present: "+", absent: "−", cannot_tell: "?" })[value];
export function evaluate(
  state: Pick<DemoState, "observations" | "decisions">,
  data: Network,
): InvestigationResult {
  const result = investigate(
    data,
    demoCase,
    fromDatabase(state.observations, state.decisions),
  );
  // The public recommendation is gated separately from evidence elimination.
  return data.metadata.topology_review_state === "prototype_confirmed"
    ? result
    : { ...result, recommendation: null };
}
function observation(
  id: string,
  site: string,
  value: Value,
  title: string,
): Observation {
  return {
    id,
    case_id: demoCase.id,
    signal: demoCase.signal,
    site_code: site,
    value,
    confirmed: true,
    title,
  };
}
export function seed(data: Network, at: string): DemoState {
  const upstream = compileGraph(data).upstream;
  const branches = data.sites
    .filter((s) => s.placement === "tributary_confluence")
    .sort(
      (a, b) =>
        upstream.get(b.reachId)!.size - upstream.get(a.reachId)!.size ||
        a.code.localeCompare(b.code),
    );
  const first = branches[0];
  if (!first) throw new Error("Demo requires a tributary observation site");
  const firstObservation = observation(
    "seed-1",
    first.code,
    "absent",
    "Simulated branch observation",
  );
  const approved = (report_id: string): StoredDecision => ({
    report_id,
    revision: 1,
    state: "approved",
    assumptions_acknowledged: true,
    absence_comparable: true,
  });
  const firstState = {
    observations: [firstObservation],
    decisions: [approved("seed-1")],
  };
  const firstResult = evaluate(firstState, data);
  const mains = data.sites
    .filter((s) => s.placement === "main_stem_partition")
    .sort(
      (a, b) =>
        upstream.get(b.reachId)!.size - upstream.get(a.reachId)!.size ||
        a.code.localeCompare(b.code),
    );
  const second = mains.find((s) => {
    const count = firstResult.candidates.filter((id) =>
      upstream.get(s.reachId)!.has(id),
    ).length;
    return count > 3 && count < firstResult.candidates.length;
  });
  if (!second) throw new Error("Demo requires an informative main-stem site");
  const observations = [
    firstObservation,
    observation(
      "seed-2",
      second.code,
      "present",
      "Simulated main-stem observation",
    ),
  ];
  const decisions = [approved("seed-1"), approved("seed-2")];
  const secondResult = evaluate({ observations, decisions }, data);
  const pendingChoices = data.sites
    .filter((s) => s.code !== first.code && s.code !== second.code)
    .map((site) => {
      const present = secondResult.candidates.filter((id) =>
        upstream.get(site.reachId)!.has(id),
      ).length;
      return {
        site,
        present,
        absent: secondResult.candidates.length - present,
      };
    })
    .filter((s) => s.present > 0 && s.absent > 0)
    .sort(
      (a, b) =>
        Math.max(a.present, a.absent) - Math.max(b.present, b.absent) ||
        a.site.code.localeCompare(b.site.code),
    );
  const pending = pendingChoices[0]?.site;
  if (!pending)
    throw new Error("Demo requires an informative pending observation");
  observations.push(
    observation(
      "seed-3",
      pending.code,
      "absent",
      "Pending simulated observation",
    ),
  );
  decisions.push({
    report_id: "seed-3",
    revision: 1,
    state: "unreviewed",
    assumptions_acknowledged: false,
    absence_comparable: false,
  });
  return {
    observations,
    decisions,
    before: firstResult.candidates.length,
    after: secondResult.candidates.length,
    sequence: 3,
    history: [
      {
        id: 0,
        at,
        text: `Demo reviewer approved simulated absence at site ${first.code}.`,
        before: data.reaches.length,
        after: firstResult.candidates.length,
      },
      {
        id: 1,
        at,
        text: `Demo reviewer approved simulated presence at site ${second.code}.`,
        before: firstResult.candidates.length,
        after: secondResult.candidates.length,
      },
      {
        id: 2,
        at,
        text: `Demo reviewer loaded pending simulated absence at site ${pending.code}; live approval required.`,
        before: secondResult.candidates.length,
        after: secondResult.candidates.length,
      },
    ],
  };
}
export function transition(
  state: DemoState,
  action: Action,
  data: Network,
): DemoState {
  if (action.type === "reset") return seed(data, action.at);
  const before = evaluate(state, data).candidates.length;
  let observations = [...state.observations],
    decisions = [...state.decisions],
    sequence = state.sequence;
  let text = "";
  if (action.type === "add" || action.type === "conflict") {
    if (
      action.type === "conflict" &&
      observations.some((r) => r.id === "demo-conflict")
    )
      return state;
    const conflictTarget = state.observations.find((r) => r.id === "seed-1")!;
    const site =
      action.type === "conflict" ? conflictTarget.site_code : action.site;
    if (!data.sites.some((s) => s.code === site))
      throw new Error("Unknown site");
    sequence++;
    const id =
      action.type === "conflict" ? "demo-conflict" : `observation-${sequence}`;
    const value =
      action.type === "conflict"
        ? conflictTarget.value === "absent"
          ? "present"
          : "absent"
        : action.value;
    observations.push(
      observation(
        id,
        site,
        value,
        action.type === "conflict"
          ? "Contradictory simulated observation"
          : "Added simulated observation",
      ),
    );
    decisions.push({
      report_id: id,
      revision: 1,
      state: action.type === "conflict" ? "approved" : "unreviewed",
      assumptions_acknowledged: action.type === "conflict",
      absence_comparable: action.type === "conflict",
    });
    text =
      action.type === "conflict"
        ? `Demo reviewer loaded contradictory approved evidence at site ${site}.`
        : `Demo reviewer added ${valueText(value).toLowerCase()} at site ${site}; awaiting review.`;
  } else {
    const r = observations.find((r) => r.id === action.id),
      d = decisions.find((d) => d.report_id === action.id);
    if (!r || !d) throw new Error("Unknown observation");
    if (
      action.state === "approved" &&
      (!action.assumptions ||
        (r.value === "absent" && !action.comparable) ||
        r.value === "cannot_tell")
    )
      return state;
    const acknowledged = action.state === "approved" && action.assumptions,
      comparable = action.state === "approved" && action.comparable;
    if (
      d.state === action.state &&
      d.assumptions_acknowledged === acknowledged &&
      d.absence_comparable === comparable
    )
      return state;
    decisions = decisions.map((x) =>
      x.report_id === r.id
        ? {
            ...x,
            revision: x.revision + 1,
            state: action.state,
            assumptions_acknowledged: acknowledged,
            absence_comparable: comparable,
          }
        : x,
    );
    text = `Demo reviewer ${action.state === "unreviewed" ? "withdrew approval for" : action.state === "uncertain" ? "marked uncertain" : action.state} ${valueText(r.value).toLowerCase()} at site ${r.site_code}.`;
  }
  const after = evaluate({ observations, decisions }, data).candidates.length;
  return {
    observations,
    decisions,
    sequence,
    before,
    after,
    history: [
      ...state.history,
      { id: state.history.length, at: action.at, text, before, after },
    ],
  };
}
export function siteSummary(state: DemoState, code: string): string {
  const reports = state.observations.filter((r) => r.site_code === code);
  if (!reports.length) return "No observations";
  return reports
    .map((r) => {
      const d = state.decisions.find((d) => d.report_id === r.id)!;
      return `${d.state === "uncertain" ? "? Uncertain" : `${valueSymbol(r.value)} ${valueText(r.value)}`} (${d.state})`;
    })
    .join("; ");
}
