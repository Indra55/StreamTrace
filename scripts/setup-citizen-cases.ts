import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { compileGraph,type Graph } from "../engine/index.ts";
import { adminTransaction } from "./migrate.ts";

// Provision investigations only. No observations or review decisions are seeded.
export async function setupCitizenCases():Promise<void> {
  if(!process.argv.includes("--confirm"))throw new Error("Setup requires --confirm");
  const graph:Graph=JSON.parse(await readFile(new URL("../data/coimbra.network.json",import.meta.url),"utf8"));
  compileGraph(graph);
  await adminTransaction(async client=>{
    await client.query("select pg_advisory_xact_lock(73629145)");
    const existing=await client.query<{code:string;reach_id:string;network_id:string}>("select code,reach_id,network_id from public.sites where code=any($1)",[graph.sites.map(s=>s.code)]);
    const networkIds=new Set(existing.rows.map(s=>s.network_id));
    if(networkIds.size>1 || existing.rows.some(s=>!s.network_id||graph.sites.find(site=>site.code===s.code)?.reachId!==s.reach_id))throw new Error("Existing sites belong to a different network");
    const networkId=existing.rows[0]?.network_id??"coimbra-field-network";
    await client.query("insert into public.networks(id,label,graph,simulated) values($1,'Coimbra prototype field network',$2,false) on conflict do nothing",[networkId,JSON.stringify(graph)]);
    for(const site of graph.sites)await client.query("insert into public.sites(code,reach_id,accessible,network_id) values($1,$2,$3,$4) on conflict do nothing",[site.code,site.reachId,site.accessible,networkId]);
    for(const signal of ["foam","colour","discharge","litter","dead_fish"]){
      await client.query(`insert into public.cases(signal,assumptions,network_id,simulated,title)
        select $1,$2,$3,false,initcap(replace($1,'_',' ')) || ' investigation' where not exists(select 1 from public.cases where signal=$1 and network_id=$3 and simulated=false)`,
      [signal,"Citizen observations pending researcher review. Model assumes one persistent origin, normal downstream propagation and comparable observations. Network direction and physical access are prototype assumptions, not expert verified.",networkId]);
    }
  });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  setupCitizenCases().then(()=>console.log("Citizen investigations configured for all five signals. No observations seeded."))
    .catch(()=>{console.error("Citizen setup failed; verify owner configuration and compatible sites");process.exitCode=1;});
}
