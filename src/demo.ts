import cachedNetwork from "../data/coimbra.network.json";
import {
  fromDatabase,
  type StoredObservation,
  type StoredDecision,
} from "../engine/adapter.ts";
import {
  investigate,
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
  const observations = [
    observation("seed-1", "004", "present", "Simulated main-stem observation"),
    observation("seed-2", "001", "absent", "Simulated branch observation"),
    observation(
      "seed-3",
      "003",
      "absent",
      "Pending simulated branch observation",
    ),
  ];
  const decisions: StoredDecision[] = observations.map((r, i) => ({
    report_id: r.id,
    revision: 1,
    state: i < 2 ? "approved" : "unreviewed",
    assumptions_acknowledged: i < 2,
    absence_comparable: i < 2,
  }));
  const after = evaluate({ observations, decisions }, data).candidates.length;
  return {
    observations,
    decisions,
    before: data.reaches.length,
    after,
    sequence: 3,
    history: [
      {
        id: 0,
        at,
        text: "Demo reviewer loaded two approved simulated observations and one pending observation.",
        before: data.reaches.length,
        after,
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
    const site = action.type === "conflict" ? "004" : action.site;
    if (!data.sites.some((s) => s.code === site))
      throw new Error("Unknown site");
    sequence++;
    const id =
      action.type === "conflict" ? "demo-conflict" : `observation-${sequence}`;
    const value = action.type === "conflict" ? "absent" : action.value;
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
        ? "Demo reviewer loaded contradictory approved evidence at site 004."
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
