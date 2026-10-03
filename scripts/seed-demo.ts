import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { z } from "zod";
import { compileGraph, investigate, type Graph } from "../engine/index.ts";
import { adminTransaction } from "./migrate.ts";
export const demoCaseId = "10000000-0000-4000-8000-000000000001";
export async function seedDemo(test = false): Promise<void> {
  if (!process.argv.includes("--confirm")) throw new Error("Seed requires --confirm");
  const email = z.email().parse(process.env.DEMO_REVIEWER_EMAIL).toLowerCase();
  const network: Omit<Graph, "sites"> & { sites: (Graph["sites"][number] & { placement: string })[] } = JSON.parse(
    await readFile(new URL("../data/coimbra.network.json", import.meta.url), "utf8"));
  const upstream = compileGraph(network).upstream;
  const branch = network.sites.filter(s => s.placement === "tributary_confluence")
    .sort((a,b) => upstream.get(b.reachId)!.size-upstream.get(a.reachId)!.size || a.code.localeCompare(b.code))[0];
  if (!branch) throw new Error("No demo branch");
  const ids = ["20000000-0000-4000-8000-000000000001", "20000000-0000-4000-8000-000000000002", "20000000-0000-4000-8000-000000000003"];
  const first = { reportId: ids[0]!, revision: 1, caseId: demoCaseId, signal: "foam", siteCode: branch.code,
    value: "absent" as const, confirmed: true, source: "observation" as const, review: "approved" as const,
    assumptionsAcknowledged: true, absenceComparable: true };
  const remaining = investigate(network, { id: demoCaseId, signal: "foam" }, [first]).candidates;
  const main = network.sites.filter(s => s.placement === "main_stem_partition")
    .sort((a,b) => upstream.get(b.reachId)!.size-upstream.get(a.reachId)!.size || a.code.localeCompare(b.code))
    .find(s => { const n=remaining.filter(r => upstream.get(s.reachId)!.has(r)).length; return n>3 && n<remaining.length; });
  if (!main) throw new Error("No demo main-stem partition");
  const second = { ...first, reportId: ids[1]!, siteCode: main.code, value: "present" as const };
  const candidates = investigate(network, { id: demoCaseId, signal: "foam" }, [first,second]).candidates;
  const pending = network.sites.filter(s => s.code!==branch.code && s.code!==main.code)
    .map(s => ({ site:s, n:candidates.filter(r => upstream.get(s.reachId)!.has(r)).length }))
    .filter(x => x.n>0 && x.n<candidates.length)
    .sort((a,b) => Math.max(a.n,candidates.length-a.n)-Math.max(b.n,candidates.length-b.n) || a.site.code.localeCompare(b.site.code))[0]?.site;
  if (!pending) throw new Error("No pending demo observation");
  await adminTransaction(async client => {
    const user = await client.query<{ id: string }>(`select u.id from public.users u join public.reviewers r on r.user_id=u.id where u.email=$1`, [email]);
    if (!user.rows[0]) throw new Error("Demo reviewer must already be allowlisted");
    await client.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ sub:user.rows[0].id })]);
    await client.query(`insert into public.networks(id,label,graph,simulated) values('coimbra-simulated','Simulated Coimbra investigation',$1,true) on conflict do nothing`, [JSON.stringify(network)]);
    for (const site of network.sites) await client.query(`insert into public.sites(code,reach_id,accessible,network_id)
      values($1,$2,$3,'coimbra-simulated') on conflict do nothing`, [site.code,site.reachId,site.accessible]);
    await client.query(`insert into public.cases(id,signal,assumptions,network_id,simulated)
      values($1,'foam','SIMULATED: one persistent origin, normal downstream propagation and comparable observations. Prototype topology and access only.','coimbra-simulated',true) on conflict do nothing`, [demoCaseId]);
    for (const [i,site] of [branch,main,pending].entries()) {
      const inserted = await client.query(`insert into public.reports(id,case_id,signal,site_code,value,confirmed,origin,observed_at,notes)
        values($1,$2,'foam',$3,$4,true,'web','2026-10-04T00:00:00Z','Simulated demo observation') on conflict do nothing`, [ids[i],demoCaseId,site.code,i===1 ? "present" : "absent"]);
      if (inserted.rowCount) await client.query("select public.review_report($1,$2,$3,$4)", [ids[i],i<2 ? "approved" : "unreviewed",i<2,i<2]);
    }
  }, test);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  seedDemo(process.argv.includes("--test")).then(() => console.log("Simulated demo seed complete"))
    .catch(() => { console.error("Demo seed refused or failed; pass --confirm and configure an existing demo reviewer"); process.exitCode=1; });
}
