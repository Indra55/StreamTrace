import { useState } from "react";
import { z } from "zod";
import { request } from "../api.ts";

const source = "https://github.com/hl7-eu/oah/blob/b907cf0869b59d82d9138b3d147fca66f333d911/_samples/crete/ec.csv";
const schema = z.object({ source_url: z.literal(source), revision: z.string(), sha256: z.string(),
  kind: z.literal("published_reference_sample"), indicator: z.string(), unit: z.literal("mS/cm"),
  sites: z.array(z.object({ site: z.string(), change: z.number().nullable(),
    samples: z.array(z.object({ date: z.string(), device: z.string(), value: z.number() })).min(1) })).min(1) });

export function OneAquaHealth() {
  const [data,setData] = useState<z.infer<typeof schema>|null>(null);
  const [busy,setBusy] = useState(false), [error,setError] = useState("");
  async function load() {
    setBusy(true); setError("");
    try { setData(schema.parse(await request("/api/oneaquahealth/conductivity"))); }
    catch(e) { setError(e instanceof Error ? e.message : "Unable to load the sample."); }
    finally { setBusy(false); }
  }
  return <section className="workflow-card" aria-labelledby="oah-title" style={{marginTop:40}}>
    <p className="eyebrow">OneAquaHealth / Data to insight</p>
    <h2 id="oah-title">Explore a OneAquaHealth dataset</h2>
    <p>Electrical conductivity samples from Giofyros and Almyros, Crete, published in the OneAquaHealth FHIR repository. Original site identifiers, dates and units are preserved.</p>
    <p><strong>Published reference samples, 2024–2025.</strong> These measurements are separate from the Coimbra investigation.</p>
    <button className="secondary-action" disabled={busy} onClick={()=>void load()}>{busy ? "Loading OneAquaHealth data..." : data ? "Reload dataset" : "Load OneAquaHealth samples"}</button>
    {error && <p role="alert">{error}</p>}
    {data && <>
      <div style={{overflowX:"auto",marginTop:24}}><table style={{width:"100%",textAlign:"left",borderCollapse:"collapse"}}>
        <caption style={{textAlign:"left",marginBottom:12}}>Electrical conductivity (mS/cm)</caption>
        <thead><tr><th scope="col">Source site</th><th scope="col">Sampling date</th><th scope="col">Conductivity</th></tr></thead>
        <tbody>{data.sites.flatMap(site=>site.samples.map(sample=><tr key={`${site.site}/${sample.date}`}><th scope="row" style={{padding:"10px 0"}}>{site.site}</th><td>{sample.date}</td><td>{sample.value} {data.unit}</td></tr>))}</tbody>
      </table></div>
      {data.sites.map(site=><p key={site.site}><strong>{site.site}:</strong> {site.change === null ? "One sample; a change cannot be calculated." : `Change between ${site.samples[0]!.date} and ${site.samples.at(-1)!.date}: ${site.change>0?"+":""}${site.change} ${data.unit}.`}</p>)}
      <details><summary>Source and measurement method</summary><p>Instrument: {[...new Set(data.sites.flatMap(s=>s.samples.map(r=>r.device)))].join(", ")}</p><p>Source revision: <code>{data.revision}</code></p><p style={{overflowWrap:"anywhere"}}>Dataset SHA-256: <code>{data.sha256}</code></p></details>
    </>}
    <p><strong>One Health context:</strong> Conductivity describes how water conducts electricity and can help researchers investigate changes in dissolved ions. These two sampling dates alone cannot establish a pollution trend, explain its cause, or determine ecological or drinking-water safety.</p>
    <p><a href={source} target="_blank" rel="noreferrer">View original OneAquaHealth CSV</a>{" · "}<a href="https://www.oneaquahealth.eu/community/" target="_blank" rel="noreferrer">Join the OneAquaHealth community</a></p>
  </section>;
}
