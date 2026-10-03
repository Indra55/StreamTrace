import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildNetwork,
  serialize,
  type Cache,
  type PrototypeReview,
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
const review = JSON.parse(
  readFileSync(
    new URL("../data/coimbra.prototype-review.json", import.meta.url),
    "utf8",
  ),
) as PrototypeReview;
const built = buildNetwork(cacheText, review);
const graph = built.network;

test("cached network compiles, has one outlet, seven real tributaries and 11 observation sites", () => {
  compileGraph(graph);
  assert.equal(graph.reaches.length, 35);
  assert.equal(graph.sites.length, 11);
  assert.equal(graph.metadata.stats.mainStemTributaries, 7);
  assert.equal(graph.reaches.filter((r) => !r.downstream.length).length, 1);
  assert.equal(graph.metadata.topology_review_state, "prototype_confirmed");
  assert.equal(graph.metadata.topology_review_note, review.note);
  assert.equal(graph.metadata.geographic_recommendations_enabled, true);
  assert.ok(
    graph.sites.every(
      (s) => s.accessible && s.access_review_state === "prototype_assumed",
    ),
  );
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
  const again = buildNetwork(cacheText, review);
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
  const identities = (sites: typeof graph.sites) =>
    sites.map(
      ({ accessible, access_review_state, access_note, ...identity }) =>
        identity,
    );
  assert.deepEqual(identities(shuffled.network.sites), identities(graph.sites));
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

test("one real OSM observation node just upstream of every main-stem tributary confluence", () => {
  const branches = graph.sites.filter(
    (s) => s.placement === "tributary_confluence",
  );
  assert.equal(branches.length, 7);
  const expectedConfluences = graph.metadata.stats.tributariesPerJunction
    .filter((j) => j.onMainStem)
    .map((j) => j.nodeId)
    .sort((a, b) => a - b);
  assert.deepEqual(
    branches.map((s) => s.confluenceNodeId!).sort((a, b) => a - b),
    expectedConfluences,
  );
  for (const site of branches) {
    assert.ok(
      cache.elements.some((w) =>
        w.nodes.some(
          (n, i) =>
            n === site.osmNodeId && w.nodes[i + 1] === site.confluenceNodeId,
        ),
      ),
    );
    assert.ok(!graph.reaches.find((r) => r.id === site.reachId)!.mainStem);
  }
  assert.equal(
    graph.sites.filter((s) => s.placement === "main_stem_partition").length,
    3,
  );
  assert.deepEqual(
    graph.sites.map((s) => s.code),
    Array.from({ length: 11 }, (_, i) => String(i + 1).padStart(3, "0")),
  );
  assert.equal(new Set(graph.sites.map((s) => s.id)).size, 11);
});

test("review is opt-in and bound to this cache; other networks default unreviewed", () => {
  const unreviewed = buildNetwork(cacheText).network;
  assert.equal(unreviewed.metadata.topology_review_state, "unreviewed");
  assert.equal(unreviewed.metadata.geographic_recommendations_enabled, false);
  assert.ok(unreviewed.sites.every((s) => !s.accessible));
  assert.equal(
    investigate(unreviewed, { id: "smoke", signal: "foam" }, []).recommendation,
    null,
  );
  assert.throws(
    () =>
      buildNetwork(cacheText, { ...review, cache_sha256: "different-cache" }),
    /match this exact cache/,
  );
});

test("synthetic smoke: first approved branch absence removes 11 of 35 candidates", () => {
  const compiled = compileGraph(graph);
  const branch = graph.sites
    .filter((s) => s.placement === "tributary_confluence")
    .sort(
      (a, b) =>
        compiled.upstream.get(b.reachId)!.size -
          compiled.upstream.get(a.reachId)!.size ||
        a.code.localeCompare(b.code),
    )[0]!;
  const absent: ReviewedReport = {
    reportId: "first-synthetic-branch",
    revision: 1,
    caseId: "smoke",
    signal: "foam",
    siteCode: branch.code,
    value: "absent",
    confirmed: true,
    source: "observation",
    review: "approved",
    assumptionsAcknowledged: true,
    absenceComparable: true,
  };
  const c = { id: "smoke", signal: "foam" };
  const before = investigate(graph, c, []),
    after = investigate(graph, c, [absent]);
  assert.equal(before.candidates.length, 35);
  assert.equal(after.candidates.length, 24);
  assert.ok(after.recommendation);
  assert.equal(before.recommendation?.siteCode, "009");
  assert.equal(before.recommendation?.present.length, 18);
  assert.equal(before.recommendation?.absent.length, 17);
  console.log(
    `First approved absence at tributary site ${branch.code}: ${before.candidates.length} -> ${after.candidates.length} candidates.`,
  );
  console.log("Site | placement | present candidates | absent candidates");
  for (const site of graph.sites) {
    const present = compiled.upstream.get(site.reachId)!.size;
    console.log(
      `${site.code} | ${site.placement} | ${present} | ${graph.reaches.length - present}`,
    );
  }
  console.log(
    `Recommended first site ${before.recommendation!.siteCode}: present ${before.recommendation!.present.length}, absent ${before.recommendation!.absent.length}.`,
  );
});
