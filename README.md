# StreamTrace core

Deterministic investigation planning and reviewer authorization. This delivery includes the core layer and a cached Coimbra stream network. No UI, deployment, or AI calls are included. Benchmark graphs are explicitly synthetic.

**StreamTrace supports investigation planning; it does not identify chemicals or certify water safety.**

## Run

Node 22.18+ runs the TypeScript tests and benchmark without installing dependencies:

```sh
npm test
npm run benchmark
npm install
npm run typecheck
```

`benchmarks/RESULTS.md` and `benchmarks/results.json` contain generated results. Fixed seed `20261003`, every origin, 50 random trials per origin. Missing and erroneous observations are separate scenarios, with their precise injection rules recorded in the results. Wrong singleton outcomes are reported separately from conflicts. The baselines choose all unattempted accessible sites; bisection only chooses useful partitions. Results support claims about these simulations only.

## Engine contract

Import `investigate`, `createInvestigation`, and types from `engine/index.ts`. Edges point downstream; a site's reading is taken at the downstream end of its reach, including that reach. Graphs must be nonempty DAGs with valid unique identifiers. Geometric crossings never create connections. Supply the same graph, case signal, and original candidate set throughout a case.

The model assumes one persistent origin region, normal downstream propagation, and comparable observations. Present intersects candidates with the upstream set. Absent subtracts that set only with explicit comparability confirmation. Only confirmed observations with approved reviews and acknowledged assumptions affect the engine. Drafts, uncertain/rejected/unreviewed reports, other cases/signals, and `cannot_tell` are inert. AI confidence is not an engine input.

Each report has a stable ID and monotonically increasing review revision. The highest revision wins regardless of arrival order. Different payloads for the same ID/revision throw rather than silently choose one. Identical assertions at the same site are applied once, but supporting reports remain independent: withdrawing one duplicate does not withdraw another. Resubmit the original report UUID on transport retries; a unique-key response denotes an existing submission, never overwrite its contents.

Results contain canonical, report-ID-ordered before/after candidate sets and set-operation explanations (not chronological audit order). Empty candidates pause recommendations; one candidate is a priority region, never a confirmed source. Bisection minimizes the larger partition, requires two nonempty partitions, excludes inaccessible/adequately checked sites, and ties by ascending site code. With no useful site, the message recommends researcher review. With no effective evidence, status remains `awaiting_review` even when no site is available.

`createInvestigation` snapshots inputs and recomputes on every incoming revision. It intentionally has no subtract-only incremental cache: review withdrawals and replacements can expand candidates. `fromDatabase` in `engine/adapter.ts` joins immutable observations with current database decisions. It must receive database results, never arbitrary client claims of authorization. Pure TypeScript types are not an authorization boundary. A future demo should own a separate in-memory instance and never invoke production review APIs.

## Reviewer security

Apply `supabase/migrations/202610030001_core.sql` to Supabase. Public signup is disabled in `supabase/config.toml`; set the equivalent hosted-project Auth setting before deployment. Provision pre-confirmed reviewer users using admin tooling and insert their UUIDs into `public.reviewers` as a database administrator. Never expose the service-role key or grant client roles allowlist writes.

Anonymous clients can insert confirmed observations but cannot modify them or write reviews. Authenticated users require a database allowlist entry; editable JWT/user metadata is not trusted. Revoke membership to stop subsequent review writes without waiting for token expiry. The allowlist is global for this deployment, not per-case tenancy.

Use the caller's authenticated JWT with RPC `review_report(p_report_id, p_state, p_assumptions, p_comparable)`. The RPC is security-invoker: grants, RLS, and the review guard all apply. Its atomic upsert serializes concurrent decisions; the last serialized decision wins. The guard supplies reviewer identity, revision, and timestamp. Approval requires assumptions and, for absence, comparability. Repeating the current decision is a no-op. Review changes append immutable audit events in the same transaction. Reports and decision history are publicly readable in this core schema; do not collect private contact details in notes.

Security-definer helpers use an empty search path and fully qualified relations. Client roles cannot execute trigger helpers directly. See [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Verification and limits

- Engine tests: unit regressions and 500 generated DAGs × 30 changes checked against an independent forward-reachability oracle, including shuffled history, duplicate replay, and full-recompute/streaming agreement.
- Adversarial findings: naïve incremental filtering disagrees after approval withdrawal, replacement, and conflict recovery. Recompute restores candidates; tests preserve these counterexamples. See `ADVERSARIAL_REVIEW.md`.
- TypeScript strict typecheck passed using an existing local compiler. Dependency installation was blocked by registry DNS access in the implementation environment.
- Benchmark executed and generated all 27 rows. All clean scenarios resolved every origin correctly. Erroneous observations can produce wrong singleton outcomes without a conflict.
- PostgreSQL/RLS tests are supplied but **not executed here**: no PostgreSQL server binary, no local server, and Docker socket access was denied. Hosted Supabase/JWT/PostgREST and concurrent database sessions remain unverified. Do not describe RLS as deployment-verified until these tests and hosted integration checks pass.

Run SQL tests against an **empty disposable PostgreSQL database** as its superuser:

```sh
TEST_DATABASE_URL=postgresql://... npm run test:rls
```

The harness bootstraps `anon`, `authenticated`, and a minimal `auth.uid()` equivalent, then applies the actual migration. It tests anonymous/nonreviewer denial, allowlist escalation, forged identities/revisions, immutable submissions/audit, required assumptions, idempotent approvals, reversal history, revocation, and RLS under accidentally broadened table grants. It does not emulate Supabase's JWT validation. Never run this bootstrap against production or an existing Supabase database.

## Coimbra stream network

`data/coimbra_osm.json` is the unchanged user-downloaded Overpass cache, received on **2026-10-03**. Its OSM database timestamp is `2026-10-03T17:02:05Z`, which is distinct from the retrieval date. Attribution: **OpenStreetMap contributors (ODbL)**. See [OpenStreetMap copyright and license](https://www.openstreetmap.org/copyright). The derived network records the cache SHA-256, retrieval-date basis, bounding box, and exact query:

```text
[out:json][timeout:60];way["waterway"~"river|stream"](40.10,-8.50,40.26,-8.28);out geom;
```

Rebuild entirely from the local cache:

```sh
node scripts/build-network.ts
node tests/network.test.ts
```

The builder never makes network requests. It connects consecutive shared OSM node IDs, follows their way order as the provisional downstream direction, and collapses nodes with exactly one inflow and one outflow. Coordinates are retained only for drawing, never for inferring connections. The query returns whole ways, so some cached geometry extends outside the query bounding box.

The cache contains 584 ways and 26 weakly connected components. The largest component has 5,321 nodes and 248 collapsed reaches. Curation takes a contiguous Rio Mondego section of way `23252421`, from node `251615191` to node `251615233`, retaining every cached upstream branch that joins inside that section. It does not randomly prune tributaries. Its seven direct tributaries include Ribeira de Misarela and six unnamed mapped streams. The upstream boundary intentionally excludes the rest of the Mondego catchment; this is a bounded study graph, not a claim that every possible origin lies within it. The single outlet is the study boundary before the Ceira confluence, not a river mouth.

The resulting `data/coimbra.network.json` contains **29 reaches, 12 junctions, seven main-stem tributaries, one outlet, and five candidate observation sites**. Every junction has two incoming branches, so each contributes one tributary relative to a continuing stem. Per-junction node IDs and counts are printed by the builder and stored in metadata.

There are 25 natural reaches. Four interior observation nodes split them into 29: two fixed existing Mondego nodes and the middle existing OSM node of each of the two longest branch reaches by node count. The fifth site is at the boundary outlet. These are candidate locations, not field-verified access points. Site codes `001` through `005` follow topological upstream-to-downstream order, with OSM node IDs breaking ties. Their label is **StreamTrace identifiers, not official OneAquaHealth sites**. Reach geometry uses longitude, latitude order and retains original node IDs, source way IDs, and available names.

`data/direction-review.json` flags three nodes in the largest component:

| OSM node | Issue | Source OSM ways |
|---|---|---|
| 11982083996 | Ten outgoing branches, bifurcation or structure unconfirmed | 23252421 and 1430017552 through 1430017561 |
| 12282800537 | Two outgoing Ceira paths, bifurcation unconfirmed | 23392592, 1133776319 |
| 13144918465 | Two outgoing branches, bifurcation unconfirmed | 23252421, 1430017580 |

The review file enumerates the exact affected collapsed reach IDs. None of these junctions is inside the selected section. Ten selected Mondego reaches share source way `23252421` with downstream flags; those are listed separately as `selectedSourceWayReachIds`. Unflagged geometry is not validated hydrology. This cache contains way geometry but no node tags, so the builder cannot establish whether the splits are genuine bifurcations. It never reverses a way automatically.

**Topology and flow direction need human confirmation before geographic recommendations are enabled.** Metadata remains `topology_review_state: "unreviewed"` and `geographic_recommendations_enabled: false`. Every site's `accessible` flag is false pending access review, so the unchanged engine cannot recommend these geographic sites yet.

Validation passed: `compileGraph()`, exact raw-OSM edge and geometry provenance, complete upstream-branch retention within the study boundary, independent node-level upstream traversal at every site, stable site ordering, and byte-identical rebuilds of both output files. A separate synthetic smoke test gives 29 candidates after present at outlet site `005`, then 28 after absent at branch site `001`. Synthetic assertions exist only in the test, not the geographic files. The existing engine and adapter tests and strict TypeScript check also passed.

Human hydrology review, physical site access, and real observations remain unverified. The raw cache and generated artifacts are present in the workspace; a Git commit could not be created because this workspace has no initialized Git repository and its `.git` directory is read-only.
