
## From 204-03 (scheduler) — out of scope, NOT fixed here

- **`scripts/check-deploy-drift.sh` check 2 emits a PRE-EXISTING soft WARN listing 12
  migrations** above the highest listed seed (#089) that carry seed-like INSERT/UPDATE:
  093, 094, 098, 104, 105, 106, 107, 111, 113, 118, 122, 123. Measured at base SHA
  `9af9706e` (`git show 9af9706e:docs/OPERATOR.md | grep -oE '[0-9]{3}_[a-z0-9_]+\.sql'`
  returns exactly the same 9 filenames), so 204-03 neither caused it nor widened it. Someone
  owes a pass over whether any of those twelve genuinely needs a Step-3 runbook row.
- **`docs/OPERATOR.md`'s "Migrations currently run to N" line was stale by 22 migrations**
  (read `102`). Corrected in 204-03 as a one-line fix; the underlying problem — nothing
  re-derives it — is unfixed.
