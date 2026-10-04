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

The API lives in `api/` and uses Hono, node-postgres, Zod, jose and Argon2. The engine and adapter keep their existing semantics. The default frontend uses these APIs with a signed reviewer session. The explicit demo component remains only for isolated prototype tests. Live failures do not fall back to simulated evidence.

Copy `.env.example` to the ignored `.env` and replace every placeholder. `DATABASE_URL_ADMIN` uses the owner role on a direct host. `DATABASE_URL` uses the restricted `app_login` role on a pooler host. Both use TLS. Connection strings, passwords and tokens must stay out of logs and version control. URL channel-binding options are removed before driver configuration. The provided `DB_KEY` owner connection was used for initial local configuration; it is not an API authentication key.

```sh
npm install
npm run migrate
npm run check:runtime
npm run api
# In another terminal, start the frontend with its /api proxy.
npm run dev
```

The migration runner applies ordered, checksummed migrations and then the idempotent role bootstrap in one transaction. It reads `APP_LOGIN_PASSWORD` rather than embedding a password in SQL files. SQL-created roles avoid privileged dashboard role defaults. Startup refuses a superuser, BYPASSRLS, owner membership, extra role membership, creation privileges or tables without FORCE RLS. Each request switches roles and sets JWT claims locally inside a transaction, with rollback and connection cleanup.

`GROQ_API_KEY` and `GROQ_MODEL` are optional at startup. Without them, drafts and task text use deterministic fallbacks. See the AI section for the v2 contracts and limits.

### Routes

| Route | Access and behavior |
| --- | --- |
| `POST /api/reports` | Anonymous JSON submission. Fields: `id`, `case_id`, `signal`, `site_code`, `value`, `confirmed: true`, `observed_at`, optional `origin` and `notes`. Forged review fields are stripped and submission is forced unreviewed. |
| `GET /api/public/reports` | Approved six-column projection only. Optional `limit` (1 to 500) and `offset`. |
| `POST /api/login` | `email` and `password`. No signup. Argon2 verification, identical credential errors, HS256 session cookie. |
| `GET /api/reviewer/cases` | Signed reviewer session; discover available cases. |
| `POST /api/logout` | Clear the HttpOnly session cookie. |
| `GET /api/reviewer/queue` | Signed session plus current allowlist membership; up to 500 pending reports. |
| `POST /api/reviews` | Reviewer-only. `report_id`, `state`, `assumptions_acknowledged`, `absence_comparable`. Calls `review_report`. |
| `GET /api/cases/:id/analysis` | Reviewer-only. Recomputes with database network, observations and current decisions through the existing adapter and engine. |
| `POST /api/draft` | Anonymous v2 field-guide draft: `{text, signal, siteHint?, answers?, round?}`. Returns a strict draft or deterministic fallback; never stores evidence. |
| `POST /api/task` | Anonymous read of trusted, approved evidence for `{case_id}`. Engine-selected site and partitions, or 409 with a reason. |
| `POST /api/demo/task` | Anonymous `{site, signal, facts:{total, seen_leaves, not_seen_leaves}}` against the public network. No database access. |
| `GET /api/cases/:id/export?format=json` | Reviewer-only case, graph, reports, decisions and analysis. |
| `GET /api/cases/:id/export?format=fhir` | Reviewer-only base FHIR R4 collection Bundle with Locations and Observations referencing them through `focus`. No profile conformance claim. |

Analysis and exports require reviewer access because their evidence and derived results contain private reports. CORS allows only the configured origin and cookie-changing requests reject other origins. Session cookies use HttpOnly and SameSite Strict, with Secure enabled in production. This assumes the frontend and API are same-site; cross-site hosts need a different explicitly reviewed cookie/CSRF design. The per-IP login limiter uses the socket peer rather than untrusted forwarding headers. Behind a proxy it may group clients together, and it is per-process rather than shared across replicas.

### Seeds

Real citizen reports require investigations and a site network. Run `npm run setup:citizen -- --confirm` after migrations to configure the cached Coimbra sites and five signal cases. This creates no observations or approvals. The network keeps its prototype topology and access qualifications. `/report` submits to the API by default; unavailable services offer retry or an explicit simulation. Demo reports stay in the browser tab and do not enter the signed-in reviewer queue.

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

Any Node host can run `npm ci`, `npm run migrate` as a protected release step, and `npm run api`. Node 22.18 or newer is required. Set production environment variables through the host secret store, `NODE_ENV=production`, the desired `PORT`, and the exact frontend origin. For a separately hosted frontend, set `VITE_API_URL` to the same-site API origin before `npm run build`, or proxy `/api` through its host. Local Vite automatically proxies `/api` to port 3000. Give the API process only its runtime credentials, JWT secret and Groq configuration. Give the release/seed process the owner credential separately. The API never reads `DATABASE_URL_ADMIN`.

A runtime `Dockerfile` is included. For Fly.io, run `fly launch --no-deploy`, choose an application name, configure HTTP internal port 3000 with HTTPS, add the runtime secrets through Fly's secret store, and run `fly deploy`. Run migrations separately from this checkout using the direct owner connection; the runtime image includes the API, engine and shared observation schemas. No deployment was performed here.

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

## Citizen flow and review context

`/report` opens with the current investigation title and asks only about that case signal. Something else goes to the general inbox with no case link. It is visible to researchers but cannot be approved as case evidence or published in the approved-report view. Odour is not a signal choice.

Draft help and observation context share one step. Seen reports skip context questions. Not seen reports ask only unknown persistence, detectability, flow and recent rain, up to two questions per round for two rounds. Unknown answers remain unknown. Researchers must save a reason of at least 10 characters when approving a not-seen report with any unknown answer. The API and database both enforce this, and review events store the reason.

New report references use 16 random characters from an unambiguous alphabet. Status lookup returns only state and permits 30 requests per minute per peer IP. The flow migration assigns new references to existing reports, so older internal UUID status links no longer resolve. `/task` shows the case title and engine counts only when approved evidence exists and geographic recommendations are enabled. Pending evidence never creates a field task.

The demo background is a bundled SVG of study-area roads, waterways, land cover and place names. It uses the attributed OpenStreetMap context extract in `data/coimbra.map-context.json`, fetched from the four bounding-box requests in `data/coimbra.map-context.query`. Run `node --experimental-strip-types scripts/render-basemap.ts` to rebuild it. The SVG uses Web Mercator projection to align with Leaflet. It is inlined into the frontend, so `/demo` makes no background-tile requests. Live maps also show it underneath online tiles as a fallback. Context data is under ODbL-1.0; attribution remains visible in the map. The reviewer toolbar links to the selected case's field task.


## AI

Citizen voice input is optional on the description step of `/report?mode=live`. Tap the mic to record for up to 25 seconds, then stop or let the countdown finish. The editable transcript is labelled "AI transcription, please check"; use "Check my report" to continue the existing draft and human-confirmation flow. Microphone access needs HTTPS or localhost. Permission denial, unsupported browsers and transcription failures leave typing available. `/report?mode=demo` and `/play` insert a labelled canned transcript without recording or network requests.

Set the server-only `SARVAM_API_KEY` in the ignored `.env` and restart the API. Anonymous `POST /api/transcribe` accepts one multipart `file` of at most 1,500,000 bytes, with an additional 16 KiB limit for the multipart envelope. It forwards in memory to Sarvam using `model=saaras:v3` and a ten-second provider timeout. No audio is saved or logged; the key, filenames and provider errors are not logged. The browser selects WebM, MP4 or Ogg, all accepted by [Sarvam REST](https://docs.sarvam.ai/api-reference/speech-to-text/transcribe), so conversion and ffmpeg are unnecessary. Other upload formats are rejected. Sarvam v3 lists English and Indian languages; Portuguese speech support is not established. Returned transcripts are limited to the form's 500 characters. Transcript text uses the existing unfinished-draft storage, just like typed text, and never supplies evidence without human confirmation and researcher review.

Voice has a separate per-peer, per-process counter using `AI_RATE_LIMIT` requests per minute, and the same `CORS_ORIGIN` restriction. All voice failures, including missing key, oversized audio, rate exhaustion, timeout and provider 403, return HTTP 502 `{error:"fallback"}`; rate exhaustion includes `Retry-After`. The Groq daily budget does not count Sarvam calls. Automated voice tests use fake audio and provider responses; they do not verify recognition accuracy, real browser recording or provider retention policies.

AI helps phrase a draft observation and an engine-selected citizen task. It never sets `review_state`, stores reports or cases, infers chemicals or causes, diagnoses health effects, certifies safety or supplies evidence to the engine. Only a human review decision can make a separately submitted observation eligible for the engine. These endpoints write nothing. Free text is supplied only as JSON data in the user message; system instructions are constant. Request text, provider exceptions, keys and connection strings are never logged by these generators.

`POST /api/draft` v2 requires the case's `signal`, one of `colour`, `foam`, `discharge`, `litter` or `dead_fish`. It accepts English and Portuguese, optional `siteHint`, optional quick replies `answers: {persistence, detectability, flow, recent_rain}` using `yes`, `no` or `unknown`, and `round` 0, 1 or 2. Each strict response includes `status`, the case signal, `value`, clamped confidence, `site_hint`, assumptions, up to two quick-reply questions, flags, English rationale, detected language, source, model, prompt version and latency. Output assumptions use `flow_conditions`, while the corresponding input answer and question ID use `flow`. Site hints retain only a three-digit site code, otherwise null. They are suggestions, not resolved locations or evidence.

Seen drafts never ask context questions. Not-seen drafts ask only unresolved context: persistence after 10 minutes, distinguishability near a weir or waterfall, normal flow and rain in the last 24 hours. `detectability: yes` means the signal is distinguishable. An explicit unknown reply is preserved and is not asked again in a later round. Round 2 stops all questions. The model cannot choose questions or invent context; context must match explicit parser evidence or quick replies. Text containing instructions, a chemical or cause assertion, another signal, or no case observation is flagged and ignored in its entirety. This conservative rule can abstain even when part of a mixed sentence contains a useful sighting.

No key, unsupported model output, schema violations, wrong signal, inferred context, malformed JSON, timeout and provider errors all return HTTP 200 with a deterministic draft, `status: "fallback"`, `source: "fallback"` and `model: null`. A fallback can still carry useful questions. On successful AI responses, status is `needs_clarification` when questions remain and `complete` otherwise. The same parser is evaluated offline. It uses a limited vocabulary and is deliberately conservative; it is not a general language understanding guarantee.

`POST /api/task` reads the RLS-filtered public approved projection, adapts trusted rows and runs the existing engine. It returns 409 with an explicit reason for unreviewed or disabled topology, conflicting evidence, a single remaining candidate, no usable approved observation, or no useful accessible recommendation. Pending evidence cannot create a task. `POST /api/demo/task` validates the site against `data/coimbra.network.json` and integers from zero to the reach count, with `seen_leaves + not_seen_leaves === total`. Demo partitions are client-supplied simulation facts, not verified live-engine results. It never opens a database connection.

Both task routes return exactly `{site, text_en, source, facts, model, prompt_version, latency_ms}`. The model only chooses from server-supplied English sentences and their order. Validation requires the exact site code and signal, the exact partition numbers, the neutral sentence "Report seen, not seen or cannot tell", the safety line "Stay on safe public paths. Do not enter the water. Skip the observation if it is unsafe.", and a landmark sentence only when safe site metadata supplies one. A closed sentence grammar rejects added signals, numbers, cause or chemical claims, health claims and expected-answer hints. Invalid output or provider failure uses the deterministic template with `source: "template"`. This intentionally limits stylistic freedom. The site code is an identifier, not a partition number. Task responses are cached in memory for one hour using a SHA-256 of site, signal, canonical partition facts and prompt version. Changed landmark metadata is revalidated before a cache hit can be used; expired entries are removed and the cache holds at most 1,000 entries.

Groq uses `GROQ_API_KEY` and `GROQ_MODEL`, temperature zero and JSON object mode. One five-second deadline covers the entire operation, including response parsing and at most one retry for provider or network errors. Schema failures and timeouts are not retried. `AI_DAILY_BUDGET` defaults to 200 outbound attempts per UTC day, including retries, shared across both features in the API process. Once exhausted, all three AI routes return HTTP 429 `{error:"budget"}`, including when a retry would exceed the limit. Setting it to zero disables these routes. No-key fallbacks, cached responses and pre-provider abstentions consume no attempts, but routes still enforce an already exhausted budget.

`AI_RATE_LIMIT` defaults to 20 requests per minute per socket peer IP, shared across the three routes. Forwarding headers are not trusted. Behind a proxy, peers may be grouped together. Limits, budget and cache are per process; multiple replicas need a shared store to enforce a deployment-wide budget. Input strings are capped at 500 decoded characters, request bodies at 16 KiB, and non-JSON requests are rejected. Strict schemas reject unknown input keys. CORS and POST origin checks allow only `CORS_ORIGIN`. Invalid input returns 400, unsupported media returns 415, and oversized bodies return 413. Rate-limit exhaustion returns 429 `{error:"rate_limit"}` with `Retry-After`.

Run `npm run eval:ai -- --offline` for the fallback-only evaluation, or `npm run eval:ai` to also call the configured live model. Each run overwrites `ai_eval_results.md`. `data/ai_eval.json` contains 40 developer-written labels: 20 clear English, six Portuguese, six ambiguous, four instruction or false-cause attempts and four off-topic or other-signal cases. The report records signal preservation, value accuracy, abstention, needed and unnecessary clarification, injection resistance, schema validity, fallback rate and p50/p95 generator latency, with every failed case. It also generates text for ten synthetic approved-evidence engine states and compares returned sites and partitions to a direct engine run, reporting validation and template-fallback rates. The live pipeline includes guarded abstentions and fallbacks, so its accuracy is not model-only accuracy. Task validation measures the returned text after fallback, not raw model output; the template-fallback rate makes that distinction visible.

This is a small development set hand-labelled by the developer, with no independent annotation, field observations or broad adversarial coverage. It does not establish real observation correctness, hydrology validity, multilingual robustness, general prompt-injection resistance, database/RLS correctness or browser behavior. The evaluator calls production generators and the real provider when configured; it does not exercise HTTP transport or a database. Network restrictions or provider failure can produce all-fallback live results, which must not be described as successful model evaluation.

The citizen report and reviewer draft flows use the v2 contract. Citizen context replies are sent back using the answer enums and round number, with a hard stop after two rounds. Server fallbacks remain usable drafts. The live task page uses `/api/task`; the simulated task page sends only the local engine's site, signal and partitions to `/api/demo/task`, with a labelled local template if the wording endpoint is unavailable. Live task failures never silently substitute simulated evidence. Every report still requires citizen confirmation and a separate human researcher review.
