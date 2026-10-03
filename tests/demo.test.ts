import { test } from "node:test";
import assert from "node:assert/strict";
import { network, seed, evaluate, transition } from "../src/demo.ts";
const at = "2026-10-04T00:00:00Z";
test("seed approves 35 -> 24 -> 14, pending live approval leaves 7, withdrawal restores 14", () => {
  const initial = seed(network, at);
  assert.deepEqual(
    initial.history.map((h) => [h.before, h.after]),
    [
      [35, 24],
      [24, 14],
      [14, 14],
    ],
  );
  assert.deepEqual(
    initial.observations.map((r) => [r.site_code, r.value]),
    [
      ["008", "absent"],
      ["010", "present"],
      ["009", "absent"],
    ],
  );
  assert.equal(initial.decisions[2]!.state, "unreviewed");
  assert.equal(evaluate(initial, network).candidates.length, 14);
  const approved = transition(
    initial,
    {
      type: "review",
      id: "seed-3",
      state: "approved",
      assumptions: true,
      comparable: true,
      at,
    },
    network,
  );
  assert.equal(approved.before, 14);
  assert.equal(approved.after, 7);
  const withdrawn = transition(
    approved,
    {
      type: "review",
      id: "seed-3",
      state: "unreviewed",
      assumptions: false,
      comparable: false,
      at,
    },
    network,
  );
  assert.equal(evaluate(withdrawn, network).candidates.length, 14);
  const conflict = transition(initial, { type: "conflict", at }, network);
  assert.equal(evaluate(conflict, network).status, "conflict");
  assert.equal(evaluate(conflict, network).recommendation, null);
  const unreviewed = {
    ...network,
    metadata: { ...network.metadata, topology_review_state: "unreviewed" },
  };
  assert.equal(evaluate(initial, unreviewed).recommendation, null);
  console.log(
    "Demo: absent 008 35 -> 24; present 010 24 -> 14; pending absent 009 approval 14 -> 7.",
  );
});
