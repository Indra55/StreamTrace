import { createHash } from "node:crypto";
import { HTTPException } from "hono/http-exception";

// Pin the public reference dataset so its provenance and results are reproducible.
export const oahRevision = "b907cf0869b59d82d9138b3d147fca66f333d911";
export const oahSource = `https://raw.githubusercontent.com/hl7-eu/oah/${oahRevision}/_samples/crete/ec.csv`;
export const oahSourcePage = `https://github.com/hl7-eu/oah/blob/${oahRevision}/_samples/crete/ec.csv`;
const header = "date,location,coordinates,device,electrical_conductivity_mS_per_cm";

export function conductivityData(csv: string) {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.shift() !== header || !lines.length || lines.length > 100) throw new Error("Unsupported conductivity dataset");
  const readings = lines.map(line => {
    const fields = line.split(",");
    const [rawDate, site, , device, rawValue] = fields;
    const match = rawDate?.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (fields.length !== 5 || !match || !site || !device || !rawValue?.trim()) throw new Error("Invalid conductivity reading");
    const date = `${match[1]}-${match[2]!.padStart(2,"0")}-${match[3]!.padStart(2,"0")}`;
    const value = Number(rawValue);
    if (!Number.isFinite(value) || value < 0 || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0,10) !== date) throw new Error("Invalid conductivity value or date");
    return { date, site, device, value };
  }).sort((a,b) => a.date.localeCompare(b.date) || a.site.localeCompare(b.site));
  const keys = readings.map(r => `${r.site}/${r.date}`);
  if (new Set(keys).size !== keys.length) throw new Error("Duplicate site and sampling date");
  const sites = [...new Set(readings.map(r => r.site))].sort().map(site => {
    const samples = readings.filter(r => r.site === site), first = samples[0]!, last = samples.at(-1)!;
    return { site, samples, change: samples.length > 1 ? Number((last.value-first.value).toFixed(4)) : null };
  });
  return { source_url: oahSourcePage, revision: oahRevision, sha256: createHash("sha256").update(csv).digest("hex"),
    kind: "published_reference_sample" as const, indicator: "Electrical conductivity", unit: "mS/cm", sites };
}

export function oahLoader(fetcher: typeof fetch = fetch) {
  let pending: Promise<ReturnType<typeof conductivityData>> | undefined;
  return async () => {
    // The source is immutable. Cache successful reads; failures remain retryable.
    pending ??= (async () => {
      try {
        const response = await fetcher(oahSource, { signal: AbortSignal.timeout(8000), redirect: "error" });
        if (!response.ok) throw new Error("Source unavailable");
        const csv = await response.text();
        if (csv.length > 32_768) throw new Error("Source too large");
        return conductivityData(csv);
      } catch {
        throw new HTTPException(502, { message: "OneAquaHealth sample unavailable. Try again or open the original dataset." });
      }
    })();
    try { return await pending; } catch (error) { pending = undefined; throw error; }
  };
}
