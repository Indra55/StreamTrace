import { test } from "node:test";
import assert from "node:assert/strict";
import { fromDatabase } from "../engine/adapter.ts";
import { investigate } from "../engine/index.ts";
import { networks } from "../benchmarks/networks.ts";
test("stored decisions enforce current review state and comparability at engine boundary", () => {
  const r = {
    id: "r",
    case_id: "c",
    signal: "foam",
    site_code: "011",
    value: "absent" as const,
    confirmed: true,
  };
  const d = {
    report_id: "r",
    revision: 1,
    state: "approved" as const,
    assumptions_acknowledged: true,
    absence_comparable: false,
  };
  const c = { id: "c", signal: "foam" };
  assert.deepEqual(fromDatabase([r], []), []);
  assert.equal(
    investigate(networks.chain, c, fromDatabase([r], [d])).candidates.length,
    24,
  );
  assert.equal(
    investigate(
      networks.chain,
      c,
      fromDatabase([r], [{ ...d, absence_comparable: true }]),
    ).candidates.length,
    12,
  );
  assert.equal(
    investigate(
      networks.chain,
      c,
      fromDatabase([r], [{ ...d, state: "rejected", revision: 2 }]),
    ).candidates.length,
    24,
  );
  assert.throws(() => fromDatabase([], [d]), /missing/);
  assert.throws(() => fromDatabase([r, r], [d]), /Duplicate/);
});
