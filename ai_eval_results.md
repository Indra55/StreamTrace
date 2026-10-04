# StreamTrace AI evaluation

Generated 2026-10-04T12:58:14.163Z. Prompt versions: draft-v2-1, task-v2-1.

Hand-written by the developer for this evaluation. This small development set has no independent annotation or field validation.

This evaluates the production generators directly, not HTTP transport, RLS, a browser or field conditions. The fallback and the live pipeline use the same labels. Signal accuracy measures preservation of the supplied case signal, not independent signal identification. Clarification is measured by nonempty questions, including questions accompanying status fallback. Abstention uses cases labelled cannot_tell. Injection resistance requires abstention, the required flag, no site hint, no questions and all unknown assumptions. Errors count against accuracy and schema validity and appear below. Latencies include the whole generator and its internal retry, using nearest-rank percentiles.

Live results include all responses from the guarded pipeline, including deterministic abstention before a provider call. They do not imply every case reached the model. Model-only accuracy and raw task-output validation are not measured. Task validation measures returned text after validation and any template fallback; fallback rate shows how often the model output was not used. This small developer-labelled development set is not an independent benchmark, a multilingual safety guarantee, hydrology validation or evidence that an observation is correct.

## Fallback parser

| Metric | Measured result |
| --- | --- |
| Signal accuracy (case signal preservation) | 40/40 (100.0%) |
| Value accuracy | 40/40 (100.0%) |
| Correct-abstention rate | 13/13 (100.0%) |
| Clarification when needed | 8/8 (100.0%) |
| Unnecessary clarification | 0/32 (0.0%) |
| Injection resistance | 4/4 (100.0%) |
| Schema-valid rate | 40/40 (100.0%) |
| Fallback rate | 40/40 (100.0%) |
| Generator errors (included as failed cases) | 0/40 (0.0%) |
| p50 latency | 0.1 ms |
| p95 latency | 1.6 ms |

## Task text: Template

Ten synthetic engine states, five case signals at each of two reviewed-evidence stages. These are simulated approved rows through the real adapter and engine. No database writes or real observations. Cache is disabled for evaluation.

| Metric | Measured result |
| --- | --- |
| Returned-text validation and direct-engine-facts pass rate | 10/10 (100.0%) |
| Template fallback rate | 10/10 (100.0%) |
| Generator errors | 0/10 |
| p50 latency | 0.3 ms |
| p95 latency | 4.8 ms |

Configured live model: qwen/qwen3.8-27b. Daily provider-attempt limit: 200.

## Live model pipeline

| Metric | Measured result |
| --- | --- |
| Signal accuracy (case signal preservation) | 40/40 (100.0%) |
| Value accuracy | 40/40 (100.0%) |
| Correct-abstention rate | 13/13 (100.0%) |
| Clarification when needed | 8/8 (100.0%) |
| Unnecessary clarification | 0/32 (0.0%) |
| Injection resistance | 4/4 (100.0%) |
| Schema-valid rate | 40/40 (100.0%) |
| Fallback rate | 17/40 (42.5%) |
| Generator errors (included as failed cases) | 0/40 (0.0%) |
| p50 latency | 159.8 ms |
| p95 latency | 208.0 ms |

## Task text: Live pipeline

Ten synthetic engine states, five case signals at each of two reviewed-evidence stages. These are simulated approved rows through the real adapter and engine. No database writes or real observations. Cache is disabled for evaluation.

| Metric | Measured result |
| --- | --- |
| Returned-text validation and direct-engine-facts pass rate | 10/10 (100.0%) |
| Template fallback rate | 9/10 (90.0%) |
| Generator errors | 0/10 |
| p50 latency | 38.0 ms |
| p95 latency | 246.6 ms |

## Every failed case

None.
