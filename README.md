# StreamTrace core

Deterministic investigation planning and reviewer authorization. This delivery includes the core layer, a cached Coimbra stream network, and an isolated reviewer prototype. Benchmark graphs are explicitly synthetic.

**StreamTrace supports investigation planning; it does not identify chemicals or certify water safety.**

## Run

Node 22.18+ is required. Install dependencies before running the full suite:

```sh
npm install
npm test
npm run benchmark
npm run typecheck
```

`benchmarks/RESULTS.md` and `benchmarks/results.json` contain generated results. Fixed seed `20261003`, every origin, 50 random trials per origin. Missing and erroneous observations are separate scenarios, with their precise injection rules recorded in the results. Wrong singleton outcomes are reported separately from conflicts. The baselines choose all unattempted accessible sites; bisection only chooses useful partitions. Results support claims about these simulations only.

## Engine contract

Import `investigate`, `createInvestigation`, and types from `engine/index.ts`. Edges point downstream; a site's reading is taken at the downstream end of its reach, including that reach. Graphs must be nonempty DAGs with valid unique identifiers. Geometric crossings never create connections. Supply the same graph, case signal, and original candidate set throughout a case.

The model assumes one persistent origin region, normal downstream propagation, and comparable observations. Present intersects candidates with the upstream set. Absent subtracts that set only with explicit comparability confirmation. Only confirmed observations with approved reviews and acknowledged assumptions affect the engine. Drafts, uncertain/rejected/unreviewed reports, other cases/signals, and `cannot_tell` are inert. AI confidence is not an engine input.

Each report has a stable ID and monotonically increasing review revision. The highest revision wins regardless of arrival order. Different payloads for the same ID/revision throw rather than silently choose one. Identical assertions at the same site are applied once, but supporting reports remain independent: withdrawing one duplicate does not withdraw another. Resubmit the original report UUID on transport retries; a unique-key response denotes an existing submission, never overwrite its contents.

Results contain canonical, report-ID-ordered before/after candidate sets and set-operation explanations (not chronological audit order). Empty candidates pause recommendations; one candidate is a priority region, never a confirmed source. Bisection minimizes the larger partition, requires two nonempty partitions, excludes inaccessible/adequately checked sites, and ties by ascending site code. With no useful site, the message recommends researcher review. With no effective evidence, status remains `awaiting_review` even when no site is available.

`createInvestigation` snapshots inputs and recomputes on every incoming revision. It intentionally has no subtract-only incremental cache: review withdrawals and replacements can expand candidates. `fromDatabase` in `engine/adapter.ts` joins immutable observations with current database decisions. It must receive database results, never arbitrary client claims of authorization. Pure TypeScript types are not an authorization boundary. A future demo should own a separate in-memory instance and never invoke production review APIs.

## Node backend and Neon

The schema is Postgres-first and does not depend on Supabase.

The API lives in `api/` and uses Hono, node-postgres, Zod, jose and Argon2. The engine and adapter keep their existing semantics. The frontend remains an isolated in-memory prototype and has not been connected to these routes.

Copy `.env.example` to the ignored `.env` and replace every placeholder. `DATABASE_URL_ADMIN` uses the owner role on a direct host. `DATABASE_URL` uses the restricted `app_login` role on a pooler host. Both use TLS. Connection strings, passwords and tokens must stay out of logs and version control. URL channel-binding options are removed before driver configuration. The provided `DB_KEY` owner connection was used for initial local configuration; it is not an API authentication key.

```sh
npm install
npm run migrate
npm run check:runtime
npm run api
```

The migration runner applies ordered, checksummed migrations and then the idempotent role bootstrap in one transaction. It reads `APP_LOGIN_PASSWORD` rather than embedding a password in SQL files. SQL-created roles avoid privileged dashboard role defaults. Startup refuses a superuser, BYPASSRLS, owner membership, extra role membership, creation privileges or tables without FORCE RLS. Each request switches roles and sets JWT claims locally inside a transaction, with rollback and connection cleanup.

`GROQ_API_KEY` and `GROQ_MODEL` are optional at startup. Without them, drafts return the documented fallback. Use a model that supports JSON object mode. Draft requests are limited to 500 characters, have a five-second deadline, and return only a value, clamped confidence and `source: "ai_draft"`. Drafts have no persistence or approval path. No free-text chemical or cause claims are returned.

### Routes

| Route | Access and behavior |
| --- | --- |
| `POST /api/reports` | Anonymous JSON submission. Fields: `id`, `case_id`, `signal`, `site_code`, `value`, `confirmed: true`, `observed_at`, optional `origin` and `notes`. Forged review fields are stripped and submission is forced unreviewed. |
| `GET /api/public/reports` | Approved six-column projection only. Optional `limit` (1 to 500) and `offset`. |
| `POST /api/login` | `email` and `password`. No signup. Argon2 verification, identical credential errors, HS256 session cookie. |
| `GET /api/reviewer/queue` | Signed session plus current allowlist membership; up to 500 pending reports. |
| `POST /api/reviews` | Reviewer-only. `report_id`, `state`, `assumptions_acknowledged`, `absence_comparable`. Calls `review_report`. |
| `GET /api/cases/:id/analysis` | Reviewer-only. Recomputes with database network, observations and current decisions through the existing adapter and engine. |
| `POST /api/draft` | `{ "text": "your directly observed water description" }`. Any parsing, configuration, provider or timeout failure returns HTTP 502 with `{ "error": "fallback" }`. |
| `GET /api/cases/:id/export?format=json` | Reviewer-only case, graph, reports, decisions and analysis. |
| `GET /api/cases/:id/export?format=fhir` | Reviewer-only base FHIR R4 collection Bundle with Locations and Observations referencing them through `focus`. No profile conformance claim. |

Analysis and exports require reviewer access because their evidence and derived results contain private reports. CORS allows only the configured origin and cookie-changing requests reject other origins. Session cookies use HttpOnly and SameSite Strict, with Secure enabled in production. This assumes the frontend and API are same-site; cross-site hosts need a different explicitly reviewed cookie/CSRF design. The per-IP login limiter uses the socket peer rather than untrusted forwarding headers. Behind a proxy it may group clients together, and it is per-process rather than shared across replicas.

### Seeds

Supply reviewer emails and passwords as corresponding JSON arrays in `REVIEWER_EMAILS` and `REVIEWER_PASSWORDS`. There are no built-in credentials. Set `DEMO_REVIEWER_EMAIL` to an already allowlisted reviewer before seeding the simulated case. Both scripts refuse to write without `--confirm`; the privileged connection is opened only by the migration module.

```sh
npm run seed:reviewers -- --confirm
npm run seed:demo -- --confirm
```

The demo network, case and notes are explicitly labelled simulated. Its stable UUID case is `10000000-0000-4000-8000-000000000001`. It follows the existing 35 to 24 to 14 candidate demo, with a pending observation; it does not seed real environmental observations. Rerunning it preserves existing review decisions. The main database has not been seeded in this implementation session.

### Separate database tests

Never run SQL or API integration tests against the main database. Set `TEST_DATABASE_URL` to the privileged direct connection of a disposable Neon branch, plus that branch's `APP_LOGIN_PASSWORD`, then run:

```sh
npm run migrate -- --test
npm run test:rls
npm run test:api
```

The harness requires `TEST_DATABASE_URL` and rejects main-database host/database identity even if its URL uses a different role or the direct host instead of the pooler. Tests apply migrations only to the test URL. SQL fixtures roll back; the API integration fixture writes only to the disposable test database. The integration test reports skipped when no test URL exists. Do not reuse the test database for unrelated work.

For optional local PostgreSQL 16, set `TEST_POSTGRES_PASSWORD`, start `docker compose up --build -d test-db`, and set a test URL for `test_owner` at `localhost:55432/streamtrace_test`. The local image enables TLS with a self-signed certificate; certificate verification is relaxed only for explicit loopback test connections. The container's database uses tmpfs and is disposable. Docker is not required for Neon runtime or deployment.

### Deployment

Any Node host can run `npm ci`, `npm run migrate` as a protected release step, and `npm run api`. Node 22.18 or newer is required. Set production environment variables through the host secret store, `NODE_ENV=production`, the desired `PORT`, and the exact frontend origin. Give the API process only its runtime credentials, JWT secret and Groq configuration. Give the release/seed process the owner credential separately. The API never reads `DATABASE_URL_ADMIN`.

A runtime `Dockerfile` is included. For Fly.io, run `fly launch --no-deploy`, choose an application name, configure HTTP internal port 3000 with HTTPS, add the runtime secrets through Fly's secret store, and run `fly deploy`. Run migrations separately from this checkout using the direct owner connection; the runtime image includes only the API and engine. No deployment was performed here.

## Security and verification

RLS restricts client-role access to private reports, decisions, audit history, credentials and reviewer membership. Anonymous clients can submit bounded unreviewed observations and read only approved public fields. Approval requires current database allowlist membership, acknowledged assumptions and comparable absence. The database supplies reviewer identity, revision and timestamp; repeated identical reviews are no-ops, and each actual change appends audit history. All tables have ENABLE and FORCE RLS, including users and migration metadata. Owner policies allow trusted migrations, the filtered public view and explicit-search-path definer helpers to work under FORCE RLS.

RLS trusts this backend to verify the JWT before supplying its subject. It does not protect against compromise of runtime database credentials, arbitrary server-side SQL execution, owner credentials, the JWT signing secret, abuse of anonymous submission, inaccurate observations, reviewer mistakes or hydrology assumptions. There is no per-case tenancy. Do not expose the database connection or login hash helper directly to clients. Allowlist removal stops subsequent requests even while a JWT remains valid. Requests use a consistent database snapshot; concurrent reviews may require a retry if PostgreSQL reports a serialization conflict.

Executed in this session: strict typecheck, engine/adapter/network tests, frontend tests, and backend HTTP tests with a mock database and mocked Groq responses. The mock API tests cover authentication denial, forged approval stripping, identical login errors, rate limiting, approval withdrawal, transaction cleanup, five-second draft fallback and structural FHIR references. Mock tests do not prove database policies. The existing deterministic benchmark was left unchanged.

Live Neon verification: migrations applied using `DATABASE_URL_ADMIN`; runtime-role guard and anonymous public-view read checked using `DATABASE_URL`; anonymous private-table SELECT denied; the owner connection refused by the startup guard. These checks did not insert or delete application data.

Not executed: SQL lifecycle/RLS fixtures or real-database API integration (no separate `TEST_DATABASE_URL` supplied), successful Groq requests (no Groq configuration), reviewer/demo seeding, deployed-host or browser-to-backend integration, runtime image build, physical access, hydrology review and real observations. FHIR output was structurally checked by tests, not validated by an external FHIR validator. No production conformance certification is claimed.

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

The resulting `data/coimbra.network.json` contains **35 reaches, 12 junctions, seven main-stem tributaries, one outlet, and 11 observation sites**. Every junction has two incoming branches, so each contributes one tributary relative to a continuing stem. Per-junction node IDs and counts are printed by the builder and stored in metadata.

There are 25 natural reaches. Ten interior observation nodes split them into 35 without adding, reversing, or removing any cached OSM edge. Seven sites use the nearest existing tributary node just upstream of each main-stem confluence. Three main-stem sites target quarter-sized candidate partitions, and the eleventh site marks the boundary outlet. The larger site set supersedes the earlier 30-reach cap because each extra interior site requires a genuine reach subdivision.

Site codes `001` through `011` follow deterministic topological upstream-to-downstream order, with OSM node IDs breaking ties. The expanded set is renumbered once; stable `osm-site-<node ID>` identifiers preserve physical identity independently of display codes. Every site retains its OSM node, coordinates, placement role, and associated confluence where applicable. Their label is **StreamTrace identifiers, not official OneAquaHealth sites**. Reach geometry uses longitude, latitude order and retains original node IDs, source way IDs, and available names.

Partitions over the full 35-reach candidate set:

| Site | Placement | Present leaves | Absent leaves |
|---|---|---:|---:|
| 001 | Tributary before confluence | 1 | 34 |
| 002 | Tributary before confluence | 1 | 34 |
| 003 | Tributary before confluence | 1 | 34 |
| 004 | Tributary before confluence | 1 | 34 |
| 005 | Tributary before confluence | 1 | 34 |
| 006 | Tributary before confluence | 1 | 34 |
| 007 | Main stem | 4 | 31 |
| 008 | Ribeira de Misarela before confluence | 11 | 24 |
| 009 | Main stem | 18 | 17 |
| 010 | Main stem | 25 | 10 |
| 011 | Boundary outlet | 35 | 0 |

The recommended first check is **009**, with partitions **18 / 17**. Site 008 gives a useful tributary exclusion, **35 to 24**, after a comparable approved absence. Six tributaries have no internal junctions and collapse to one upstream candidate reach at their near-confluence site. Absence at those sites excludes only one reach; presence isolates that reach. The outlet cannot bisect the candidate set. These counts describe the reach-based model and depend on how observation sites subdivide reaches, rather than measuring waterway length or origin probability.

The simulated video seed uses **absence at 008: 35 to 24**, then **presence at 010: 24 to 14**. The pending absence at **009** has no effect until reviewer approval, which narrows **14 to 7**. Withdrawal restores 14. The seed and evidence history record counts for each change; all observations remain simulated and in memory.

`data/direction-review.json` flags three nodes in the largest component:

| OSM node | Issue | Source OSM ways |
|---|---|---|
| 11982083996 | Ten outgoing branches, bifurcation or structure unconfirmed | 23252421 and 1430017552 through 1430017561 |
| 12282800537 | Two outgoing Ceira paths, bifurcation unconfirmed | 23392592, 1133776319 |
| 13144918465 | Two outgoing branches, bifurcation unconfirmed | 23252421, 1430017580 |

The review file enumerates the exact affected collapsed reach IDs. None of these junctions is inside the selected section. Eleven selected Mondego reaches share source way `23252421` with downstream flags; those are listed separately as `selectedSourceWayReachIds`. Unflagged geometry is not validated hydrology. This cache contains way geometry but no node tags, so the builder cannot establish whether the splits are genuine bifurcations. It never reverses a way automatically.

The selected Coimbra network now has `topology_review_state: "prototype_confirmed"`. Its note reads **"flow direction checked visually by developer on 2026-10-04, not verified by hydrology experts"**. `data/coimbra.prototype-review.json` identifies the developer check as Codex visual inspection of plotted cached geometry and direction arrows, records the reviewed scope, and binds it to the exact cache SHA-256. The check covers visual consistency of the stored directions in the selected section. It does not establish measured water flow or hydrological correctness. The three excluded flow-split flags in the larger component remain unreviewed.

Prototype sites are marked `accessible: true` with `access_review_state: "prototype_assumed"` solely to enable the simulated investigation demonstration. Each site explicitly records that physical access has not been verified. Geographic recommendations are permitted for this prototype state. Calling `buildNetwork()` without an explicit matching review defaults to `unreviewed`, inaccessible sites, and disabled recommendations. The demo also suppresses recommendations for any state other than `prototype_confirmed`. A mismatched cache cannot reuse this review record.

Validation passed: `compileGraph()`, exact raw-OSM edge and geometry provenance, complete upstream-branch retention within the unchanged study boundary, a real node just before each of the seven main-stem tributary confluences, independent node-level upstream traversal at every site, stable site ordering, and byte-identical rebuilds. The first approved branch-absence smoke test narrows 35 candidates to 24. The demo tests verify pending approval, withdrawal, conflict pauses, and the unreviewed gate. The existing engine and adapter tests, strict TypeScript check, and production build are also run for this revision. `node scripts/build-network.ts` prints every site's partition sizes and the recommended first site. `npm run geojson` regenerates the debug export for the revised sites.

Hydrology-expert review, physical site access, and real observations remain unverified. The study graph excludes origin regions beyond its upstream boundary. **StreamTrace supports investigation planning; it does not identify chemicals or certify water safety.**
