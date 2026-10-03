# StreamTrace synthetic benchmark

Seed: 20261003. Every origin tested; 50 trials per origin for random.

One persistent origin; normal downstream propagation; observations at downstream reach ends; all sites initially accessible. Missing: every third attempted check unavailable. Erroneous: first answer flipped. Stop at singleton/conflict/exhaustion; a wrong singleton can occur without conflict. Checks include missing attempts. Random and ascending choose among all unattempted sites; bisection requires a useful partition.

| Network | Scenario | Strategy | Runs | Mean checks | Max | Unresolved | Conflicts | Wrong singleton |
|---|---|---|---:|---:|---:|---:|---:|---:|
| chain | clean | bisection | 24 | 4.67 | 5 | 0 | 0 | 0 |
| chain | clean | random | 1200 | 16.48 | 24 | 0 | 0 | 0 |
| chain | clean | ascending | 24 | 12.46 | 23 | 0 | 0 | 0 |
| chain | missing | bisection | 24 | 5.33 | 6 | 16 | 0 | 0 |
| chain | missing | random | 1200 | 20.37 | 24 | 670 | 0 | 0 |
| chain | missing | ascending | 24 | 19.17 | 24 | 14 | 0 | 0 |
| chain | erroneous | bisection | 24 | 4.50 | 5 | 0 | 0 | 24 |
| chain | erroneous | random | 1200 | 4.58 | 24 | 0 | 834 | 366 |
| chain | erroneous | ascending | 24 | 1.04 | 2 | 0 | 0 | 24 |
| balanced | clean | bisection | 30 | 5.07 | 6 | 0 | 0 | 0 |
| balanced | clean | random | 1500 | 19.10 | 30 | 0 | 0 | 0 |
| balanced | clean | ascending | 30 | 19.97 | 30 | 0 | 0 | 0 |
| balanced | missing | bisection | 30 | 6.00 | 7 | 20 | 0 | 0 |
| balanced | missing | random | 1500 | 23.89 | 30 | 801 | 0 | 0 |
| balanced | missing | ascending | 30 | 25.33 | 30 | 15 | 0 | 0 |
| balanced | erroneous | bisection | 30 | 5.00 | 5 | 0 | 0 | 30 |
| balanced | erroneous | random | 1500 | 4.98 | 30 | 0 | 623 | 877 |
| balanced | erroneous | ascending | 30 | 1.00 | 1 | 0 | 30 | 0 |
| uneven | clean | bisection | 24 | 4.71 | 6 | 0 | 0 | 0 |
| uneven | clean | random | 1200 | 16.02 | 24 | 0 | 0 | 0 |
| uneven | clean | ascending | 24 | 14.46 | 24 | 0 | 0 | 0 |
| uneven | missing | bisection | 24 | 5.46 | 7 | 16 | 0 | 0 |
| uneven | missing | random | 1200 | 20.13 | 24 | 670 | 0 | 0 |
| uneven | missing | ascending | 24 | 20.79 | 24 | 16 | 0 | 0 |
| uneven | erroneous | bisection | 24 | 4.58 | 5 | 0 | 0 | 24 |
| uneven | erroneous | random | 1200 | 4.78 | 24 | 0 | 694 | 506 |
| uneven | erroneous | ascending | 24 | 1.00 | 1 | 0 | 24 | 0 |

These are simulation results, not a real-world efficiency or safety claim. Counts have different denominators; compare rates across strategies.
