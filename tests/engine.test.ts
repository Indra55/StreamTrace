import { test } from "node:test";
import assert from "node:assert/strict";
import {
  investigate,
  createInvestigation,
  compileGraph,
  type ReviewedReport,
  type Graph,
} from "../engine/index.ts";
import { networks, network } from "../benchmarks/networks.ts";
const c = { id: "case", signal: "foam" };
export const report = (
  overrides: Partial<ReviewedReport> = {},
): ReviewedReport => ({
  reportId: "r",
  revision: 1,
  caseId: "case",
  signal: "foam",
  siteCode: "011",
  value: "present",
  confirmed: true,
  source: "observation",
  review: "approved",
  assumptionsAcknowledged: true,
  absenceComparable: true,
  ...overrides,
});

test("present intersects, absent subtracts; conflict pauses recommendation", () => {
  const a = report();
  const b = report({ reportId: "b", value: "absent" });
  assert.equal(investigate(networks.chain, c, [a]).candidates.length, 12);
  assert.equal(investigate(networks.chain, c, [b]).candidates.length, 12);
  const conflict = investigate(networks.chain, c, [a, b]);
  assert.equal(conflict.status, "conflict");
  assert.equal(conflict.recommendation, null);
  assert.deepEqual(conflict.steps.at(-1)!.after, []);
});
test("all untrusted/inadequate reports are inert, including approved AI drafts", () => {
  for (const change of [
    { source: "ai_draft" },
    { source: "parser_draft" },
    { review: "unreviewed" },
    { review: "rejected" },
    { review: "uncertain" },
    { confirmed: false },
    { assumptionsAcknowledged: false },
    { value: "cannot_tell" },
    { value: "absent", absenceComparable: false },
    { caseId: "other" },
    { signal: "odor" },
  ] as Partial<ReviewedReport>[]) {
    assert.deepEqual(
      investigate(networks.chain, c, [report(change)]),
      investigate(networks.chain, c, []),
    );
  }
});
test("deduplication and out-of-order revisions; conflicting same revisions fail closed", () => {
  const a = report(),
    b = report({ reportId: "copy" });
  const result = investigate(networks.chain, c, [a, a, b]);
  assert.equal(result.steps.length, 1);
  assert.deepEqual(
    result.candidates,
    investigate(networks.chain, c, [a]).candidates,
  );
  const withdrawn = report({ revision: 2, review: "rejected" });
  assert.deepEqual(
    investigate(networks.chain, c, [withdrawn, a]),
    investigate(networks.chain, c, [withdrawn]),
  );
  assert.throws(
    () => investigate(networks.chain, c, [a, report({ value: "absent" })]),
    /Conflicting/,
  );
});
test("balanced bisection, tie code ordering, inaccessible/checked sites, exhausted sites", () => {
  assert.equal(
    investigate(networks.chain, c, []).recommendation!.siteCode,
    "011",
  );
  const g = network([null, 0, 0]);
  assert.equal(investigate(g, c, []).recommendation!.siteCode, "001");
  g.sites = [...g.sites].reverse();
  assert.equal(investigate(g, c, []).recommendation!.siteCode, "001");
  g.sites = g.sites.map((s) => ({ ...s, accessible: false }));
  const r = investigate(g, c, [report({ siteCode: "000" })]);
  assert.equal(r.status, "no_useful_next_site");
  assert.equal(r.recommendation, null);
  const one = investigate(networks.chain, c, [report({ siteCode: "000" })]);
  assert.equal(one.status, "narrowed");
  assert.match(one.message, /not a confirmed source/);
});
test("invalid topology and references fail; crossing geometry is irrelevant", () => {
  for (const g of [
    network([1, 0]),
    network([3, null]),
    { reaches: [], sites: [] },
    {
      reaches: [
        { id: "x", downstream: [] },
        { id: "x", downstream: [] },
      ],
      sites: [],
    },
  ])
    assert.throws(() => compileGraph(g));
  assert.throws(() =>
    investigate(networks.chain, c, [report({ siteCode: "missing" })]),
  );
  assert.throws(() =>
    investigate(networks.chain, { ...c, initialCandidates: ["missing"] }, []),
  );
});
test("regression: withdrawal, replacement and conflict recovery must expand candidates", () => {
  const stream = createInvestigation(networks.chain, c);
  stream.update(report());
  assert.equal(
    stream.update(report({ revision: 2, review: "rejected" })).candidates
      .length,
    24,
  );
  stream.update(report({ revision: 3 }));
  assert.equal(
    stream.update(report({ reportId: "b", value: "absent" })).status,
    "conflict",
  );
  assert.equal(
    stream.update(report({ reportId: "b", revision: 2, review: "uncertain" }))
      .candidates.length,
    12,
  );
  assert.deepEqual(
    stream.update(report({ revision: 4, value: "absent" })).candidates,
    Array.from({ length: 12 }, (_, i) => String(i + 12)).sort(),
  );
});

// Dependency-free property generation: fixed seed, generated DAGs and independent forward-path oracle.
function rng(seed: number) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}
test("properties: 500 DAGs × 30 review changes agree with independent origin oracle", () => {
  const random = rng(20261003);
  for (let trial = 0; trial < 500; trial++) {
    const n = 2 + Math.floor(random() * 29);
    const g: Graph = {
      reaches: Array.from({ length: n }, (_, i) => ({
        id: String(i),
        downstream: Array.from({ length: n - i - 1 }, (_, j) => i + j + 1)
          .filter(() => random() < 0.12)
          .map(String),
      })),
      sites: Array.from({ length: n }, (_, i) => ({
        code: String(i).padStart(3, "0"),
        reachId: String(i),
        accessible: random() > 0.15,
      })),
    };
    const snapshots = new Map<string, ReviewedReport>();
    const history: ReviewedReport[] = [];
    const stream = createInvestigation(g, c);
    function reachesSite(origin: string, target: string): boolean {
      const seen = new Set<string>();
      const stack = [origin];
      while (stack.length) {
        const x = stack.pop()!;
        if (x === target) return true;
        if (seen.has(x)) continue;
        seen.add(x);
        stack.push(...g.reaches[Number(x)]!.downstream);
      }
      return false;
    }
    for (let k = 0; k < 30; k++) {
      const id = String(Math.floor(random() * 10));
      const prior = snapshots.get(id);
      const r = report({
        reportId: id,
        revision: (prior?.revision ?? 0) + 1,
        siteCode: g.sites[Math.floor(random() * n)]!.code,
        value: random() < 0.5 ? "present" : "absent",
        review: random() < 0.75 ? "approved" : "rejected",
        absenceComparable: random() < 0.85,
      });
      snapshots.set(id, r);
      history.push(r);
      const actual = stream.update(r);
      const active = [...snapshots.values()].filter(
        (x) =>
          x.review === "approved" &&
          (x.value === "present" || x.absenceComparable),
      );
      const expected = g.reaches
        .filter((origin) =>
          active.every(
            (a) =>
              reachesSite(origin.id, String(Number(a.siteCode))) ===
              (a.value === "present"),
          ),
        )
        .map((x) => x.id)
        .sort();
      assert.deepEqual(
        actual.candidates,
        expected,
        `seed=20261003 trial=${trial} step=${k}`,
      );
      assert.deepEqual(actual, investigate(g, c, history));
      assert.deepEqual(actual, investigate(g, c, [...history].reverse()));
      assert.deepEqual(actual, investigate(g, c, [...history, ...history]));
      if (actual.recommendation) {
        const rec = actual.recommendation;
        assert.ok(rec.present.length && rec.absent.length);
        assert.equal(rec.present.length + rec.absent.length, expected.length);
        assert.ok(!actual.checkedSites.includes(rec.siteCode));
        const choices = g.sites
          .filter((s) => s.accessible && !actual.checkedSites.includes(s.code))
          .map((s) => {
            const p = expected.filter((id) =>
              reachesSite(id, s.reachId),
            ).length;
            return { code: s.code, p, w: Math.max(p, expected.length - p) };
          })
          .filter((s) => s.p > 0 && s.p < expected.length)
          .sort((a, b) => a.w - b.w || a.code.localeCompare(b.code));
        assert.equal(rec.siteCode, choices[0]!.code);
      }
    }
  }
});
test("append-only elimination agrees at every prefix; naïve incremental reversal counterexample", () => {
  const g = networks.chain;
  const up = compileGraph(g).upstream;
  let incremental = g.reaches.map((r) => r.id).sort();
  const history: ReviewedReport[] = [];
  for (let i = 0; i < 24; i++) {
    const r = report({
      reportId: String(i),
      siteCode: String(i).padStart(3, "0"),
      value: i >= 7 ? "present" : "absent",
    });
    history.push(r);
    incremental = incremental.filter(
      (id) => up.get(String(i))!.has(id) === (r.value === "present"),
    );
    assert.deepEqual(incremental, investigate(g, c, history).candidates);
  }
  const initial = report();
  const stale = investigate(g, c, [initial]).candidates;
  const recomputed = investigate(g, c, [
    initial,
    report({ revision: 2, review: "rejected" }),
  ]).candidates;
  assert.notDeepEqual(stale, recomputed);
  assert.equal(recomputed.length, 24);
});

test("stream snapshots caller-owned input and rejected updates do not corrupt state", () => {
  const g = structuredClone(networks.chain);
  const instance = createInvestigation(g, c);
  const r = report();
  const before = instance.update(r);
  r.value = "absent";
  g.reaches = [];
  assert.deepEqual(instance.result(), before);
  assert.throws(() => instance.update(r), /Conflicting/);
  assert.deepEqual(instance.result(), before);
});
test("duplicate support survives withdrawal of only one report", () => {
  const a = report(),
    b = report({ reportId: "b" });
  assert.equal(
    investigate(networks.chain, c, [
      a,
      b,
      report({ revision: 2, review: "rejected" }),
    ]).candidates.length,
    12,
  );
  assert.equal(
    investigate(networks.chain, c, [
      a,
      b,
      report({ revision: 2, review: "rejected" }),
      report({ reportId: "b", revision: 2, review: "rejected" }),
    ]).candidates.length,
    24,
  );
});
