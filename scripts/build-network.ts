import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import {
  compileGraph,
  investigate,
  type Reach,
  type Site,
} from "../engine/index.ts";

export interface OsmWay {
  type: string;
  id: number;
  nodes: number[];
  geometry: { lat: number; lon: number }[];
  tags?: Record<string, string>;
}
export interface Cache {
  elements: OsmWay[];
  osm3s: { timestamp_osm_base: string };
  remark?: string;
}
interface Edge {
  from: number;
  to: number;
  wayIds: number[];
}
export interface GeoReach extends Reach {
  fromNode: number;
  toNode: number;
  nodeIds: number[];
  sourceOsmWayIds: number[];
  names: string[];
  geometry: number[][];
  mainStem: boolean;
}
interface GeoSite extends Site {
  osmNodeId: number;
  coordinates: number[];
  access_review_state: "unreviewed" | "prototype_assumed";
  id: string;
  placement: "tributary_confluence" | "main_stem_partition" | "outlet";
  confluenceNodeId: number | null;
  access_note: string;
  label: string;
}
const root = new URL("../", import.meta.url);
const numeric = (xs: Iterable<number>) =>
  [...new Set(xs)].sort((a, b) => a - b);
const edgeKey = (a: number, b: number) => `${a}:${b}`;
const reachId = (nodes: number[]) =>
  `osm-${nodes[0]}-${nodes.at(-1)}-${createHash("sha256").update(nodes.join(",")).digest("hex").slice(0, 10)}`;
export const serialize = (value: unknown) =>
  JSON.stringify(value, null, 2) + "\n";

export interface PrototypeReview {
  state: "prototype_confirmed";
  cache_sha256: string;
  note: string;
  reviewed_by: string;
  scope: string;
  site_access_note: string;
}
export function buildNetwork(cacheText: string, review?: PrototypeReview) {
  const cacheHash = createHash("sha256").update(cacheText).digest("hex");
  if (
    review &&
    (review.state !== "prototype_confirmed" ||
      review.cache_sha256 !== cacheHash ||
      !review.note ||
      !review.reviewed_by)
  )
    throw new Error(
      "Prototype review must match this exact cache and include provenance",
    );
  const cache = JSON.parse(cacheText) as Cache;
  if (cache.remark || !Array.isArray(cache.elements) || !cache.elements.length)
    throw new Error("Incomplete or empty Overpass cache");
  const ways = cache.elements
    .filter((w) => w.type === "way")
    .sort((a, b) => a.id - b.id);
  const wayMap = new Map(ways.map((w) => [w.id, w]));
  const coords = new Map<number, number[]>();
  const edgeMap = new Map<string, Edge>();
  for (const w of ways) {
    if (!w.nodes || w.nodes.length < 2 || w.geometry.length !== w.nodes.length)
      throw new Error(`Missing geometry on ${w.id}`);
    w.nodes.forEach((n, i) => {
      const p = w.geometry[i]!;
      const xy = [p.lon, p.lat];
      if (!Number.isSafeInteger(n) || !xy.every(Number.isFinite))
        throw new Error("Invalid OSM node");
      if (coords.has(n) && JSON.stringify(coords.get(n)) !== JSON.stringify(xy))
        throw new Error(`Conflicting geometry for node ${n}`);
      coords.set(n, xy);
      if (i) {
        const from = w.nodes[i - 1]!;
        if (from === n) throw new Error("Zero-length node edge");
        const key = edgeKey(from, n);
        const e = edgeMap.get(key) ?? { from, to: n, wayIds: [] };
        e.wayIds.push(w.id);
        edgeMap.set(key, e);
      }
    });
  }
  const edges = [...edgeMap.values()].sort(
    (a, b) => a.from - b.from || a.to - b.to,
  );
  for (const e of edges) e.wayIds = numeric(e.wayIds);
  function index(es: Edge[]) {
    const incoming = new Map<number, Edge[]>(),
      outgoing = new Map<number, Edge[]>();
    for (const e of es) {
      incoming.set(e.to, [...(incoming.get(e.to) ?? []), e]);
      outgoing.set(e.from, [...(outgoing.get(e.from) ?? []), e]);
    }
    return { incoming, outgoing };
  }
  const adjacent = new Map<number, Set<number>>();
  for (const e of edges)
    for (const [a, b] of [
      [e.from, e.to],
      [e.to, e.from],
    ] as [number, number][]) {
      if (!adjacent.has(a)) adjacent.set(a, new Set());
      adjacent.get(a)!.add(b);
    }
  const visited = new Set<number>(),
    components: number[][] = [];
  for (const n of numeric(adjacent.keys())) {
    if (visited.has(n)) continue;
    const stack = [n],
      component: number[] = [];
    visited.add(n);
    while (stack.length) {
      const a = stack.pop()!;
      component.push(a);
      for (const b of adjacent.get(a)!) {
        if (!visited.has(b)) {
          visited.add(b);
          stack.push(b);
        }
      }
    }
    components.push(component.sort((a, b) => a - b));
  }
  components.sort((a, b) => b.length - a.length || a[0]! - b[0]!);
  const largest = new Set(components[0]);
  const retained = edges.filter((e) => largest.has(e.from));
  const full = index(retained);

  // Explicit geographic window on a single mapped Mondego way. Include every upstream
  // branch feeding its interior, stopping only at the upstream main-stem boundary.
  const mainWay = wayMap.get(23252421);
  if (!mainWay || mainWay.tags?.name !== "Rio Mondego")
    throw new Error("Curated Mondego way missing");
  const start = 251615191,
    end = 251615233;
  const from = mainWay.nodes.indexOf(start),
    to = mainWay.nodes.indexOf(end);
  if (from < 0 || to <= from || !largest.has(start))
    throw new Error("Curated boundaries unavailable in largest component");
  const stem = mainWay.nodes.slice(from, to + 1);
  const stemNodes = new Set(stem);
  const selected = new Map<string, Edge>();
  for (let i = 1; i < stem.length; i++) {
    const a = stem[i - 1]!,
      b = stem[i]!;
    selected.set(edgeKey(a, b), edgeMap.get(edgeKey(a, b))!);
  }
  const stack = stem.slice(1),
    expanded = new Set<number>();
  while (stack.length) {
    const n = stack.pop()!;
    if (n === start || expanded.has(n)) continue;
    expanded.add(n);
    for (const e of full.incoming.get(n) ?? []) {
      selected.set(edgeKey(e.from, e.to), e);
      stack.push(e.from);
    }
  }
  const selectedEdges = [...selected.values()].sort(
    (a, b) => a.from - b.from || a.to - b.to,
  );
  const local = index(selectedEdges);
  function collapse(es: Edge[], sites = new Set<number>()): GeoReach[] {
    const { incoming, outgoing } = index(es);
    const consumed = new Set<string>();
    const reaches: GeoReach[] = [];
    const boundary = (n: number) =>
      sites.has(n) ||
      (incoming.get(n)?.length ?? 0) !== 1 ||
      (outgoing.get(n)?.length ?? 0) !== 1;
    for (const n of numeric(outgoing.keys()))
      if (boundary(n))
        for (const first of outgoing.get(n)!) {
          const nodes = [n];
          const ids = new Set<number>();
          let e = first;
          while (true) {
            const key = edgeKey(e.from, e.to);
            if (consumed.has(key))
              throw new Error("Cycle or overlapping collapsed path");
            consumed.add(key);
            nodes.push(e.to);
            e.wayIds.forEach((id) => ids.add(id));
            if (boundary(e.to)) break;
            e = outgoing.get(e.to)![0]!;
          }
          reaches.push({
            id: reachId(nodes),
            downstream: [],
            fromNode: n,
            toNode: nodes.at(-1)!,
            nodeIds: nodes,
            sourceOsmWayIds: numeric(ids),
            names: [
              ...new Set(
                numeric(ids)
                  .map((id) => wayMap.get(id)!.tags?.name)
                  .filter((name): name is string => !!name),
              ),
            ].sort(),
            geometry: nodes.map((id) => coords.get(id)!),
            mainStem: nodes.every((id) => stemNodes.has(id)),
          });
        }
    if (consumed.size !== es.length)
      throw new Error("Uncollapsed cycle in cached topology");
    for (const r of reaches)
      r.downstream = reaches
        .filter((next) => next.fromNode === r.toNode)
        .map((next) => next.id)
        .sort();
    return reaches.sort(
      (a, b) =>
        a.fromNode - b.fromNode ||
        a.toNode - b.toNode ||
        a.id.localeCompare(b.id),
    );
  }
  const natural = collapse(selectedEdges);
  // The nearest existing branch node before each main-stem confluence is an
  // observation boundary. No coordinate interpolation or invented OSM IDs.
  const confluences = stem.filter(
    (n) => (local.incoming.get(n)?.length ?? 0) > 1,
  );
  const branchSites = confluences.flatMap((confluenceNodeId) =>
    (local.incoming.get(confluenceNodeId) ?? [])
      .filter((e) => !stemNodes.has(e.from))
      .map((e) => ({ nodeId: e.from, confluenceNodeId })),
  );
  const siteNodes = new Set([end, ...branchSites.map((s) => s.nodeId)]);
  const interiorStem = stem.filter(
    (n) =>
      n !== end &&
      n !== start &&
      (local.incoming.get(n)?.length ?? 0) === 1 &&
      (local.outgoing.get(n)?.length ?? 0) === 1,
  );
  // Three main-stem checks target quarters of the final candidate set. Evaluate
  // actual reach partitions, including splits, and break equal scores by OSM ID.
  const finalReachCount = natural.length + branchSites.length + 3;
  for (const fraction of [0.25, 0.5, 0.75]) {
    const choices = interiorStem
      .filter((n) => !siteNodes.has(n))
      .map((nodeId) => {
        const trial = collapse(selectedEdges, new Set([...siteNodes, nodeId]));
        const r = trial.find((r) => r.toNode === nodeId)!;
        const present = compileGraph({
          reaches: trial,
          sites: [],
        }).upstream.get(r.id)!.size;
        return {
          nodeId,
          score: Math.abs(present - finalReachCount * fraction),
        };
      })
      .sort((a, b) => a.score - b.score || a.nodeId - b.nodeId);
    if (!choices.length)
      throw new Error("Insufficient existing main-stem observation nodes");
    siteNodes.add(choices[0]!.nodeId);
  }
  for (const n of siteNodes)
    if (
      n !== end &&
      ((local.incoming.get(n)?.length ?? 0) !== 1 ||
        (local.outgoing.get(n)?.length ?? 0) !== 1)
    )
      throw new Error("Observation site is not interior to a reach");
  const reaches = collapse(selectedEdges, siteNodes);
  compileGraph({ reaches, sites: [] });
  // Longest path from a retained source orders sites upstream to downstream.
  const depth = new Map<string, number>();
  function level(id: string): number {
    if (depth.has(id)) return depth.get(id)!;
    const parents = reaches.filter((r) => r.downstream.includes(id));
    const d = parents.length
      ? 1 + Math.max(...parents.map((r) => level(r.id)))
      : 0;
    depth.set(id, d);
    return d;
  }
  const ordered = numeric(siteNodes).sort((a, b) => {
    const ra = reaches.find((r) => r.toNode === a)!,
      rb = reaches.find((r) => r.toNode === b)!;
    return level(ra.id) - level(rb.id) || a - b;
  });
  const sites: GeoSite[] = ordered.map((n, i) => ({
    code: String(i + 1).padStart(3, "0"),
    reachId: reaches.find((r) => r.toNode === n)!.id,
    accessible: !!review,
    osmNodeId: n,
    coordinates: coords.get(n)!,
    access_review_state: review ? "prototype_assumed" : "unreviewed",
    access_note:
      review?.site_access_note ??
      "Physical access unreviewed; not eligible for recommendations",
    id: `osm-site-${n}`,
    placement:
      n === end
        ? "outlet"
        : branchSites.some((s) => s.nodeId === n)
          ? "tributary_confluence"
          : "main_stem_partition",
    confluenceNodeId:
      branchSites.find((s) => s.nodeId === n)?.confluenceNodeId ?? null,
    label: "StreamTrace identifiers, not official OneAquaHealth sites",
  }));
  const junctions = numeric(local.incoming.keys())
    .filter((n) => local.incoming.get(n)!.length > 1)
    .map((nodeId) => ({
      nodeId,
      incomingBranches: local.incoming.get(nodeId)!.length,
      tributaryCount: local.incoming.get(nodeId)!.length - 1,
      onMainStem: stemNodes.has(nodeId),
    }));
  const outlets = numeric(local.incoming.keys()).filter(
    (n) => !local.outgoing.has(n),
  );
  if (outlets.length !== 1 || outlets[0] !== end)
    throw new Error("Curated network must have one boundary outlet");
  const fullReaches = collapse(retained);
  const flags = numeric(
    new Set([...full.incoming.keys(), ...full.outgoing.keys()]),
  ).flatMap((nodeId) => {
    const ins = full.incoming.get(nodeId) ?? [],
      outs = full.outgoing.get(nodeId) ?? [];
    const reasons: string[] = [];
    if (outs.length > 1)
      reasons.push(
        "Multiple outflows: direction conflict or unconfirmed bifurcation; out geom supplies no node tags to confirm bifurcation.",
      );
    if (ins.length > 1 && !outs.length)
      reasons.push(
        "Multiple inflows with no downstream continuation: possible opposing way directions or terminal structure.",
      );
    if (!reasons.length) return [];
    const sourceOsmWayIds = numeric([...ins, ...outs].flatMap((e) => e.wayIds));
    return [
      {
        nodeId,
        reasons,
        sourceOsmWayIds,
        largestComponentReachIds: fullReaches
          .filter((r) => r.fromNode === nodeId || r.toNode === nodeId)
          .map((r) => r.id),
        selectedReachIds: reaches
          .filter((r) => r.fromNode === nodeId || r.toNode === nodeId)
          .map((r) => r.id),
        selectedSourceWayReachIds: reaches
          .filter((r) =>
            r.sourceOsmWayIds.some((id) => sourceOsmWayIds.includes(id)),
          )
          .map((r) => r.id),
      },
    ];
  });
  const omittedIncomingAtBoundary = (full.incoming.get(start) ?? []).map(
    (e) => ({ fromNode: e.from, toNode: e.to, sourceOsmWayIds: e.wayIds }),
  );
  const metadata = {
    source: "OpenStreetMap contributors (ODbL)",
    license_url: "https://www.openstreetmap.org/copyright",
    retrieval_date: "2026-10-03",
    retrieval_date_basis: "User supplied cache received locally on 2026-10-03",
    osm_base_timestamp: cache.osm3s.timestamp_osm_base,
    bbox: [40.1, -8.5, 40.26, -8.28],
    query:
      '[out:json][timeout:60];way["waterway"~"river|stream"](40.10,-8.50,40.26,-8.28);out geom;',
    cache_sha256: createHash("sha256").update(cacheText).digest("hex"),
    topology_review_state: review?.state ?? "unreviewed",
    topology_review_note: review?.note ?? "No visual developer review recorded",
    topology_reviewed_by: review?.reviewed_by ?? null,
    geographic_recommendations_enabled: !!review,
    site_label: "StreamTrace identifiers, not official OneAquaHealth sites",
    geometry_order: "longitude, latitude",
    direction: "OSM way node order; no automatic reversal",
    curation: {
      mainStemWayId: 23252421,
      upstreamBoundaryNode: start,
      outletBoundaryNode: end,
      method:
        "Contiguous Mondego section with every cached upstream branch joining inside the section. The upstream main-stem boundary truncates the larger river; the outlet is a study boundary, not a river mouth.",
      omittedIncomingAtBoundary,
      sitePlacement:
        "Nearest existing tributary node before each main-stem confluence, three main-stem quarter-partition checks, and the boundary outlet",
      siteCodePolicy:
        "Deterministic topological order with OSM-node ties; stable osm-site IDs preserve identity when expanding and renumbering sites",
      reachBudget:
        "The 11-site revision supersedes the original 30-reach cap; extra reaches subdivide unchanged OSM edges",
    },
    stats: {
      cachedWays: ways.length,
      weakComponents: components.length,
      largestComponentNodes: largest.size,
      largestComponentReaches: fullReaches.length,
      naturalReaches: natural.length,
      reaches: reaches.length,
      sites: sites.length,
      junctions: junctions.length,
      outlets: outlets.length,
      mainStemTributaries: junctions
        .filter((j) => j.onMainStem)
        .reduce((s, j) => s + j.tributaryCount, 0),
      tributariesPerJunction: junctions,
    },
  };
  compileGraph({ reaches, sites });
  if (sites.length < 10 || sites.length > 12)
    throw new Error(`Curation produced ${sites.length} sites, outside target`);
  return {
    network: { metadata, reaches, sites },
    review: {
      topology_review_state: "unreviewed",
      scope: "Largest weakly connected component of cached waterways",
      automaticDirectionCorrections: 0,
      flags,
      notice:
        "All flow directions and observation access need human confirmation, including unflagged reaches.",
    },
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const result = buildNetwork(
    readFileSync(new URL("data/coimbra_osm.json", root), "utf8"),
    JSON.parse(
      readFileSync(new URL("data/coimbra.prototype-review.json", root), "utf8"),
    ) as PrototypeReview,
  );
  writeFileSync(
    new URL("data/coimbra.network.json", root),
    serialize(result.network),
  );
  writeFileSync(
    new URL("data/direction-review.json", root),
    serialize(result.review),
  );
  console.log(serialize(result.network.metadata.stats));
  console.log(
    `Direction-review flags: ${result.review.flags.length}; selected affected reaches: ${new Set(result.review.flags.flatMap((f) => f.selectedReachIds)).size}`,
  );
  const compiled = compileGraph(result.network);
  console.log("Site | placement | present candidates | absent candidates");
  for (const site of result.network.sites) {
    const present = compiled.upstream.get(site.reachId)!.size;
    console.log(
      `${site.code} | ${site.placement} | ${present} | ${result.network.reaches.length - present}`,
    );
  }
  const first = investigate(
    result.network,
    { id: "partition-preview", signal: "foam" },
    [],
  ).recommendation;
  console.log(
    first
      ? `Recommended first site: ${first.siteCode}; present ${first.present.length}, absent ${first.absent.length}.`
      : "No first-site recommendation available.",
  );
}
