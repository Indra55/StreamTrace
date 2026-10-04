import type { InboxReport } from "../api.ts";
export function GeneralInbox({reports}:{reports:InboxReport[]}) {
  return <section className="general-inbox" aria-label="General inbox"><h2>General inbox</h2><p>Reports about something else. These are not linked to an investigation and never change candidates.</p>{reports.length ? reports.map(r=><article className="evidence" key={r.id}><h3>Something else{r.site_code ? ` at site ${r.site_code}` : ""}</h3><p className="observation-notes">{r.notes}</p><p>Observed <time dateTime={r.observed_at}>{new Date(r.observed_at).toLocaleString("en-GB")}</time></p></article>) : <p>No general reports yet.</p>}</section>;
}
