# Adversarial engine review

Reviewed failure classes and executable evidence in `tests/engine.test.ts`:

1. **Withdrawal:** on the 24-reach chain, present at 011 leaves 12 candidates. Revision 2 rejects it: full recompute returns 24. A filter-only cache stays at 12. Fixed by recomputing from original candidates.
2. **Replacement:** changing that report from present to absent should leave the other 12 reaches. Intersecting old candidates with the new condition incorrectly gives zero. Regression covers the replacement.
3. **Conflict recovery:** present and absent at the same site give zero candidates. Withdrawing the absent assertion restores 12; an empty incremental cache cannot recover.
4. **Duplicate support:** two reports agree; withdrawing one must retain the other's constraint. Deduplication happens after selecting each report's latest revision.
5. **Out-of-order delivery:** revision 2 followed by revision 1 cannot roll review state back. Same revision with different content is rejected. Duplicate replay is inert.
6. **Draft laundering:** even `approved` on an AI/parser draft does not make it an observation. Unconfirmed or unacknowledged data never constrains candidates.
7. **Caller mutation:** streaming state snapshots graph/case/report inputs. Mutating an object after update cannot rewrite accepted history. Invalid updates leave prior state intact.
8. **Graph pitfalls:** cycles, duplicate IDs/edges, and dangling references fail closed. Sites partition by directed reachability, not geometry.
9. **Recommendation correctness:** generated tests independently enumerate accessible, unchecked, nontrivial partitions and compare the minimax choice and tie-break.

500 seeded random DAGs, 30 review changes each, compare streaming results with full recomputation and an independent forward-path oracle. Zero disagreements were observed for the safe adapter. The append-only intersection/subtraction reference also agrees at every tested prefix. This is finite generated testing, not a mathematical proof.

A reviewed wrong observation is an unavoidable model limitation: the engine can return a wrong singleton without any logical contradiction. The benchmark reports this explicitly. Conflict detection does not certify evidence quality.

Database trust is separate: consumers must read decisions from the protected database, not accept a client-provided `review: approved`. SQL role tests are prepared but database execution was unavailable in this environment.
