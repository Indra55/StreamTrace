/** Edges point downstream. A site observes at the downstream end of its reach. */
export interface Reach {
  id: string;
  downstream: readonly string[];
}
export interface Site {
  code: string;
  reachId: string;
  accessible: boolean;
}
export interface Graph {
  reaches: readonly Reach[];
  sites: readonly Site[];
}
export type Value = "present" | "absent" | "cannot_tell";
export interface InvestigationCase {
  id: string;
  signal: string;
  initialCandidates?: readonly string[];
}
/** Trusted adapter input: revisions originate from authorized review records, never AI output. */
export interface ReviewedReport {
  reportId: string;
  revision: number;
  caseId: string;
  signal: string;
  siteCode: string;
  value: Value;
  confirmed: boolean;
  source: "observation" | "ai_draft" | "parser_draft";
  review: "unreviewed" | "approved" | "rejected" | "uncertain";
  assumptionsAcknowledged: boolean;
  absenceComparable: boolean;
}
export interface Step {
  reportId: string;
  operation: "intersect" | "subtract";
  upstream: string[];
  before: string[];
  after: string[];
  explanation: string;
}
export interface Recommendation {
  siteCode: string;
  present: string[];
  absent: string[];
  worstPartition: number;
}
export interface InvestigationResult {
  candidates: string[];
  steps: Step[];
  checkedSites: string[];
  status:
    | "awaiting_review"
    | "active"
    | "conflict"
    | "narrowed"
    | "no_useful_next_site";
  recommendation: Recommendation | null;
  message: string;
}
const sorted = (xs: Iterable<string>) => [...xs].sort();
export function compileGraph(graph: Graph) {
  const reaches = new Map(graph.reaches.map((r) => [r.id, r]));
  if (
    !reaches.size ||
    reaches.size !== graph.reaches.length ||
    graph.reaches.some((r) => !r.id)
  )
    throw new Error("Invalid reach IDs");
  const parents = new Map(
    sorted(reaches.keys()).map((id) => [id, [] as string[]]),
  );
  for (const r of graph.reaches) {
    if (new Set(r.downstream).size !== r.downstream.length)
      throw new Error("Duplicate edge");
    for (const target of r.downstream) {
      if (!reaches.has(target)) throw new Error("Unknown downstream reach");
      parents.get(target)!.push(r.id);
    }
  }
  const upstream = new Map<string, Set<string>>();
  const visiting = new Set<string>();
  function visit(id: string): Set<string> {
    if (visiting.has(id)) throw new Error("Flow graph contains a cycle");
    if (upstream.has(id)) return upstream.get(id)!;
    visiting.add(id);
    const all = new Set([id]);
    for (const parent of parents.get(id)!)
      for (const x of visit(parent)) all.add(x);
    visiting.delete(id);
    upstream.set(id, all);
    return all;
  }
  for (const id of reaches.keys()) visit(id);
  const sites = new Map(graph.sites.map((s) => [s.code, s]));
  if (
    sites.size !== graph.sites.length ||
    graph.sites.some(
      (s) =>
        !s.code || !reaches.has(s.reachId) || typeof s.accessible !== "boolean",
    )
  )
    throw new Error("Invalid site");
  return { reaches, sites, upstream };
}
function canonical(r: ReviewedReport) {
  return JSON.stringify([
    r.reportId,
    r.revision,
    r.caseId,
    r.signal,
    r.siteCode,
    r.value,
    r.confirmed,
    r.source,
    r.review,
    r.assumptionsAcknowledged,
    r.absenceComparable,
  ]);
}
export function latestReports(
  reports: readonly ReviewedReport[],
): ReviewedReport[] {
  const revisions = new Map<string, string>();
  const latest = new Map<string, ReviewedReport>();
  for (const r of reports) {
    if (!r.reportId || !Number.isSafeInteger(r.revision) || r.revision < 0)
      throw new Error("Invalid report revision");
    const key = JSON.stringify([r.reportId, r.revision]);
    const content = canonical(r);
    if (revisions.has(key) && revisions.get(key) !== content)
      throw new Error("Conflicting payloads for the same report revision");
    revisions.set(key, content);
    if (
      !latest.has(r.reportId) ||
      latest.get(r.reportId)!.revision < r.revision
    )
      latest.set(r.reportId, r);
  }
  return [...latest.values()].sort((a, b) =>
    a.reportId < b.reportId ? -1 : a.reportId > b.reportId ? 1 : 0,
  );
}
export function isAssertion(r: ReviewedReport, c: InvestigationCase): boolean {
  return (
    r.caseId === c.id &&
    r.signal === c.signal &&
    r.source === "observation" &&
    r.confirmed === true &&
    r.review === "approved" &&
    r.assumptionsAcknowledged === true &&
    (r.value === "present" ||
      (r.value === "absent" && r.absenceComparable === true))
  );
}
export function investigate(
  graph: Graph,
  c: InvestigationCase,
  reports: readonly ReviewedReport[],
): InvestigationResult {
  const g = compileGraph(graph);
  let candidates = sorted(new Set(c.initialCandidates ?? g.reaches.keys()));
  if (!candidates.length || candidates.some((id) => !g.reaches.has(id)))
    throw new Error("Invalid original candidate set");
  const steps: Step[] = [];
  const checked = new Set<string>();
  const assertions = new Set<string>();
  for (const r of latestReports(reports)) {
    if (!isAssertion(r, c)) continue;
    const site = g.sites.get(r.siteCode);
    if (!site) throw new Error("Approved assertion references unknown site");
    const key = JSON.stringify([r.siteCode, r.value]);
    if (assertions.has(key)) continue;
    assertions.add(key);
    checked.add(r.siteCode);
    const upstream = g.upstream.get(site.reachId)!;
    const before = candidates;
    candidates = candidates.filter((id) =>
      r.value === "present" ? upstream.has(id) : !upstream.has(id),
    );
    const operation = r.value === "present" ? "intersect" : "subtract";
    steps.push({
      reportId: r.reportId,
      operation,
      upstream: sorted(upstream),
      before,
      after: candidates,
      explanation: `${operation === "intersect" ? "Intersect with" : "Subtract"} upstream reaches at ${site.code}: ${before.length} → ${candidates.length}.`,
    });
  }
  let recommendation: Recommendation | null = null;
  if (candidates.length > 1)
    for (const code of sorted(g.sites.keys())) {
      const site = g.sites.get(code)!;
      if (!site.accessible || checked.has(code)) continue;
      const up = g.upstream.get(site.reachId)!;
      const present = candidates.filter((id) => up.has(id));
      const absent = candidates.filter((id) => !up.has(id));
      if (!present.length || !absent.length) continue;
      const worstPartition = Math.max(present.length, absent.length);
      if (!recommendation || worstPartition < recommendation.worstPartition)
        recommendation = { siteCode: code, present, absent, worstPartition };
    }
  const status = !candidates.length
    ? "conflict"
    : candidates.length === 1
      ? "narrowed"
      : !steps.length
        ? "awaiting_review"
        : recommendation
          ? "active"
          : "no_useful_next_site";
  const message =
    status === "conflict"
      ? "Pause: conflicting reviewed evidence. Recheck the evidence and model assumptions."
      : status === "narrowed"
        ? "Priority region for investigation; not a confirmed source."
        : !recommendation
          ? "Researcher review recommended: no useful accessible observation site remains."
          : `Check ${recommendation.siteCode} next: present leaves ${recommendation.present.length}, absent leaves ${recommendation.absent.length} candidate reaches.`;
  return {
    candidates,
    steps,
    checkedSites: sorted(checked),
    status,
    recommendation,
    message,
  };
}
/** A safe streaming adapter. Reversals cannot be implemented by filtering old candidates. */
export function createInvestigation(graph: Graph, c: InvestigationCase) {
  graph = structuredClone(graph);
  c = structuredClone(c);
  const history: ReviewedReport[] = [];
  return {
    update(report: ReviewedReport) {
      const next = [...history, structuredClone(report)];
      const result = investigate(graph, c, next);
      history.push(structuredClone(report));
      return result;
    },
    result: () => investigate(graph, c, history),
  };
}
