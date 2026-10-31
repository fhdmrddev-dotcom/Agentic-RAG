---
phase: 305-connect-claude-code-and-cursor
scope: "305-04"
diff_range: "e456f4af3..44fb3f9ff"
reviewed: 2026-10-31T00:00:00Z
depth: deep (pii_redactor, outbound_guard, outbound_policy, dispatch/results/read_tools 04 hunks, the PUT/GET route) · standard (frontend, scripts, docs)
files_reviewed: 17
files_reviewed_list:
  - backend/app/services/pii_redactor.py
  - backend/app/services/outbound_guard.py
  - backend/app/db/outbound_policy.py
  - backend/app/mcp/dispatch.py
  - backend/app/mcp/read_tools.py
  - backend/app/mcp/results.py
  - backend/app/api/api_keys.py
  - backend/app/models/api_key.py
  - frontend/src/components/org/OrgPiiRedactionCard.tsx
  - frontend/src/components/org/OrgSettingsTab.tsx
  - frontend/src/components/org/OrgAuditTab.tsx
  - frontend/src/components/settings/apiKeys/mcpKeyCopy.ts
  - frontend/src/lib/api/apiKeys.ts
  - scripts/measure-redaction.py
  - scripts/mcp-timeout-probe.py
  - docs/OPERATOR.md
  - .planning/phases/305-connect-claude-code-and-cursor/evidence/redaction-measurement.txt
findings:
  critical: 1
  warning: 3
  info: 6
  total: 10
status: partially_fixed
fix_status: "BL-04-01, WR-04-01, WR-04-03, IN-04-03 fixed (see ## Fix log); WR-04-02 routed separately (dispatch.py); IN-04-01, IN-04-02, IN-04-04, IN-04-05, IN-04-06 open"
---

# Phase 305: Code Review Report, plan 305-04 (second pass)

**Reviewed:** 2026-10-31
**Depth:** deep for the redactor, guard, policy read and switch route; standard for the rest
**Files Reviewed:** 17
**Status:** issues_found

## Summary

This pass covers only what 305-04 changed (`git diff e456f4af3 44fb3f9ff`). Findings already in
`305-REVIEW.md` (WR-01..06, IN-01..07) are not repeated here.

**What holds up (traced, not assumed):**
- **Choke point.** `dispatch` sends every `BaseModel` outcome through `outbound_guard.guard`
  before `_finish`. `_finish` builds `structuredContent` (`model_dump`) and the text block
  (`render`) from the same guarded model, so the two cannot disagree. The titles, passage text,
  read text, folder names and document titles are all `RedactableText`. Ids, links, cursors,
  citations, origin and version are plain fields and pass through unchanged. The window is a
  `PrivateAttr`, so it is never serialised.
- **Failure paths.** A redactor exception, `MAX_INPUT`, or the deadline returns `WITHHELD`: a
  tool error plus `redaction_blocked`. A switch read that raises, a missing org (`None`), a
  malformed org id, or a pool failure inside `_pii_on` all count as ON (redact). A handler
  exception reaches `server.on_call_tool`'s catch-all, which returns the generic sentence and never
  `str(exc)`. If the DB or Redis is down, the call fails before or at the handler. No path sends
  an unredacted model while the switch reads ON.
- **Policy read.** It runs per call, on the service-role pool, with `WHERE id = $1` bound to
  `principal.org_id`. There is no cache, so `WORKER_COUNT=2` cannot serve a stale OFF.
- **Switch route.** It requires `require_org_manage`. The org comes from `get_active_org_id`
  (the `X-Org-Id` header checked against the caller's `org_members` on a user-JWT connection), and
  never from the body. `extra="forbid"` is set. A missing org returns 404 with no audit row. The
  audit is written after the UPDATE, and the response echoes the `RETURNING` value.
- **Ids and links.** Redaction cannot corrupt an id, cursor, citation or link field, because
  those fields are never visited.
- **Measurement script.** stdout is aggregates only. Samples are refused inside the repo, and the
  DB session is `default_transaction_read_only`.
- **Frontend card.** It never updates optimistically, shows no switch on a failed read, and
  renders both sub lines in every state. `aria-describedby` is wired, and the copy matches the
  UI-SPEC `pii` block verbatim.

**What does not hold up:** the redactor's **recall**. I ran the shipped `pii_redactor.py`
(extracted from `44fb3f9ff` into the session scratchpad, pure functions, no DB) on synthetic
inputs. A card number followed or preceded by any short digit group (an expiry, a CVV, a
quantity) passes through unredacted. So does an IBAN preceded by another "two letters + two
digits" token. The cause is structural: candidates are found with non-overlapping `finditer`, so
when a greedy candidate fails validation, the real value inside it is never tried. The D-38
measurement checks precision only, which is why this was not seen (WR-04-03).

## Critical Issues

### BL-04-01: Card numbers and IBANs next to other digits or tokens are never redacted (non-overlapping candidate search)

**File:** `backend/app/services/pii_redactor.py:173` (`_CARD`), `:218-226` (`_cards`), `:141` (`_IBAN`), `:152-168` (`_ibans`)

**Issue:** `_CARD = (?<![\d])(?:\d[ \-]?){12,18}\d(?!\d)` is greedy and is scanned with
`finditer`, which does not return overlapping matches. When a separator-joined digit group sits
next to the card, the candidate grows to 17-19 digits. The brand-length or Luhn check then
rejects it. `_cards` simply `continue`s: it never retries the 13-19 digit sub-windows, and the
characters are already consumed. `_IBAN` has the same flaw. Its group 3 `(?: ?[A-Z0-9]){10,30}`
starts at an earlier `\b[A-Z]{2}\d{2}` token and eats the real IBAN. That earlier token then
fails the country table, the length check or mod-97, and the real IBAN is never matched.

Results from the shipped code, with the switch ON (each is the full `redact()` output):

| Input | Output |
|---|---|
| `Card 4111 1111 1111 1111 12/26` | unchanged (card plus expiry: 18 digits, no brand) |
| `card: 4111-1111-1111-1111-123` | unchanged (card plus CVV: 19 digits, Luhn fails) |
| `Amex 3782 822463 10005 0425` | unchanged |
| `Qty 2 4111 1111 1111 1111` | unchanged |
| `Order 2024 4111 1111 1111 1111 paid` | unchanged |
| `VAT GB123456789 IBAN GB29 NWBK 6016 1331 9268 19` | unchanged |
| `Ref AB12 DE89 3704 0044 0532 0130 00 thanks` | `Ref AB12 DE89 3704 [phone removed] thanks` (partial: country, check digits and bank code leak) |

A card followed by its expiry or CVV is the most sensitive form of card data, and it is exactly
the form that leaks. The org admin card promises that card numbers are "replaced with a short
note". With these inputs, both `structuredContent` and the text block carry the full PAN or
IBAN.

**Failure scenario:** an org admin turns redaction on. A member's Claude Code calls
`search_documents` or `read_document` on a pasted order note: "Paid with Visa 4111 1111 1111 1111
0526 123 ...". Here the 16 digits happen to match. With "... 1111 12/26" or "...-123" the
whole PAN reaches the client and the model's context.

**Fix:** generate candidates from every start, not from non-overlapping greedy matches. Keep the
cheap pre-filter, then validate every digit window inside the run:

```python
_DIGIT_RUN = re.compile(r"(?<![\d])\d(?:[ \-]?\d){12,40}(?!\d)")

def _cards(text):
    for m in _DIGIT_RUN.finditer(text):
        raw, base = m.group(0), m.start()
        idx = [i for i, c in enumerate(raw) if c.isdigit()]       # positions of digits
        taken_until = -1
        for a in range(len(idx)):
            if idx[a] <= taken_until or (a and raw[idx[a] - 1].isdigit()):
                continue                                          # start only at a group boundary
            for n in (19, 16, 15, 14, 13):                        # longest brand length first
                b = a + n - 1
                if b >= len(idx) or (b + 1 < len(idx) and idx[b + 1] == idx[b] + 1):
                    continue                                      # must end at a group boundary
                s, e = idx[a], idx[b] + 1
                digits = "".join(raw[i] for i in idx[a:b + 1])
                if card_brand(digits) and _luhn(digits) and (
                    any(rx.fullmatch(raw[s:e]) for rx in _CARD_GROUPED)
                    or _keyword_near(_CARD_KEYWORD, text, base + s, base + e)):
                    yield base + s, base + e
                    taken_until = idx[b]
                    break
```

For IBANs, use a zero-width lookahead to find each start, then validate forward with the
existing length loop:

```python
_IBAN_START = re.compile(r"\b(?=([A-Z]{2})(\d{2}))")
```

When validation fails, move on to the next start; do not skip past the consumed text. Add fixture
cases for every row of the table above before the fix (RED first, as the plan's TDD rule
requires).

## Warnings

### WR-04-01: Base64-style secrets with two or more "/" are classed as paths and pass through (about 13% of random 40-char keys)

**File:** `backend/app/services/pii_redactor.py:303`

**Issue:** `if len(tok) > ENTROPY_MAX_LEN or tok.startswith("/") or tok.count("/") >= 2: continue`
drops any token with two slashes as "path-shaped". AWS secret access keys, and many other base64
credentials, use the alphabet `[A-Za-z0-9+/]`. I measured this on the shipped code:

- `key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` (the AWS documentation example) is unchanged.
- `AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY` is unchanged (the `NAME=value`
  branch cuts the value, and the slash rule then drops it).
- 2,000 random 40-char base64 keys after `aws_secret `: **270 / 2000 (13.5%) passed through
  unredacted.**

The paired `AKIA…` access key id is caught; its secret often is not. This also contradicts the
card copy, "secrets such as API keys".

**Fix:** apply the path rule only when the token looks like a path. For example, require a
segment of 2 or more lowercase letters between slashes (`re.search(r"/[a-z]{2,}/", tok)`), or
require a leading `/`, `./` or a drive. Or skip the slash rule entirely when the token is the
value of a `NAME=` pair or is preceded by a secret keyword (`key`, `secret`, `token`, `password`)
within `KEYWORD_WINDOW`. Add the AWS example and a slash-bearing base64 key to
`redaction_cases.json` as positives.

### WR-04-02: The choke point fails open for any result shape it does not recognise

**File:** `backend/app/services/outbound_guard.py:110-131`, `backend/app/mcp/dispatch.py:127-134, 188-190`

**Issue:** `guard` walks only fields whose `FieldInfo.metadata` contains `REDACTABLE`. Anything
else is passed through unchanged, and nothing withholds a shape the walker does not cover:

1. **`CallToolResult` passthrough.** `types.CallToolResult` is a Pydantic `BaseModel`, so
   `dispatch` guards it. It has no `REDACTABLE` field, so it comes back as the same object, and
   `_finish` (line 189) returns its `content` text unchanged. `tools.py:49` documents this
   passthrough as supported (used by the 305-01 test specs). A future handler that returns
   `CallToolResult` with document text would bypass redaction silently.
2. **`RedactableText | None` and `list[RedactableText]` are invisible.** Pydantic does not lift
   `Annotated` metadata out of a union or a container. I checked in the venv: for `b: T | None`
   and `c: list[T]`, `any(m is REDACTABLE for m in info.metadata)` is `False`. The first optional
   "snippet" or "folder path" field added to a result model would ship unredacted, and the
   existing pins (`test_the_guard_walks_by_annotation…`) would stay green.
3. **`dict` and `tuple` fields are not walked** (line 123 handles only `BaseModel` and `list`).

None of these is reachable through the three shipped tools today, so this is a WARNING and not a
BLOCKER. But this module is "the ONE outbound choke point" that 308 reuses unchanged, and the
fail-closed claim does not cover its own input shapes.

**Fix:**
- In `guard`, when the switch is ON, return `WITHHELD` for any outcome that is not one of an
  allowlisted set of result models (or reject `CallToolResult` from production specs in
  `_finish`).
- Make `redactable_fields` unwrap `Optional`/`list` (`typing.get_args` on the annotation and look
  for `Annotated[..., REDACTABLE]`), or forbid those shapes.
- Add a structural test that walks every result model in `app.mcp.results` and asserts that every
  `str` field (including nested, optional and list fields) is either `REDACTABLE` or on an
  explicit pass-through allowlist (`document_id`, `folder_id`, `link`, `next_cursor`, `origin`).

### WR-04-03: The D-38 measurement checks precision only; recall is never measured, and both tightenings traded recall away unseen

**File:** `scripts/measure-redaction.py:132-147`, `.planning/phases/305-connect-claude-code-and-cursor/evidence/redaction-measurement.txt`

**Issue:** the script labels only validated hits (TP/FP), and only the first N in DB order from
the search units. It never samples the raw candidates that were rejected: 487 card candidates and
18,285 phone candidates that did not validate. So a false negative cannot show up. Both
tightenings were driven only by the false-positive ceiling. Tightening 2 (secret: links, `?`/`&`,
percent neighbours) and the slash rule each removed true positives without anyone checking. The
SUMMARY headline "ships at 0% labelled false positives" is true, but BL-04-01 and WR-04-01 are
exactly the misses this method cannot see. The evidence lists residuals, but not these.

**Fix:**
- Add a recall arm. Sample K rejected raw candidates per recognizer, as shapes, and label each
  "real value missed / not a value". Also run a synthetic positive set (cards with
  expiry/CVV/qty neighbours, IBANs after VAT ids, slash-bearing base64 keys, lowercase IBANs)
  and report recall next to the FP rate.
- Use a random sample (`ORDER BY random()` or a seeded shuffle) rather than the first N hits.
- Make the gate fail on a recall regression for the synthetic set, not only on FP over 20%.

## Info

### IN-04-01: The guard does its CPU work on the event loop, and the deadline cannot preempt a field

**File:** `backend/app/services/outbound_guard.py:98-100, 105-120`; `backend/app/services/pii_redactor.py:273-281`

`guard` is `async` but calls `_walk` synchronously, so all regex and lookback work runs on the
event loop. `_check` runs only between fields, so one slow field cannot be stopped. It is only
discovered as late afterwards, which still fails closed. `_inside_url` walks back up to 2,048
characters for every token candidate, which makes it roughly quadratic on token-dense text with
no whitespace. Measured on the shipped code with a crafted input of 32-char mixed tokens joined by
`.`: an 8,256-char read field takes **67 ms**, and a 64,000-char (`MAX_INPUT`) input takes
**685 ms**. Today's inputs are bounded (read ≤ 8,256 chars, search passage about 1,000), so the
real stall is tens of milliseconds per call. **Suggestion:** run `_walk` via `run_in_threadpool`
(it is pure), and cap `_inside_url`'s lookback by stopping at the previous token boundary, not
only at whitespace.

### IN-04-02: Lowercase IBANs and non-ASCII email local parts are only partly masked

**File:** `backend/app/services/pii_redactor.py:100-103, 141`

`iban: de89 3704 0044 0532 0130 00` gives `iban: de89 3704 [phone removed]`: `_IBAN` is
uppercase-only, and the phone recognizer catches only the `00…` tail. `jöhn@example.com` masks
only `hn@example.com` (the lookbehind allows a start after `ö`). Unicode domains are not matched
at all. **Suggestion:** match IBANs with `re.IGNORECASE` and upper-case the text before mod-97.
Widen the local-part lookbehind to `\w`, or start the match at the preceding non-space boundary.

### IN-04-03: `mcp-timeout-probe.py` crashes in its own killed-subprocess path

**File:** `scripts/mcp-timeout-probe.py:120, 168-176`

`subprocess.TimeoutExpired.stdout`/`.stderr` are always `bytes` when output was captured,
even with `text=True` (Python docs). In the `except subprocess.TimeoutExpired` arm,
`" ".join((stdout or "").split())` then raises `TypeError` (it tries to join `bytes` with `str`).
The `finally` stops the server, but every recorded row is lost and no evidence file is written.
`_classify`'s `finished` parameter is also unused. **Suggestion:** decode
(`(exc.stdout or b"").decode("utf-8", "replace")`), and either use `finished` or drop it.

### IN-04-04: UI-SPEC's touch-target clause is not implemented

**File:** `frontend/src/components/org/OrgPiiRedactionCard.tsx:91-117`

UI-SPEC (§Spacing, "Touch target") says "its whole title row is the label, so the hit area is
the row". In the card, the title is a plain `div` and only the 20×36 `button[role=switch]` is
clickable. `OrgMcpSwitchCard` has the same gap, so this is inherited, not new. **Suggestion:**
make the title row a `<label>` for the switch, or wrap the row in the click target. Otherwise
amend the UI-SPEC clause.

### IN-04-05: Sample context keeps letters verbatim; "SHAPES" overstates the sample hygiene

**File:** `scripts/measure-redaction.py:140-147, 207-214`

`_shape_digits` turns only digits into `9` and masks other matches. Letters in the ±32-char
context, which can include names and street names, are written verbatim to the outside-repo
sample file. That file sits in the session scratchpad, which is not repo-tracked but persists on
disk. The SUMMARY's "label real-corpus samples as SHAPES (letters a/A, digits 9)" describes the
match, not the context. **Suggestion:** state this precisely in the docstring and evidence, and
delete the sample and label files after labelling (or have the script print a reminder).

### IN-04-06: OPERATOR.md overstates coverage and points operators into `.planning/`

**File:** `docs/OPERATOR.md:538-550`

The section lists "secrets (known API-key prefixes, JWTs, high-entropy tokens)" but omits these
residuals:
- high-entropy tokens inside links are ignored;
- slash-bearing keys are missed (WR-04-01);
- a search passage is redacted without a boundary window (Pitfall 8);
- names, postal addresses, dates of birth and national ids are not covered (only names are
  mentioned).

It also sends the operator of a deployed box to `.planning/phases/.../305-VALIDATION.md`, which is
a planning artifact and not a deploy document. **Suggestion:** add a short "Not covered" list
that mirrors the redactor docblock, and move the measured FP and latency figures inline or into
`docs/`.

## Fix log

2026-10-31, gsd-code-fixer, main checkout on `develop`. Each finding was re-run against the code
before it was fixed. All seven BL-04-01 rows, the two WR-04-01 inputs, and the 270/2000 sweep
(274/2000 with this fixture's seed) reproduced exactly. Tests came first: each RED commit was
committed failing, then its fix.

| Finding | Outcome | Commits |
|---|---|---|
| **BL-04-01** | **fixed.** `_cards` now tries every digit-group start of a `_DIGIT_RUN`, at every brand length (longest first), and each window must end on a group boundary. The validators are unchanged: IIN + length + Luhn + grouping or keyword. `_ibans` uses a zero-width `_IBAN_START`, so a failed earlier token no longer swallows the real IBAN. Ten fixture cases were added: the seven table rows, plus three negatives (a VAT id alone, an ungrouped Luhn-valid window inside a longer run with no keyword, a year table). Worst-case latency: an 8,256-char run of one-digit groups now takes about 30 ms (was about 5 ms), and 64k chars about 240 ms. A new test pins it under 250 ms. | RED `3221e67f1`, fix `d33d491e1` |
| **WR-04-01** | **fixed.** A token is path-shaped only if it has 3+ segments and either starts with `/` or has word-shaped leading segments (lower case and digits, at most a leading capital). The path rule never applies after a secret keyword within 24 chars, or to a `NAME=` value. Sweeps: after `aws_secret`, misses fell from 274 to 1 out of 2000; for bare keys, from 284 to 25 (1.25%). On the local corpus, the old rule dropped 5 tokens, all absolute paths; the new rule re-admits none of them, so the 305-04 tightenings hold. | RED `362df9830`, fix `150990095` |
| **WR-04-03** | **fixed.** `measure-redaction.py` has a recall arm: 20 templates, 200 synthetic values each, planted at random word boundaries in real search chunks. A gated template below 95% exits 1. Lowercase IBANs are measured as a residual and not gated. The TP/FP sample is now a seeded random draw (`--seed`, default 305) over rows read `ORDER BY id`. stdout still shows aggregates only. Not done: sampling the *rejected* raw candidates for labelling. The planted-value arm measures misses instead. | `23663512e`; evidence `c92617065` |
| **IN-04-03** | **fixed.** A killed run's partial output is decoded through `_as_text`, so bytes no longer crash the probe. The unused `finished` parameter is gone. I tested the bytes path directly: the old code raises `TypeError` and the new code returns text. On this Windows 3.12.6 venv, a real killed child returned `str`, so the crash depends on the platform. | `7da2f821e` |
| WR-04-02 | not in this fixer's scope (lives in `dispatch.py`), routed by the orchestrator | — |

**Re-measured (Run 4, `evidence/redaction-measurement.txt`):**
- **Validated hits:** identical to Run 3 on every row.
- **Labelled FP:** 0% for every recognizer: email 0/30 (random), phone 0/15, iban 0/2, secret 0/9. Card has no corpus hits. All are under the 20% ceiling.
- **Recall on gated templates:** email 100%, phone 99.2%, card 100%, iban 100%, secret 99.7%.
- **Latency (ms):** search p50/p95/p99 0.224/0.359/0.643; read 1.805/2.561/2.861.

**New residuals, stated in the evidence:**
- Lowercase IBANs are not masked (IN-04-02, 0/200).
- An international phone number followed by separators and more digits can still grow past 15 digits and be rejected whole (5 of 200 `00`-form numbers). The every-start fix was not applied to phones.
- Without a keyword, a key that starts with `/` and contains another `/` reads as a path.

Gate: `venv/Scripts/python.exe -m pytest tests/unit -q -k "redact or pii or outbound or 305"` gave
`407 passed, 11025 deselected, 1 warning`.

---

_Reviewed: 2026-10-31_
_Reviewer: Claude (gsd-code-reviewer), second pass, scope 305-04_
_Depth: deep (redactor / guard / policy / route) + standard (rest)_
