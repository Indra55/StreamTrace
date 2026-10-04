import { mkdir, writeFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { fhirBundle } from "../api/fhir.ts";
import type { CaseData } from "../api/data.ts";
import { demoCase, evaluate, network, seed } from "../src/demo.ts";

export function simulatedDemoCase(): CaseData {
  const at = "2026-10-04T00:00:00Z";
  const state = seed(network, at);
  const ids = new Map(state.observations.map((report, i) =>
    [report.id, `20000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`]));
  return {
    case: { ...demoCase, network_id: "coimbra-simulated", simulated: true,
      assumptions: "SIMULATED: one persistent origin and comparable observations. Prototype topology and access only." },
    graph: network,
    reports: state.observations.map(report => ({ ...report, id: ids.get(report.id)!,
      observed_at: at, notes: "", origin: "web", review_state: "unreviewed" })),
    decisions: state.decisions.map(decision => ({ ...decision, report_id: ids.get(decision.report_id)! })),
    events: state.decisions.map(decision => ({ report_id: ids.get(decision.report_id)!,
      revision: decision.revision, state: decision.state, created_at: at,
      approval_reason: decision.state === "approved" ? "Simulated reviewer accepted this demo observation under the case assumptions." : "" })),
    analysis: evaluate(state, network),
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const directory = new URL("../docs/fhir/", import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL("sample-bundle.json", directory), `${JSON.stringify(fhirBundle(simulatedDemoCase()), null, 2)}\n`);
  console.log("Wrote docs/fhir/sample-bundle.json from the simulated demo using the API FHIR builder.");
}
