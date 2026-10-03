import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildNetwork,
  serialize,
  type Cache,
} from "../scripts/build-network.ts";
import {
  compileGraph,
  investigate,
  type ReviewedReport,
} from "../engine/index.ts";
const cacheText = readFileSync(
  new URL("../data/coimbra_osm.json", import.meta.url),
  "utf8",
);
const cache = JSON.parse(cacheText) as Cache;
const built = buildNetwork(cacheText);
const graph = built.network;

test("cached network compiles, has one outlet, seven real tributaries and 29 reaches", () => {
  compileGraph(graph);
  assert.equal(graph.reaches.length, 29);
  assert.equal(graph.metadata.stats.mainStemTributaries, 7);
  assert.equal(graph.reaches.filter((r) => !r.downstream.length).length, 1);
  assert.equal(graph.metadata.topology_review_state, "unreviewed");
  assert.equal(graph.metadata.geographic_recommendations_enabled, false);
  assert.ok(graph.sites.every((s) => !s.accessible));
});

test("every segment and geometry comes from cached OSM; no invented or reversed edges", () => {
  const raw = new Map<string, Set<number>>(),
    coordinates = new Map<number, number[]>();
  for (const way of cache.elements) {
    way.nodes.forEach((n, i) => {
      coordinates.set(n, [way.geometry[i]!.lon, way.geometry[i]!.lat]);
      if (i) {
        const key = `${way.nodes[i - 1]}:${n}`;
        if (!raw.has(key)) raw.set(key, new Set());
        raw.get(key)!.add(way.id);
      }
    });
  }
  const included = new Set<string>();
  for (const reach of graph.reaches) {
    assert.deepEqual(
      reach.geometry,
      reach.nodeIds.map((n) => coordinates.get(n)),
    );
    const sources = new Set<number>();
    for (let i = 1; i < reach.nodeIds.length; i++) {
      const key = `${reach.nodeIds[i - 1]}:${reach.nodeIds[i]}`;
      assert.ok(raw.has(key), key);
      assert.ok(!included.has(key), "edge belongs to exactly one reach");
      included.add(key);
      for (const id of raw.get(key)!) sources.add(id);
    }
    assert.deepEqual(
      reach.sourceOsmWayIds,
      [...sources].sort((a, b) => a - b),
    );
    assert.deepEqual(
      reach.downstream,
      [
        ...graph.reaches
          .filter((r) => r.fromNode === reach.toNode)
          .map((r) => r.id),
      ].sort(),
    );
  }
  // Independently reconstruct the entire upstream closure, stopping at the study boundary.
  const incoming = new Map<number, number[]>();
  for (const way of cache.elements)
    for (let i = 1; i < way.nodes.length; i++) {
      const to = way.nodes[i]!,
        from = way.nodes[i - 1]!;
      incoming.set(to, [...(incoming.get(to) ?? []), from]);
    }
  const expected = new Set<string>(),
    seen = new Set<number>(),
    stack = [graph.metadata.curation.outletBoundaryNode];
  while (stack.length) {
    const n = stack.pop()!;
    if (seen.has(n) || n === graph.metadata.curation.upstreamBoundaryNode)
      continue;
    seen.add(n);
    for (const from of incoming.get(n) ?? []) {
      expected.add(`${from}:${n}`);
      stack.push(from);
    }
  }
  assert.deepEqual([...included].sort(), [...expected].sort());
});

test("engine upstream sets agree with independent OSM-node traversal at every site", () => {
  const compiled = compileGraph(graph);
  const outgoing = new Map<number, number[]>();
  for (const r of graph.reaches)
    for (let i = 1; i < r.nodeIds.length; i++) {
      const a = r.nodeIds[i - 1]!,
        b = r.nodeIds[i]!;
      outgoing.set(a, [...(outgoing.get(a) ?? []), b]);
    }
  function flowsTo(from: number, to: number) {
    const seen = new Set<number>(),
      stack = [from];
    while (stack.length) {
      const n = stack.pop()!;
      if (n === to) return true;
      if (seen.has(n)) continue;
      seen.add(n);
      stack.push(...(outgoing.get(n) ?? []));
    }
    return false;
  }
  for (const site of graph.sites) {
    const expected = graph.reaches
      .filter((r) => flowsTo(r.toNode, site.osmNodeId))
      .map((r) => r.id)
      .sort();
    assert.deepEqual(
      [...compiled.upstream.get(site.reachId)!].sort(),
      expected,
    );
    assert.equal(
      graph.reaches.find((r) => r.id === site.reachId)!.toNode,
      site.osmNodeId,
    );
    for (const other of graph.sites)
      if (site !== other && flowsTo(site.osmNodeId, other.osmNodeId))
        assert.ok(site.code < other.code);
  }
});

test("network and review artifacts are byte-identical on repeated cached builds", () => {
  const again = buildNetwork(cacheText);
  for (const key of ["network", "review"] as const)
    assert.equal(serialize(built[key]), serialize(again[key]));
  assert.equal(
    serialize(built.network),
    readFileSync(
      new URL("../data/coimbra.network.json", import.meta.url),
      "utf8",
    ),
  );
  assert.equal(
    serialize(built.review),
    readFileSync(
      new URL("../data/direction-review.json", import.meta.url),
      "utf8",
    ),
  );
  const reordered = JSON.parse(cacheText) as Cache;
  reordered.elements.reverse();
  const shuffled = buildNetwork(JSON.stringify(reordered));
  assert.deepEqual(shuffled.network.reaches, graph.reaches);
  assert.deepEqual(shuffled.network.sites, graph.sites);
});

test("direction review retains uncertain OSM splits without reversing or inventing connections", () => {
  assert.deepEqual(
    built.review.flags.map((f) => f.nodeId),
    [11982083996, 12282800537, 13144918465],
  );
  assert.equal(built.review.automaticDirectionCorrections, 0);
  assert.ok(
    built.review.flags.every(
      (f) => f.sourceOsmWayIds.length && f.largestComponentReachIds.length,
    ),
  );
  assert.ok(built.review.flags.every((f) => f.selectedReachIds.length === 0));
});

test("synthetic smoke: outlet present, then branch absent narrows candidates", () => {
  const outlet = graph.sites.find(
    (s) =>
      graph.reaches.find((r) => r.id === s.reachId)!.downstream.length === 0,
  )!;
  const branch = graph.sites.find(
    (s) => !graph.reaches.find((r) => r.id === s.reachId)!.mainStem,
  )!;
  const present: ReviewedReport = {
    reportId: "01-synthetic-outlet",
    revision: 1,
    caseId: "smoke",
    signal: "foam",
    siteCode: outlet.code,
    value: "present",
    confirmed: true,
    source: "observation",
    review: "approved",
    assumptionsAcknowledged: true,
    absenceComparable: true,
  };
  const c = { id: "smoke", signal: "foam" };
  const before = investigate(graph, c, [present]);
  const after = investigate(graph, c, [
    present,
    {
      ...present,
      reportId: "02-synthetic-branch",
      siteCode: branch.code,
      value: "absent",
    },
  ]);
  assert.equal(before.candidates.length, 29);
  assert.ok(
    after.candidates.length > 0 &&
      after.candidates.length < before.candidates.length,
  );
  assert.equal(
    after.recommendation,
    null,
    "geographic recommendations remain disabled through inaccessible sites",
  );
  console.log(
    `Synthetic smoke: present at ${outlet.code}: ${before.candidates.length}; absent at branch ${branch.code}: ${after.candidates.length}.`,
  );
});
