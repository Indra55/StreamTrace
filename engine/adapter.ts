import type { ReviewedReport, Value } from "./index.ts";
export interface StoredObservation {
  id: string;
  case_id: string;
  signal: string;
  site_code: string;
  value: Value;
  confirmed: boolean;
}
export interface StoredDecision {
  report_id: string;
  revision: number;
  state: ReviewedReport["review"];
  assumptions_acknowledged: boolean;
  absence_comparable: boolean;
}
/** Call with rows read from Postgres, not client-supplied decisions or AI drafts.
 * Reports are immutable; review_decisions contains the current authorized revision.
 */
export function fromDatabase(
  reports: readonly StoredObservation[],
  decisions: readonly StoredDecision[],
): ReviewedReport[] {
  const observations = new Map(reports.map((r) => [r.id, r]));
  if (observations.size !== reports.length)
    throw new Error("Duplicate stored observation");
  return decisions.map((d) => {
    const r = observations.get(d.report_id);
    if (!r) throw new Error("Review references missing observation");
    return {
      reportId: r.id,
      revision: d.revision,
      caseId: r.case_id,
      signal: r.signal,
      siteCode: r.site_code,
      value: r.value,
      confirmed: r.confirmed,
      source: "observation",
      review: d.state,
      assumptionsAcknowledged: d.assumptions_acknowledged,
      absenceComparable: d.absence_comparable,
    };
  });
}
