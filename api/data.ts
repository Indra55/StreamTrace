import type { PoolClient } from "pg";
import { z } from "zod";
import { fromDatabase, type StoredObservation, type StoredDecision } from "../engine/adapter.ts";
import { investigate } from "../engine/index.ts";
import { HTTPException } from "hono/http-exception";

const reachSchema = z.object({ id: z.string().min(1), downstream: z.array(z.string().min(1)) }).passthrough();
const siteSchema = z.object({ code: z.string(), reachId: z.string(), accessible: z.boolean() }).passthrough();
const graphSchema = z.object({ reaches: z.array(reachSchema).min(1), sites: z.array(siteSchema),
  metadata: z.object({ topology_review_state: z.string() }).passthrough().optional() }).passthrough();
export interface CaseRow { id: string; title: string; signal: string; assumptions: string; network_id: string | null; simulated: boolean }
export interface ReportRow extends StoredObservation { observed_at: Date | string; notes: string; review_state: "unreviewed"; origin: string }
export interface SiteRow { code: string; reach_id: string; accessible: boolean; network_id: string }

export async function loadCase(client: PoolClient, id: string) {
  const cases = await client.query<CaseRow>("select id,title,signal,assumptions,network_id,simulated from public.cases where id=$1", [id]);
  const investigationCase = cases.rows[0];
  if (!investigationCase) throw new HTTPException(404, { message: "Case not found" });
  const network = await client.query<{ graph: unknown }>("select graph from public.networks where id=$1", [investigationCase.network_id]);
  if (!network.rows[0]) throw new HTTPException(409, { message: "Case network unavailable" });
  const stored = graphSchema.parse(network.rows[0].graph);
  const sites = await client.query<SiteRow>("select code,reach_id,accessible,network_id from public.sites where network_id=$1 order by code", [investigationCase.network_id]);
  const graph = { ...stored, reaches: stored.reaches, sites: sites.rows.map(s => ({
    ...stored.sites.find(original=>original.code===s.code), code: s.code, reachId: s.reach_id, accessible: s.accessible,
  })) };
  const reports = await client.query<ReportRow>(`select id,case_id,signal,site_code,value,confirmed,observed_at,notes,review_state,origin,citizen_context
    from public.reports where case_id=$1 order by id`, [id]);
  const decisions = await client.query<StoredDecision>(`select d.report_id,d.revision,d.state,d.assumptions_acknowledged,d.absence_comparable
    from public.review_decisions d join public.reports r on r.id=d.report_id where r.case_id=$1 order by d.report_id`, [id]);
  const analysis = investigate(graph, investigationCase, fromDatabase(reports.rows, decisions.rows));
  // Preserve the established prototype gate without changing the engine semantics.
  if (stored.metadata && stored.metadata.topology_review_state !== "prototype_confirmed") analysis.recommendation = null;
  const events = await client.query<{ report_id: string; revision: number; state: string; approval_reason: string; created_at: Date | string }>(
    "select e.report_id,e.revision,e.state,e.approval_reason,e.created_at from public.review_events e join public.reports r on r.id=e.report_id where r.case_id=$1 order by e.created_at,e.report_id,e.revision", [id]);
  return { case: investigationCase, graph, reports: reports.rows, decisions: decisions.rows, events: events.rows, analysis };
}
export type CaseData = Awaited<ReturnType<typeof loadCase>>;
