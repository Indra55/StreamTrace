import type { CaseData } from "./data.ts";

export function fhirBundle(data: CaseData) {
  const locations = new Map(data.graph.sites.map((site, i) => [site.code, `urn:uuid:00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`]));
  return {
    resourceType: "Bundle" as const,
    type: "collection" as const,
    entry: [
      ...data.graph.sites.map((site, i) => ({
        fullUrl: locations.get(site.code)!,
        resource: { resourceType: "Location", id: `site-${i + 1}`, status: "active", mode: "instance",
          name: `StreamTrace site ${site.code}${data.case.simulated ? " (simulated)" : ""}`,
          description: `Reach ${site.reachId}. Physical access requires verification.` },
      })),
      ...data.reports.map(report => ({
        fullUrl: `urn:uuid:${report.id}`,
        resource: { resourceType: "Observation", id: report.id, status: "preliminary",
          code: { text: `Reported observable signal: ${report.signal}` },
          focus: [{ reference: locations.get(report.site_code)! }],
          effectiveDateTime: new Date(report.observed_at).toISOString(),
          valueCodeableConcept: { text: report.value },
          note: [{ text: `${data.case.simulated ? "Simulated observation. " : ""}Review state: ${data.decisions.find(d => d.report_id === report.id)?.state ?? "unreviewed"}. This is not a water safety assessment.` }],
        },
      })),
    ],
  };
}
