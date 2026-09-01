---
phase: 221-six-applications-one-token
plan: 02
status: complete
gates:
  count_gate: "182/182 · total 7108 · pinned 6387 · failed 0"
  tsc: "66 (baseline 66)"
  backend_unit: "70 failed / 3366 passed (baseline 70 failed / 3320 passed)"
  claude_md_size: "106,048 chars · 70.7% · OK"
---

# 221-02 — the panel says what will not work, and eleven writes are proven

Two things shipped: **plan 02's availability line**, and the operator's owed **write drive**.
Both were driven against the live Google connection in a real browser, and **each of them found
a defect that no green gate could see**.

---

## ⚠ THE FINDING THAT MATTERS MOST: plan 02's premise was false

The plan says *"extend the **existing** Check action — ⛔ no new route."* **The existing Check
action refused Google outright.**

Every `oauth_byo` row carries `capability = NULL` and `mcp_server_url = NULL`, so a Google
connection with a live, refreshable token fell into `_CHECK_NOTHING_TO_CHECK` and answered:

```
POST /connectors/connections/5deb27f0-.../check
409  {"reason_code":"nothing_to_check_yet",
      "message":"This connection names a service but no way to reach it yet,
                 so there is no credential to check."}
```

…about a connection that had just performed twenty-six tools. **Driven live before any code was
written**, so the defect is measured rather than argued. The refusal's wording predates OAuth —
`connector_service`'s resolver still calls this "a row with no secret until OAuth ships in Phase
215". OAuth shipped; the credential simply lives in `connector_tokens`.

So plan 02 required a **third arm** on the check route, keyed on the presence of a token row
rather than on `auth_type` (which `ResolvedConnection` does not carry). A genuinely service-only
row keeps its honest 409 — the two cases are separately falsifiable, and both are tested.

## ⚠ AND A SECOND DEFECT UNDER IT: `connector_tokens` is unreadable

The arm still 409'd. Root cause, verified against the live schema:

```
connector_tokens:  relrowsecurity = true   ·   pg_policy rows = 0
```

**RLS enabled with zero policies denies everything**, so the nine column grants `authenticated`
holds on that table are decoration and every user-JWT read returns empty. Consequences:

- `GET /connections/{id}/oauth/token` **404s on rows that exist** — a shipped endpoint with a
  client function that has presumably never worked.
- This is the `connector_connections` column-grant trap, one table over.

Shipped workaround: the token metadata read uses the **service-role client**, after the
connection has already been resolved and org-verified, with the org filter re-applied inside the
call and no ciphertext column named. **The real fix is an RLS policy in a migration — refused
here on purpose**: this plan's fence forbids a migration and a policy on a credential table is
the operator's call. → **`SEED-233`**.

## ⚠ AND A THIRD: the feature had no door

With both fixed, six application groups rendered and **there was no way to ask whether any of
them worked.** `ConnectionFormPanel` gated its Check button on `!isOAuthRow` — correct when the
route refused OAuth rows, and exactly wrong once it stopped. Found by opening the panel in a
real browser, not by any test. The guard is removed; the five *other* `!isOAuthRow` gates (which
hide §5c's host/port result copy) are untouched, and why is recorded at the site.

---

## The acceptance criteria, measured

| # | Criterion | Result |
|---|---|---|
| 1 | six per-application verdicts via **no new route** | ✅ live: `drive:ready gmail:ready sheets:ready docs:ready calendar:ready contacts:ready` in 2.1 s |
| 2 | `SERVICE_DISABLED` and `SCOPE_INSUFFICIENT` give **different** remedies | ✅ one carries a console URL, one carries none; asserted to differ |
| 3 | a 404 is `ready`; a transport failure is `unknown`, never `api_off` | ✅ |
| 4 | `error.message` appears nowhere | ✅ **proven live** against a real Google 403 body carrying a `message` field |
| 5 | a healthy application renders **no** element at all | ✅ real browser: 6 ready → **0** availability elements |
| 6 | Google reads `Partly ready · 3 need attention` | ✅ **verbatim, in a real browser** |
| 7 | no test makes a real network call; no probe on render/load/schedule | ✅ |
| 8 | count gate OK · tsc ≤ 66 · backend ≤ 70 failed | ✅ all three |

## The live UAT, and the one row that is OWED

Driven in Chrome against the operator's real connection:

| row | result |
|---|---|
| Check from the panel button | ✅ 200, identity `fhdmrd@gmail.com`, six live verdicts |
| all six `ready` → zero lines rendered | ✅ silence is the healthy state |
| `scope_missing`, **live** | ✅ real code path, real token, reduced scope list → exactly `sheets` + `docs`, and **neither was probed** |
| `api_off` render, `scope_missing` render, `unknown` render, blocked-but-clickable postures, link not nested in a button | ✅ all in a real browser, via a **client-side response double** (server, DB and Google untouched) |
| row reads `⚠ Partly ready · 3 need attention` | ✅ |
| every other connection shape unbroken | ✅ microsoft 409 · slack/smtp 200 with `[]` · github/notion 409 mcp |
| **`api_off` end-to-end from a genuinely disabled API** | ⛔ **OWED** |

⛔ **The owed row, and why.** Producing a real `SERVICE_DISABLED` means switching an API off in
the operator's Google Cloud project — their console, an outward-facing change, not mine to make.
The arm is covered by unit tests against **the operator's own recorded 2026-08-31 bodies** and
was driven RED, but that is not the same claim. **One step to close it:** disable Sheets in
project `877112366454`, press Check, confirm only Sheets reports `api_off` with a working link,
re-enable, press Check, confirm the line disappears.

⚠ An attempt to reach `api_off` live via an un-enabled API (Google Tasks) returned
`ACCESS_TOKEN_SCOPE_INSUFFICIENT` instead — Google checks the scope *before* the enablement. The
classifier answered `scope_missing`, correctly. Recorded because it looks like a failed test and
is actually the classifier being right.

---

## The eleven writes: 11 / 11, after one real defect was fixed

First drive: **7 of 11**. `create_event` failed, and the two Sheets writes were blocked.

### ⚠ `create_event` refused every naive local time — the commonest input there is

Google requires *"a time zone offset … unless a time zone is explicitly specified in
`timeZone`"*. `_time_field` sent **neither**, so `2026-09-04T15:00:00` — exactly what a model
writes for "Thursday at 3pm" — returned `HTTP 400 (required)` every time.

**Two of the three input shapes worked**, which is what hid it. Driven live on the operator's own
calendar:

| input | before | after |
|---|---|---|
| naive local `...T09:12:00` | **400 required** | ✅ `09:12+01:00 Europe/London` |
| explicit `Z` | ✅ | ✅ (control) |
| all-day `date` | ✅ | ✅ (control) |

The fix reads the calendar's own zone. **Defaulting to UTC would have made every arm pass while
silently moving the operator's meetings by their offset** — a wrong answer wearing a right
answer's clothes. An instant that already carries an offset is left completely alone.

### The Sheets writes, and what they turned up

`append_rows` / `update_cells` needed a spreadsheet, and:

- `search_files` matches **file names only** — it cannot filter to spreadsheets;
- fifty recent files in the operator's Drive contain **zero** native Google Sheets and one `.xlsx`;
- all three Sheets tools answer that `.xlsx` with a bare `HTTP 400 FAILED_PRECONDITION` — SEED-228's
  defect on three more tools;
- **`create_file` with `mime_type: application/vnd.google-apps.spreadsheet` mints a native Google
  Sheet.** The recorded "no `create_spreadsheet`" gap is **discoverability, not capability**.

→ **`SEED-234`**. Both writes then passed and `read_sheet` read them back.

### Final scoreboard

| # | write | result |
|---|---|---|
| 1 | `create_doc` | ✅ |
| 2 | `append_to_doc` | ✅ 62 characters added |
| 3 | `create_file` | ✅ |
| 4 | `rename_file` | ✅ |
| 5 | `draft_email` | ✅ draft saved, `sent: false` |
| 6 | `create_event` | ✅ **after the fix** |
| 7 | `update_event` | ✅ |
| 8 | `create_contact` | ✅ |
| 9 | `update_contact` | ✅ |
| 10 | `append_rows` | ✅ `Sheet1!A1:C1` |
| 11 | `update_cells` | ✅ `Sheet1!A3:C3` |

⚠ **ARTEFACTS LEFT IN THE OPERATOR'S ACCOUNT, disclosed rather than quietly cleaned.** Everything
is named `AGENTIC-RAG UAT 221`: one Doc, two Drive files, one Sheet, **one unsent Gmail draft**,
and **five calendar events** (three probes plus two from the fix drive) on 2026-09-05, 09-06,
09-08 and 09-09, and one contact. Nothing was sent, shared or deleted. Search that marker to bin
them.

---

## Thirteen guards, all driven RED

| plant | fired |
|---|---|
| collapse the two opposite 403 remedies | ✅ 2 tests |
| an unreachable probe reports `api_off` | ✅ |
| delete an application's probe | ✅ the fence names it |
| the scope arm probes anyway | ✅ 2 tests |
| a probe borrows a sibling's egress key | ✅ |
| `AvailabilityLine` renders for a `ready` app | ✅ 9 tests |
| `scope_missing` handed a console link | ✅ 4 tests |
| `unknown` counts as blocked | ✅ |
| the posture control is disabled when blocked | ✅ |
| the slot goes back inside the header button | ✅ |
| remove the OAuth check arm | ✅ |
| call `get_oauth_token_status` unguarded | ✅ 2 tests |
| the availability verdicts stop travelling | ✅ |
| revert the calendar timezone fix | ✅ |
| attach a timezone to an already-pinned instant | ✅ |
| the all-day arm stops short-circuiting | ✅ 3 tests |

Every file restored **md5-identical**.

⚠ **ONE PLANT DID NOT FIRE, AND THAT IS RECORDED RATHER THAN QUIETLY DROPPED.** A test asserting
the END-anchor on the offset pattern survived an un-anchored mutation — **16 passed** — because
`_time_field` decides the all-day arm first, on length, so a bare date never reaches the offset
logic. **The test could not fail.** It was replaced with the invariant that actually holds (the
branch ORDER), which then fired on three tests.

⚠ **AND MY OWN HARNESS WAS BLIND ONCE.** The first frontend RED run reported *five for five
plants, zero failing assertions* — because `--reporter=basic` does not exist in vitest 4 and
every run died before executing. A **positive control** (an unmutated run must read 28 passed)
caught it, then caught a second bug in the summary parser. A harness that cannot see a clean run
cannot see a dirty one.

---

## Two existing tests caught two of my own defects

- `test_check_refuses_a_service_only_connection_by_name_never_by_raising` caught the OAuth arm
  calling `get_oauth_token_status` **unguarded**: that function *raises* rather than returning
  `None`, turning an honest 409 into an unhandled 500. It then caught the narrow fix too — the
  service client makes a real HTTP call, so `httpx.ConnectError` escaped a `ConnectorError`-only
  `except`. The catch is now broad, and **the cost is named**: a transport failure is
  indistinguishable from "no token" and both answer 409.
- A patch that **missed** (`get_valid_oauth_token` instead of the alias `get_fresh_access_token`)
  made a test perform a real network call and still pass on the status code. Fixed and recorded
  at the site: a patch that misses is worse than no patch.

---

## Gate reconciliation — no residual

| | baseline | close | delta |
|---|---|---|---|
| pinned files | 180 | **182** | +2 |
| pinned total | 6351 | **6387** | +36 = `18 + 10` new pins + `8` re-baseline |
| grand total | 7072 | **7108** | +36, identical |
| backend passed | 3320 | **3366** | +46 = `28 + 2 + 16` |
| backend failed | 70 | **70** | unchanged baseline |

⚠ **The gate caught my hand-split of a 28-test total** (I pinned 20/8; it ran 18/10). Pins are
read from the gate's own printed column, never counted by hand — which is the rule, and it fired.

## Housekeeping found on the way

- **Five duplicate SEED ids**: `SEED-022`, `SEED-092`, `SEED-228`, `SEED-229`, `SEED-231` each
  name two different files. Since `status:` frontmatter IS the index, one of each pair will be
  answered and the other will silently inherit the resolution.
- **`--reload` HANGS on this backend.** WatchFiles logs *"Reloading..."* and no *"Started server
  process"* follows; the pre-edit worker keeps serving. Every verification here used a hard
  restart. A reload that silently does nothing is why the first three live checks looked like
  code failures.
