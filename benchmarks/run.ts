import { writeFileSync } from "node:fs";
import {
  investigate,
  compileGraph,
  type Graph,
  type ReviewedReport,
} from "../engine/index.ts";
import { networks } from "./networks.ts";
const SEED = 20261003;
function rng(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}
type Strategy = "bisection" | "random" | "ascending";
type Scenario = "clean" | "missing" | "erroneous";
function run(
  graph: Graph,
  origin: string,
  strategy: Strategy,
  scenario: Scenario,
  seed: number,
) {
  const random = rng(seed),
    upstream = compileGraph(graph).upstream;
  const reports: ReviewedReport[] = [];
  const attempted = new Set<string>();
  let checks = 0;
  let result = investigate(graph, { id: "sim", signal: "foam" }, reports);
  while (result.candidates.length > 1) {
    const available = graph.sites
      .filter((s) => s.accessible && !attempted.has(s.code))
      .sort((a, b) => a.code.localeCompare(b.code));
    // Fixed/random baselines sample all remaining sites, including uninformative ones.
    const code =
      strategy === "bisection"
        ? result.recommendation?.siteCode
        : strategy === "ascending"
          ? available[0]?.code
          : available[Math.floor(random() * available.length)]?.code;
    if (!code) break;
    const site = graph.sites.find((s) => s.code === code)!;
    attempted.add(code);
    checks++;
    // Missing: every third attempted check is unavailable, then excluded from later selection.
    const missing = scenario === "missing" && checks % 3 === 0;
    let present = upstream.get(site.reachId)!.has(origin);
    // Erroneous: deliberately flip the first answer, expose wrong singleton outcomes separately.
    if (scenario === "erroneous" && checks === 1) present = !present;
    if (!missing)
      reports.push({
        reportId: code,
        revision: 1,
        caseId: "sim",
        signal: "foam",
        siteCode: code,
        value: present ? "present" : "absent",
        confirmed: true,
        source: "observation",
        review: "approved",
        assumptionsAcknowledged: true,
        absenceComparable: true,
      });
    result = investigate(
      {
        ...graph,
        sites: graph.sites.map((s) => ({
          ...s,
          accessible: s.accessible && !attempted.has(s.code),
        })),
      },
      { id: "sim", signal: "foam" },
      reports,
    );
  }
  return {
    checks,
    conflict: result.status === "conflict",
    unresolved: result.candidates.length > 1,
    correct: result.candidates.length === 1 && result.candidates[0] === origin,
    wrongSingleton:
      result.candidates.length === 1 && result.candidates[0] !== origin,
  };
}
const rows = [];
for (const [name, graph] of Object.entries(networks))
  for (const scenario of ["clean", "missing", "erroneous"] as Scenario[])
    for (const strategy of ["bisection", "random", "ascending"] as Strategy[]) {
      const runs = [];
      for (let origin = 0; origin < graph.reaches.length; origin++)
        for (let trial = 0; trial < (strategy === "random" ? 50 : 1); trial++)
          runs.push(
            run(
              graph,
              String(origin),
              strategy,
              scenario,
              (SEED + origin * 1009 + trial * 9176) >>> 0,
            ),
          );
      rows.push({
        network: name,
        reaches: graph.reaches.length,
        scenario,
        strategy,
        runs: runs.length,
        meanChecks: runs.reduce((s, r) => s + r.checks, 0) / runs.length,
        maxChecks: Math.max(...runs.map((r) => r.checks)),
        unresolved: runs.filter((r) => r.unresolved).length,
        conflicts: runs.filter((r) => r.conflict).length,
        correct: runs.filter((r) => r.correct).length,
        wrongSingletons: runs.filter((r) => r.wrongSingleton).length,
      });
    }
const results = {
  seed: SEED,
  randomTrialsPerOrigin: 50,
  assumptions:
    "One persistent origin; normal downstream propagation; observations at downstream reach ends; all sites initially accessible. Missing: every third attempted check unavailable. Erroneous: first answer flipped. Stop at singleton/conflict/exhaustion; a wrong singleton can occur without conflict. Checks include missing attempts. Random and ascending choose among all unattempted sites; bisection requires a useful partition.",
  rows,
};
writeFileSync(
  new URL("./results.json", import.meta.url),
  JSON.stringify(results, null, 2) + "\n",
);
const table = [
  "# StreamTrace synthetic benchmark",
  "",
  `Seed: ${SEED}. Every origin tested; 50 trials per origin for random.`,
  "",
  results.assumptions,
  "",
  "| Network | Scenario | Strategy | Runs | Mean checks | Max | Unresolved | Conflicts | Wrong singleton |",
  "|---|---|---|---:|---:|---:|---:|---:|---:|",
  ...rows.map(
    (r) =>
      `| ${r.network} | ${r.scenario} | ${r.strategy} | ${r.runs} | ${r.meanChecks.toFixed(2)} | ${r.maxChecks} | ${r.unresolved} | ${r.conflicts} | ${r.wrongSingletons} |`,
  ),
  "",
  "These are simulation results, not a real-world efficiency or safety claim. Counts have different denominators; compare rates across strategies.",
];
writeFileSync(
  new URL("./RESULTS.md", import.meta.url),
  table.join("\n") + "\n",
);
console.log(`Wrote ${rows.length} benchmark rows.`);
