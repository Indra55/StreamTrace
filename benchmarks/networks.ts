import type { Graph } from "../engine/index.ts";
export function network(parents: readonly (number | null)[]): Graph {
  return {
    reaches: parents.map((p, i) => ({
      id: String(i),
      downstream: p === null ? [] : [String(p)],
    })),
    sites: parents.map((_, i) => ({
      code: String(i).padStart(3, "0"),
      reachId: String(i),
      accessible: true,
    })),
  };
}
export const networks = {
  chain: network(
    Array.from({ length: 24 }, (_, i) => (i === 23 ? null : i + 1)),
  ),
  balanced: network(
    Array.from({ length: 30 }, (_, i) =>
      i === 0 ? null : Math.floor((i - 1) / 2),
    ),
  ),
  uneven: network([
    null,
    0,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    3,
    12,
    13,
    14,
    6,
    16,
    17,
    8,
    19,
    20,
    21,
    22,
  ]),
};
