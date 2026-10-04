import type { CaseData } from "./data.ts";
import { z } from "zod";

export function fhirBundle(data: CaseData) {
  const reserved = new Set(data.reports.map(report => `urn:uuid:${report.id}`));
  let locationSequence = 0;
  const locations = new Map(data.graph.sites.map(site => {
    let url: string;
    do { url = `urn:uuid:00000000-0000-4000-8000-${String(++locationSequence).padStart(12, "0")}`; } while (reserved.has(url));
    return [site.code, url];
  }));
  const simulated = data.case.simulated ? {
    meta: { tag: [{ system: "https://streamtrace.example/tags", code: "simulated", display: "Simulated StreamTrace demo data. No personal data." }] },
  } : {};
  const approved = data.reports.filter(report => report.case_id === data.case.id &&
    data.decisions.some(decision => decision.report_id === report.id && decision.state === "approved"));
  return {
    resourceType: "Bundle" as const,
    type: "collection" as const,
    ...simulated,
    entry: [
      ...data.graph.sites.map((site, i) => ({
        fullUrl: locations.get(site.code)!,
        resource: { resourceType: "Location", id: `site-${i + 1}`, status: "active", mode: "instance",
          ...simulated,
          identifier: [{ system: "https://streamtrace.example/sites", value: site.code }],
          name: `StreamTrace site ${site.code}${data.case.simulated ? " (simulated)" : ""}`,
          description: `${data.case.simulated ? "Simulated observation site. " : ""}Reach ${site.reachId}. Physical access requires verification.`,
          ...sitePosition("coordinates" in site ? site.coordinates : undefined) },
      })),
      ...approved.map(report => {
        const focus = locations.get(report.site_code);
        if (!focus) throw new Error("Approved report references an unavailable observation site.");
        const decision = data.decisions.find(d => d.report_id === report.id)!;
        const reason = data.events.find(event => event.report_id === report.id &&
          event.revision === decision.revision && event.state === "approved")?.approval_reason;
        return {
          fullUrl: `urn:uuid:${report.id}`,
          resource: { resourceType: "Observation", id: report.id, status: "final",
            ...simulated,
            code: { text: `Reported observable signal: ${report.signal}` },
            focus: [{ reference: focus }],
            effectiveDateTime: new Date(report.observed_at).toISOString(),
            valueCodeableConcept: { text: { present: "seen", absent: "not seen", cannot_tell: "cannot tell" }[report.value] },
            note: [{ text: `${data.case.simulated ? "Simulated observation. " : ""}Review state: approved. This is not a water safety assessment.` },
              ...(reason ? [{ text: reason }] : [])],
          },
        };
      }),
    ],
  };
}

function sitePosition(coordinates: unknown) {
  const stored = z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]).safeParse(coordinates);
  return stored.success ? { position: { longitude: stored.data[0], latitude: stored.data[1] } } : {};
}
