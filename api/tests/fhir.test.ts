import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fhirBundle } from "../fhir.ts";
import type { CaseData } from "../data.ts";
import { simulatedDemoCase } from "../../scripts/make-fhir-sample.ts";

const observations = (bundle: ReturnType<typeof fhirBundle>) =>
  bundle.entry.map(entry => entry.resource).filter(resource => "valueCodeableConcept" in resource);

function checkReferences(value: unknown, urls: Set<string>): void {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (key === "reference") assert.ok(typeof child === "string" && urls.has(child), `Unresolved reference: ${child}`);
    else checkReferences(child, urls);
  }
}

test("committed FHIR sample is reproducible JSON with unique URLs, resolving references and simulated markers", async () => {
  const json = await readFile(new URL("../../docs/fhir/sample-bundle.json", import.meta.url), "utf8");
  const data = simulatedDemoCase();
  const bundle = fhirBundle(data);
  assert.deepEqual(JSON.parse(json), bundle);
  assert.equal(bundle.resourceType, "Bundle");
  assert.equal(bundle.type, "collection");
  const urls = new Set(bundle.entry.map(entry => entry.fullUrl));
  assert.equal(urls.size, bundle.entry.length);
  checkReferences(bundle, urls);
  const approved = data.decisions.filter(decision => decision.state === "approved").map(decision => decision.report_id);
  assert.equal(approved.length, 2);
  assert.deepEqual(observations(bundle).map(resource => resource.id), approved);
  assert.equal(bundle.entry.length, data.graph.sites.length + 2);
  for (const resource of [bundle, ...bundle.entry.map(entry => entry.resource)]) {
    assert.deepEqual(resource.meta?.tag, [{ system: "https://streamtrace.example/tags", code: "simulated",
      display: "Simulated StreamTrace demo data. No personal data." }]);
  }
  for (const resource of observations(bundle)) {
    const report = data.reports.find(report => report.id === resource.id)!;
    assert.equal(resource.status, "final");
    assert.deepEqual(resource.code, { text: `Reported observable signal: ${report.signal}` });
    assert.deepEqual(resource.valueCodeableConcept, { text: report.value === "absent" ? "not seen" : "seen" });
    assert.equal(resource.effectiveDateTime, new Date(report.observed_at).toISOString());
    assert.ok(resource.note.some(note => note.text.startsWith("Simulated observation.")));
    assert.ok(resource.note.some(note => note.text === data.events.find(event => event.report_id === resource.id)?.approval_reason));
  }
  for (const entry of bundle.entry) {
    const resource = entry.resource;
    if (!("identifier" in resource)) continue;
    const code = resource.identifier[0]!.value;
    const site = data.graph.sites.find(site => site.code === code)!;
    assert.equal(resource.name, `StreamTrace site ${code} (simulated)`);
    assert.deepEqual(resource.identifier, [{ system: "https://streamtrace.example/sites", value: code }]);
    assert.ok("coordinates" in site);
    const coordinates = site.coordinates as number[];
    assert.deepEqual(resource.position, { longitude: coordinates[0], latitude: coordinates[1] });
    assert.ok(resource.description.startsWith("Simulated observation site."));
  }
});

test("FHIR exports current approvals only and excludes citizen notes, coordinates, identifiers and the general inbox", () => {
  const data = simulatedDemoCase();
  const original = data.reports[0]!;
  const privateNotes = "PRIVATE CITIZEN NOTE: Alex at home";
  const reporter = "private-reporter@example.invalid";
  const privatePosition = { longitude: 123.456789, latitude: 12.345678 };
  const privateReports = data.reports.map(report => ({ ...report, notes: privateNotes,
    reporter_id: reporter, coordinates: privatePosition, citizen_context: { coordinates: privatePosition } }));
  data.reports = privateReports;
  for (const [i, state] of (["unreviewed", "rejected", "uncertain"] as const).entries()) {
    const id = `30000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`;
    data.reports.push({ ...original, id });
    data.decisions.push({ ...data.decisions[0]!, report_id: id, state });
  }
  const inboxId = "30000000-0000-4000-8000-000000000004";
  data.reports.push({ ...original, id: inboxId, case_id: null, signal: "other" } as unknown as CaseData["reports"][number]);
  data.decisions.push({ ...data.decisions[0]!, report_id: inboxId });
  const bundle = fhirBundle(data);
  assert.deepEqual(observations(bundle).map(resource => resource.id), data.reports.slice(0, 2).map(report => report.id));
  const json = JSON.stringify(bundle);
  for (const privateValue of [privateNotes, reporter, "123.456789", "12.345678", "citizen_context", "reporter_id", "coordinates"]) {
    assert.equal(json.includes(privateValue), false);
  }
  // Whitelist exported Observation fields so additional private fields cannot leak silently.
  for (const resource of observations(bundle)) {
    assert.deepEqual(Object.keys(resource).sort(), ["resourceType", "id", "status", "meta", "code", "focus", "effectiveDateTime", "valueCodeableConcept", "note"].sort());
  }
  const withdrawn = data.decisions[0]!;
  withdrawn.state = "unreviewed";
  assert.deepEqual(observations(fhirBundle(data)).map(resource => resource.id), [data.reports[1]!.id]);
});

test("approved cannot-tell uses text only, latest reviewer reason is exported and live resources have no simulated marker", () => {
  const data = simulatedDemoCase();
  data.case.simulated = false;
  data.reports[0]!.value = "cannot_tell";
  data.decisions[0]!.revision = 2;
  data.events.push({ ...data.events[0]!, revision: 2, approval_reason: "Current reviewer reason" });
  const bundle = fhirBundle(data);
  const observation = observations(bundle)[0]!;
  assert.deepEqual(observation.valueCodeableConcept, { text: "cannot tell" });
  assert.ok(observation.note.some(note => note.text === "Current reviewer reason"));
  assert.equal(observation.note.some(note => note.text === data.events[0]!.approval_reason), false);
  assert.equal(JSON.stringify(bundle).includes("simulated"), false);
  assert.equal(bundle.meta, undefined);
  for (const entry of bundle.entry) assert.equal(entry.resource.meta, undefined);
  data.events = [];
  assert.equal(observations(fhirBundle(data))[0]!.note.length, 1);
});

test("site URLs avoid report UUID collisions and missing sites cannot produce unresolved focus references", () => {
  const data = simulatedDemoCase();
  const id = "00000000-0000-4000-8000-000000000001";
  data.reports[0]!.id = id;
  data.decisions[0]!.report_id = id;
  const bundle = fhirBundle(data);
  const urls = new Set(bundle.entry.map(entry => entry.fullUrl));
  assert.equal(urls.size, bundle.entry.length);
  checkReferences(bundle, urls);
  data.reports[0]!.site_code = "missing";
  assert.throws(() => fhirBundle(data), /unavailable observation site/);
});
