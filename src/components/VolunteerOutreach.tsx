import { useEffect, useRef, useState } from "react";
import volunteerData from "../data/volunteers.json";

type Status = "Delivered" | "Replied" | "No reply" | "Failed";
type Volunteer = { id: string; name: string; site: string; channel: "SMS" | "WhatsApp"; status: Status; reply: "Seen" | "Not seen" | null; sentAt: string };
const icons: Record<Status, string> = { Delivered: "✓", Replied: "↩", "No reply": "◷", Failed: "!" };
const fakeTime = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

export function VolunteerOutreach({ sites, recommendedSite }: { sites: readonly { code: string }[]; recommendedSite?: string | null }) {
  const [volunteers, setVolunteers] = useState<Volunteer[]>(() => (volunteerData as Volunteer[]).map(volunteer => ({ ...volunteer })));
  const [chosenSite, setChosenSite] = useState<string | null>(null);
  const [toast, setToast] = useState<{ sequence: number } | null>(null);
  const resends = useRef(0);
  const preferred = chosenSite ?? recommendedSite;
  const site = sites.some(s => s.code === preferred) ? preferred! : sites[0]?.code ?? "";
  const rows = volunteers.filter(volunteer => volunteer.site === site);
  const messaged = rows.filter(volunteer => volunteer.status !== "Failed").length;
  const replied = rows.filter(volunteer => volunteer.status === "Replied").length;
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 4_000);
    return () => clearTimeout(timer);
  }, [toast]);
  function resend(volunteer: Volunteer) {
    if (volunteer.status === "Replied") return;
    const sequence = ++resends.current;
    const sentAt = new Date(Date.UTC(2030, 0, 15, 9, 30) + sequence * 60_000).toISOString();
    setVolunteers(current => current.map(row => row.id === volunteer.id ? { ...row, status: "Delivered", sentAt } : row));
    setToast({ sequence });
  }
  return <div className="volunteer-outreach">
    <p className="outreach-banner" role="note">Mockup. No messages are sent. Volunteers are fictional.</p>
    <p className="eyebrow">Simulated volunteer outreach</p>
    <h1>Outreach</h1>
    <label className="outreach-site">Observation site
      <select value={site} onChange={event => { setChosenSite(event.target.value); setToast(null); }} disabled={!sites.length}>
        {sites.map(s => <option key={s.code} value={s.code}>Site {s.code}{s.code === recommendedSite ? " (recommended)" : ""}</option>)}
      </select>
    </label>
    <p className="outreach-summary">{rows.length} volunteers, {messaged} messaged, {replied} replied</p>
    <p className="outreach-time-note">All times are fictional, 15 Jan 2030, UTC. Failed deliveries are excluded from the messaged count.</p>
    <ul className="outreach-list" aria-label={`Fictional volunteers at site ${site}`}>
      {rows.map(volunteer => <li key={volunteer.id} className="outreach-row">
        <div className="outreach-person"><strong>{volunteer.name}</strong><span>{volunteer.channel}</span></div>
        <span className={`outreach-status outreach-status-${volunteer.status.toLowerCase().replaceAll(" ", "-")}`}><span aria-hidden="true">{icons[volunteer.status]}</span> {volunteer.status}</span>
        <dl className="outreach-details">
          <div><dt>Reply</dt><dd>{volunteer.reply ?? "None"}</dd></div>
          <div><dt>Sent (fake)</dt><dd><time dateTime={volunteer.sentAt}>{fakeTime.format(new Date(volunteer.sentAt))}</time></dd></div>
        </dl>
        <button type="button" onClick={() => resend(volunteer)} disabled={volunteer.status === "Replied"} aria-label={`Resend to ${volunteer.name} (simulated)`}>Resend</button>
      </li>)}
    </ul>
    {!rows.length && <p>No fictional volunteers for this site.</p>}
    <div role="status" aria-live="polite" aria-atomic="true" className={toast ? "outreach-toast" : "sr-only"}>{toast && <span key={toast.sequence}>Resent (simulated)</span>}</div>
  </div>;
}
