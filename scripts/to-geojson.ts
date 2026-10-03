import { readFileSync, writeFileSync } from "node:fs";
import { compileGraph, type Reach, type Site } from "../engine/index.ts";

interface Network {
  reaches: (Reach & {
    names: string[];
    geometry: number[][];
    mainStem: boolean;
  })[];
  sites: (Site & { coordinates: number[] })[];
}
type Position = [number, number];
interface Feature {
  type: "Feature";
  geometry:
    | { type: "LineString"; coordinates: Position[] }
    | { type: "Point"; coordinates: Position };
  properties: Record<string, string | number>;
}

function position(value: number[]): Position {
  const [lon, lat] = value;
  if (
    value.length !== 2 ||
    !Number.isFinite(lon) ||
    !Number.isFinite(lat) ||
    Math.abs(lon!) > 180 ||
    Math.abs(lat!) > 90
  )
    throw new Error("Invalid longitude, latitude coordinate");
  return [lon!, lat!];
}

const network = JSON.parse(
  readFileSync(
    new URL("../data/coimbra.network.json", import.meta.url),
    "utf8",
  ),
) as Network;
compileGraph(network);

// Stable topological order: every reach precedes its downstream connections.
const byId = new Map(network.reaches.map((reach) => [reach.id, reach]));
const incoming = new Map(network.reaches.map((reach) => [reach.id, 0]));
for (const reach of network.reaches) {
  for (const id of reach.downstream) incoming.set(id, incoming.get(id)! + 1);
}
const ready = [...incoming.keys()]
  .filter((id) => incoming.get(id) === 0)
  .sort();
const ordered: Network["reaches"] = [];
while (ready.length) {
  const reach = byId.get(ready.shift()!)!;
  ordered.push(reach);
  for (const id of reach.downstream) {
    incoming.set(id, incoming.get(id)! - 1);
    if (incoming.get(id) === 0) ready.push(id);
  }
  ready.sort();
}
if (ordered.length !== network.reaches.length)
  throw new Error("Incomplete downstream order");
const outlets = ordered.filter((reach) => reach.downstream.length === 0);
if (outlets.length !== 1) throw new Error("Expected exactly one outlet");

const features: Feature[] = [];
function point(coordinates: Position, title: string, color: string) {
  features.push({
    type: "Feature",
    geometry: { type: "Point", coordinates },
    properties: { title, "marker-color": color },
  });
}

for (const reach of ordered) {
  if (reach.geometry.length < 2)
    throw new Error(`Insufficient geometry: ${reach.id}`);
  const coordinates = reach.geometry.map(position);
  features.push({
    type: "Feature",
    geometry: { type: "LineString", coordinates },
    properties: {
      id: reach.id,
      name: reach.names.join(" / ") || "Unnamed stream",
      stroke: reach.mainStem ? "#1e3a8a" : "#60a5fa",
      "stroke-width": 3,
    },
  });
  point(coordinates[0]!, `${reach.id} upstream`, "#16a34a");
  point(coordinates.at(-1)!, `${reach.id} downstream`, "#dc2626");
}
for (const site of [...network.sites].sort((a, b) =>
  a.code.localeCompare(b.code),
)) {
  point(position(site.coordinates), site.code, "#2563eb");
}
point(position(outlets[0]!.geometry.at(-1)!), "OUTLET", "#000000");

writeFileSync(
  new URL("../data/coimbra.debug.geojson", import.meta.url),
  JSON.stringify({ type: "FeatureCollection", features }, null, 2) + "\n",
);
console.log(
  `Wrote ${features.length} features: ${ordered.length} lines, ${ordered.length} upstream points, ${ordered.length} downstream points, ${network.sites.length} observation sites, 1 outlet.`,
);
