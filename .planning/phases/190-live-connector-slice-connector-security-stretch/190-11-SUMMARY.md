---
phase: 190-live-connector-slice-connector-security-stretch
plan: 11
subsystem: backend-connectors
tags: [connectors, slack, post-message, t13, t14, ok-false, conn-02, conn-03, red-first, falsification, wave-4]

# Dependency graph
requires:
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 06
    provides: "PostMessageConfig — the NON-secret per-capability config (default_channel ONLY, extra='forbid'), which is what makes a stored base_url a REFUSAL rather than an ignored key"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 07
    provides: "send_pinned_http — the ONLY door to an HTTP connection; headers pass through; a 3xx RAISES EgressRefused(reason_code='redirected'); wire AND decompressed size both capped"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 08
    provides: "the adapter protocol (CAPABILITY + INPUT_SCHEMA, AdapterResult/AdapterCheckResult, AdapterError, CredentialLike) and registry.get_adapter, which checks CAPABILITY against the resolved key"
  - phase: 190-live-connector-slice-connector-security-stretch
    plan: 02
    provides: "egress.SLACK_API_BASE (the ONE spelling of the destination) and the EXACT-equality host match for post_message"
provides:
  - "slack_adapter.Adapter — post_message, Slack Web API chat.postMessage, one attempt, on a code-constant host"
  - "the T13 verdict: success IFF status_code == 200 AND payload['ok'] is True — an IDENTITY check, not truthiness"
  - "SlackPostFailed carrying a structured AdapterResult(ok=False) plus its UI-SPEC §4d bucket"
  - "SlackUnreachable — the third door out of check(), so §4d's three states arrive by three distinguishable routes"
  - "_endpoint(method) — a URL builder that cannot SEE stored data, which is D-02 asserted structurally"
  - "backend/tests/unit/test_190_slack_ok_false.py — 18 cases / 25 collected, driven RED first"
  - "the T14 drive for post_message: userinfo, homograph, missing-leading-dot and cleartext, with the raw-string trap shown passing as an inline positive control"
affects: [190-13, 190-14, 190-secure-phase]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Make a destination unforgeable by SIGNATURE: a URL builder that takes only the API method cannot be moved by config, and inspect.signature asserts it"
    - "An IDENTITY check against True, never truthiness — `{\"ok\": \"false\"}` is a non-empty string and every truthiness test says yes to it"
    - "Close the same vendor trap on the CHECK path, not only on the send path: a status-line check paints a REVOKED credential green, which is a lie a person acts on later"
    - "Do NOT add a gate the vendor's own contract does not have — the sibling needs three because its status line says nothing about existence; here `ok: true` IS the vendor's assertion, and a third gate would start failing sends that succeeded"
    - "Fence the run-status vocabulary out of the adapter entirely: a verdict is not a status, and the two states that both mean 'nothing arrived' must stay distinguishable (UI-SPEC §8b)"

key-files:
  created:
    - backend/app/services/connectors/slack_adapter.py
    - backend/tests/unit/test_190_slack_ok_false.py
  modified: []

key-decisions:
  - "SlackPostFailed RAISES and carries an AdapterResult(ok=False) rather than being returned — the plan says 'return', but the sibling adapter raises and 190-13 catches ONE name; a returned ok=False is ignorable, and an ignored failure IS D-31 arriving through the front door on the very vendor this plan exists for"
  - "A stored base_url is REFUSED, not ignored — the plan's 'ignore it' is unconstructable against PostMessageConfig's extra='forbid', and refusing is strictly stronger than discarding an intent silently"
  - "There is NO third success gate (no `ts` requirement). Jira needed the issue-key gate because its status line says nothing about existence; `ok: true` is Slack ASSERTING the message posted, and demanding more than the vendor's own assertion fails sends that actually succeeded"
  - "provider_message carries the error code ALONE, verbatim. `needed`/`provided` are logged but never folded in: that field renders under a 'what the host said, verbatim' label, and a labelled join of two vendor fields is our sentence in the vendor's clothes"
  - "A 200 whose body is not a JSON object fails the same gate — `json()['ok'] is True` is unevaluable on a gateway's HTML page, and a reply we cannot read is not a reply saying a message was posted"
  - "The trap is closed on check() as well as send(): auth.test answers 200 {ok:false} for a revoked token, and a green check is worse than a failed send because it is a light a person acts on later"
  - "allowed_host= is deliberately NOT passed — post_message's permitted host is a CODE rule matched by EXACT equality inside the guard; a per-call host would be a second, staler source of truth"

patterns-established:
  - "Read the CAPTURED LOG to prove a plant reached its property: under the T13 plant every failed reply logged `one message posted (... ts=None)` while the real success logged `ts=1735689600.001900` — the log line itself separates the lie from the truth"
  - "A case that drives an ALREADY-SHIPPED guard is GREEN at RED time by design (T14 here, the positive control in 190-08). Say so, or the RED count reads as an incomplete drive"

requirements-completed: []

# Metrics
duration: 47min
completed: 2026-08-09
---

# Phase 190 Plan 11: The `post_message` Adapter — Slack, and the `ok:false` Trap Summary

**The trap is closed, and it is a measurement rather than a claim: with the `ok` gate removed
and the status gate left standing, the adapter logged `post_message: one message posted
(channel=C0123ABCDEF ts=None)` and returned SUCCESS for a reply that said
`{"ok": false, "error": "channel_not_found"}` — the same log line the real success writes,
except that Slack's own message timestamp is `None`, because there is no message. Thirteen
cases went RED; the file was restored byte-identically.**

## Performance

- **Duration:** ~47 min
- **Tasks:** 2, each committed individually
- **Files:** 2 created, **0 modified**, **0 deleted** — 561 + 744 = **1 305 lines added**
- **Suite:** `test_190_slack_ok_false.py` → **25 passed, 0 failed** (18 `def test_`; the plan
  asks ≥ 9)
- **Dependencies added:** none — `git diff --numstat` over `backend/requirements.txt` and
  `frontend/package.json` prints nothing (T-190-SC). **No `slack_sdk`**, which would have
  constructed its own client and broken D-05 outright, for one POST.

## Task Commits

| Task | Name | Commit |
|---|---|---|
| 1 | The T13 drive — 18 cases, RED first | `b336e047` |
| 2 | `slack_adapter.py`, the suite green, the plant observed | `6473603d` |

---

## ⭐ THE T13 PLANT — the evidence, and the check that it REACHED the property

VALIDATION's named plant for T13 is *"check only `resp.status_code`"*. Applied literally:
the `ok` gate was removed and the status gate left standing.

```
============================================================================
PLANT APPLIED  raw md5 = 5c2494738a8c81b01820f51024e385d1   PLANT count = 1
============================================================================

tests/unit/test_190_slack_ok_false.py::test_a_200_with_ok_false_lands_FAILED_and_never_COMPLETED
-------------------------------- live log call --------------------------------
INFO  app.services.connectors.slack_adapter:slack_adapter.py:494 post_message: one message posted (channel=C0123ABCDEF ts=None)
FAILED                                                                   [  4%]
...
tests/unit/test_190_slack_ok_false.py::test_a_200_with_ok_true_is_the_ONLY_success
-------------------------------- live log call --------------------------------
INFO  app.services.connectors.slack_adapter:slack_adapter.py:494 post_message: one message posted (channel=C0123ABCDEF ts=1735689600.001900)
PASSED                                                                   [ 40%]

13 failed, 12 passed, 1 warning in 0.80s
```

**Read the two log lines together — that pairing is the whole finding.** They are the SAME
line. The adapter did not error, did not warn and did not degrade: it announced a posted
message for a reply that said `channel_not_found`, and the only difference on the wire
between the truth and the lie is that Slack's own timestamp is `None`, because there is no
message to timestamp. That is D-31's *"a phase reads Complete for a send that did not leave
the app"* verbatim, on the vendor UI-SPEC §8c names as the likeliest place this phase ships
it.

**The plant REACHES the property, checked rather than assumed** (phase rule 7, and 190-08's
and 190-10's shared lesson). Three independent confirmations:

1. The captured log shows the success path EXECUTING for a failed reply — the assertion is
   about a refusal that did not happen, but the log is the threat happening.
2. All **eight** documented error codes went red together, plus the truthy-string case. A
   plant that had tripped a source fence instead would have produced one failure in one
   place.
3. `test_a_non_200_is_also_a_failure` and both `check()` cases stayed **GREEN**, which is
   correct and is itself evidence of precision: the plant removed exactly one gate, on
   exactly one path, and nothing else moved.

### The thirteen, named

```
FAILED …::test_a_200_with_ok_false_lands_FAILED_and_never_COMPLETED
FAILED …::test_each_of_the_eight_documented_error_codes_lands_failed[channel_not_found]
FAILED …::test_each_of_the_eight_documented_error_codes_lands_failed[not_authed]
FAILED …::test_each_of_the_eight_documented_error_codes_lands_failed[invalid_auth]
FAILED …::test_each_of_the_eight_documented_error_codes_lands_failed[missing_scope]
FAILED …::test_each_of_the_eight_documented_error_codes_lands_failed[rate_limited]
FAILED …::test_each_of_the_eight_documented_error_codes_lands_failed[no_text]
FAILED …::test_each_of_the_eight_documented_error_codes_lands_failed[invalid_blocks]
FAILED …::test_each_of_the_eight_documented_error_codes_lands_failed[too_many_attachments]
FAILED …::test_ok_as_the_STRING_false_is_not_a_success
FAILED …::test_the_error_code_is_rendered_verbatim_not_translated
FAILED …::test_the_bot_token_never_appears_in_a_failure
FAILED …::test_the_adapter_never_retries_on_rate_limited
```

The last two are informative rather than incidental. The leak fence and the at-most-once
fence both drive FAILURE shapes — so removing a failure path removes their coverage with it,
which is the corollary 190-10 recorded and this run reproduces independently.

### The restore proof — byte-exact

| When | raw md5 | LF-normalised md5 |
|---|---|---|
| Before the plant | `e0474ecad3d18b95278abf310b5fbcb4` | `e0474ecad3d18b95278abf310b5fbcb4` |
| PLANT applied | `5c2494738a8c81b01820f51024e385d1` | `5c2494738a8c81b01820f51024e385d1` |
| After restore | **`e0474ecad3d18b95278abf310b5fbcb4`** | identical |

`git hash-object backend/app/services/connectors/slack_adapter.py` →
`385821c2877e6b3ac8c80141974111758ceb7e35`. `grep -c PLANT` → **0** in the adapter and **0**
in the test file. The harness held the original bytes in memory, wrote them back with
`write_bytes`, and put the restore in a **`finally`** — 190-07's and 190-08's recorded
lessons applied rather than re-learned. The harness itself lives in the session scratchpad,
outside the watched tree.

---

## THE TASK-1 RED — 24 named failures, and 1 GREEN by design

```
E  Failed: No module named 'app.services.connectors.slack_adapter' - plan 190-11 owns
   app/services/connectors/slack_adapter.py. T13/R11: post_message POSTs chat.postMessage
   to the CODE-CONSTANT Slack API base through egress.send_pinned_http and nothing else,
   with the bot token in the Authorization header and never in the body, and a send is
   successful IFF status_code == 200 AND the reply's ok is True.
tests\unit\test_190_slack_ok_false.py:184: Failed

24 failed, 1 passed, 1 warning in 0.83s     (exit code 1)
```

**The 1 that passed is `test_a_userinfo_or_homograph_host_cannot_reach_slack`, and its
passing at RED time is correct** — it drives the guard 190-02 already shipped, so it is green
before this adapter exists and stays green after, exactly as 190-08's positive control did.
Stated here because a RED count that silently includes a green row reads as an incomplete
drive; this one is a control, not a miss.

Every other case resolves the module through a named `_adapter()` helper rather than a
module-scope import, so the RED is **24 named failures** instead of one collection error —
the lesson 190-01, 190-02, 190-07, 190-08 and 190-10 each recorded, applied without
re-deriving it.

---

## Provider-docs-first — what was checked, and how

CLAUDE.md's provider-docs-first rule binds here. **The Context7 MCP tools were not available
in this agent's environment and the `ctx7` CLI fallback is not installed** (`command -v ctx7`
→ *ctx7 NOT installed*), so the primary evidence is `190-RESEARCH.md` §R11, which cites
Slack's own reference by URL (*docs.slack.dev — chat.postMessage*) and quotes the trap
directly. **§R11 was authored 2026-08-08, one day before this plan executed**, and RESEARCH's
own confidence table rates it **HIGH — *"Slack's own reference; the `ok:false` trap is stated
by the vendor."***

| §R11 finding | Confidence | Implemented as |
|---|---|---|
| Errors return **HTTP 200** with `{"ok": false, "error": "<code>"}` | **HIGH** (stated by the vendor) | the two-gate verdict, `payload.get("ok") is not True` → `SlackPostFailed` |
| `Authorization: Bearer xoxb-…`; a POST `token` param is *also* accepted | **HIGH** | the header, asserted present; a body `token` key asserted absent (D-08) |
| Required args are `channel` + `text`; `chat:write` is the only scope needed | **HIGH** | `INPUT_SCHEMA` is `text` only; the channel is the connection's. No `blocks`, no `attachments`, no `username`/`icon_*` — each needs a scope 190 does not request |
| ~1 message/second/channel, with burst | **HIGH** | nothing. D-18 forbids a retry, so the limit costs a log line rather than behaviour (RESEARCH's own **A2**) |
| `auth.test` as the identity endpoint, and its reply shape | **not in §R11** | implemented; recorded below as **assumption A3** with its trigger |

**The conventions were deliberately NOT transferred from the sibling adapter.** That is the
entire point of this plan: the ticket vendor's status-code contract is the OPPOSITE of this
one, and the fences on both sides exist so that a future tidy-up cannot merge them.

## The two gates — and why there is deliberately no third

| Gate | What it rules out |
|---|---|
| `status_code == 200` | a 429, a 5xx, a gateway page — anything that is not the vendor answering |
| the body parses as a JSON **object** | a 200 carrying HTML: `json()["ok"]` is unevaluable, and a reply we cannot read is not a reply saying a message was posted |
| `payload.get("ok") is True` | ⭐ the trap. An **identity** comparison, because `{"ok": "false"}` is a non-empty string and every truthiness test in Python says yes to it — driven across `"false"`, `"true"`, `1`, `0`, `[]`, `{}`, `None` and `"yes"` |

**There is no `ts` gate, and that is a decision rather than an omission.** 190-10 added an
issue-key gate because Jira's status line says nothing about whether an issue exists — the
key is the only evidence in the reply. Here `ok: true` **is** the vendor asserting, in its own
words, that the message posted. Requiring more than the vendor's own assertion would start
failing sends that actually succeeded, which is the opposite error and just as dishonest on a
surface whose discipline is not over-claiming. The timestamp is recorded in `detail` and
logged — and under the plant it is exactly what exposed the lie.

## The §4d vocabulary — three states, three ROUTES

| State | Route out of the adapter |
|---|---|
| `refused` | `EgressRefused` propagates **unchanged**, carrying one of §4c's six authored reason codes |
| `unreachable` | `SlackUnreachable`, or `SlackPostFailed(bucket="unreachable")` on the send path — `raw_status` stays `None`, because inventing a status would be a wire fact we made up |
| `rejected` | `SlackPostFailed(bucket="rejected")` on send; `AdapterCheckResult(ok=False)` on check. **Every `ok:false` lands here**: Slack answered, and what it answered was no |

`FAILURE_BUCKETS` has no fourth member and is checked at the raise site.
`EgressResponseTooLarge` / `EgressResponseUndecodable` propagate unchanged, like the sibling.

---

## Deviations from Plan

### 1. [Recorded — the plan's instruction contradicts its own acceptance grep] The module header names neither `raise_for_status` nor the Slack URL

Task 2 asks the module header to say *"a naive `raise_for_status()` would read
`channel_not_found` as success"* — and Task 2's own acceptance criteria require
`grep -c "raise_for_status"` → **0** and `grep -c "https://slack.com"` → **0** in that same
file. Both sentences were rewritten (*"a status-only check — the shape that is genuinely
CORRECT for the ticket vendor"*; *"the API method appended to the CODE-CONSTANT base"*), and
the reason is stated inside the docstring so a future reader does not "fix" it back.

This is **the fourth occurrence** of 190-07's recorded rule in this phase — *when prose in
production source would trip the very fence it describes, rewrite the sentence rather than
declare a conflict* — after 190-07 (the raw-string send API), 190-08 (the three-letter
acronym) and 190-10 (the credential-encoding vocabulary). It is now frequent enough to be a
pattern rather than a coincidence.

### 2. [Recorded — the plan's instruction is unconstructable] A stored `base_url` is REFUSED, not ignored

Task 2 says *"If a `base_url` key is present in `config`, ignore it — and the test proves
ignoring it is what actually happens."* **It cannot be ignored.** `PostMessageConfig`
(190-06, `extra='forbid'`) declares `default_channel` and nothing else, so a `base_url` key
is a `ValidationError` by design; "ignoring" it would mean bypassing the shipped model, which
is a regression rather than a feature.

Refusing is strictly stronger — an ignored key still describes an intent the system silently
discards, and the next reader cannot tell which — so D-02's claim is asserted **four
independent ways** instead:

1. `PostMessageConfig.model_fields` == `{"default_channel"}` — there is no URL field;
2. a config carrying `base_url: https://evil.com/` raises `SlackConfigInvalid` and **nothing
   reaches the wire** (`recorder.calls == []`);
3. `inspect.signature(_endpoint).parameters == ["method"]` — **the URL builder cannot SEE
   stored data**, so a destination that depends on config is unconstructable rather than
   merely unused;
4. a normal send lands on `SLACK_API_BASE + "chat.postMessage"`, asserted as an equality.

### 3. [Recorded — a signature choice, matching the sibling] `SlackPostFailed` RAISES and carries an `AdapterResult`

Task 2 says *"Otherwise **return** `AdapterResult(ok=False, …)`"*. It raises instead, carrying
a real `AdapterResult` with `ok=False` **asserted at construction**, for three reasons:

- 190-10's sibling raises, and 190-13's hand-off is *"catch `protocol.AdapterError` for the
  engine's failure path"* — **one** name, not two shapes;
- a returned `ok=False` is ignorable, and an ignored failure IS D-31's *"Complete for a send
  that did not leave the app"* arriving through the front door — on the one vendor where that
  defect is this plan's entire subject;
- the payload is unchanged: `.result` is exactly the structured value a `return` would have
  produced, so nothing is lost and the plan's assertion (`AdapterResult.ok is False`) still
  reads directly.

### 4. [Rule 2 — missing critical functionality] The non-JSON-object gate

The plan states the contract as two gates. A 200 carrying a gateway's HTML page satisfies the
first and makes the second **unevaluable** — `json()["ok"]` has nothing to read. Such a reply
now fails through the same door, with the host's own decoded text surfaced verbatim. Driven
as one of four shapes in `test_a_non_200_is_also_a_failure`.

### 5. [Rule 2] The trap is closed on `check()` too, not only on `send()`

The plan's T13 tasks are about `send`. **`auth.test` answers `200 {"ok": false, "error":
"invalid_auth"}` for a revoked token**, so a check that read the status line would paint a
dead credential GREEN — which is worse than a failed send, because it is a light a person
acts on later rather than a failure they see now. The same identity gate applies on the check
path, with its own driven case
(`test_check_reports_a_200_ok_false_as_a_REJECTED_credential`).

### 6. [Rule 2] T14 driven for this capability, with an inline positive control

Phase rule 3 requires T14 closed; neither task text includes it. Driven against the **real**
`validate_destination("post_message", …)` across five hostile destinations — userinfo
(`slack.com@evil.com` → host `evil.com`), attacker-subdomain (`slack.com.evil.com`), the
missing-leading-dot CVE (`notslack.com`), a homograph (`xn--slck-hoa.com`, which httpx
IDNA-decodes to a non-ASCII host → its own `host_not_ascii` code), and cleartext
(`http://slack.com/…` → `scheme_not_tls`) — plus the allowed destination as a negative
control. **The inline positive control asserts that ≥ 3 of the five contain the literal
`slack.com`**, so the case cannot quietly become vacuous: a guard matching the raw string
would have let them through, which is precisely T14's named plant.

### 7. [Rule 2] A D-17 source fence — zero run-status vocabulary in the adapter

Phase rule 5 requires zero new run-status words and that a failed send stay distinguishable
from the unbound-step terminal (UI-SPEC §8b). Asserted mechanically rather than described: a
per-file fence (matcher proved non-inert on a planted haystack) requires **zero** occurrences
of the status vocabulary in `slack_adapter.py`. The adapter reports a verdict; the words
belong to 189's shipped statuses and to the executor. **No migration was written and
`workflow_phases` is named nowhere.**

### 8. [Recorded] `provider_message` carries the code ALONE; `needed` / `provided` are logged

`missing_scope` arrives with `needed` and `provided`, and they are genuinely useful — they are
emitted on the WARNING log line. They are deliberately **not** folded into
`provider_message`, which renders under UI-SPEC §5b's *"what the host said, verbatim"* label:
a labelled join of two vendor fields is our sentence wearing the vendor's clothes, and 071-A's
whole point is that exactly one string is the host's. The sibling adapter joins two arrays for
the opposite reason — Jira's envelope has no single code to quote — and the difference is
stated in both files.

### 9. [Recorded] A symmetric T13 fence, so the prohibition binds from both sides

190-10 shipped `test_jira_and_slack_do_not_share_a_response_checker`, which fences the **Jira**
file. It passes (this adapter is not named there), but on its own it would let this file
import from the sibling. `test_slack_borrows_no_response_interpretation_from_a_sibling` fences
this side with the same matcher discipline, plus the `protocol` module walk, plus a positive
assertion that this file **does** own its own `ok` handling — so the absence is a decision
rather than an omission.

---

**Total deviations:** 4 Rule-2 additions, 2 recorded unconstructable/contradictory
instructions, 3 recorded design notes. No package was installed, no file outside
`files_modified` was opened, and no file was deleted.

## Verification (run, not quoted)

| Check | Result |
|---|---|
| `pytest tests/unit/test_190_slack_ok_false.py -q` | **25 passed, 0 failed** (plan asks ≥ 9 cases) |
| Task-1 RED exit code | **1**, with **24 named failures** + 1 green control |
| `grep -c "def test_"` in the test file | **18** |
| `grep -cE "xfail\|@pytest.mark.skip"` in the test file | **0** |
| All eight literal error codes present in the test file | **yes** (4/4/6/4/6/2/1/1 occurrences) |
| `grep -c "auth.test"` in the test file | **4** |
| `grep -cE "httpx\.(Client\|AsyncClient)\|requests\.\|smtplib\.\|urllib\.request\|socket\."` in the adapter | **0** |
| `grep -c "raise_for_status"` in the adapter | **0** |
| `grep -c "is True"` in the adapter | **1** (identity, not truthiness) |
| `grep -c "SLACK_API_BASE"` / `grep -c "https://slack.com"` in the adapter | **3 / 0** — one spelling, in `egress.py` |
| `retry` / `backoff` / `sleep` lines in the adapter not citing D-18 | **0** |
| `Adapter.CAPABILITY, sorted(INPUT_SCHEMA['properties'])` | `post_message ['text']` |
| `get_adapter('post_message').CAPABILITY` | `post_message` — resolves through the registry |
| `grep -c PLANT` adapter / test file | **0 / 0** |
| Adapter raw md5 after the plant | **identical to before** (`e0474eca…`) |
| `pytest tests/test_harness_engine.py -q` | **46 passed** — matches §M2 / 190-01 / 190-02 / 190-07 / 190-08 / 190-10 exactly |
| 190 + 189 regression group, **without** this file | **157 passed, 4 failed** |
| 190 + 189 regression group, **with** this file | **182 passed, 4 failed** — 157 + 25, same 4 |
| `pytest tests/unit/test_189_no_egress.py -q` | acronym fence **GREEN**; 1 failed / 22 passed (the known 190-13 RED) |
| `git diff --numstat` — `requirements.txt` / `package.json` | **empty** (T-190-SC) |
| File deletions in either commit | **none** |
| `graphify update .` | **19 922 nodes / 52 607 edges** rebuilt (untracked artefact; no git impact) |

**Known pre-existing REDs, unchanged and not regressions** (both owed by **190-13**, recorded
identically by 190-02 / 190-06 / 190-07 / 190-08 / 190-10): the three
`test_190_egress_ordering.py` cases and
`test_189_no_egress.py::test_a_bound_connection_under_the_armed_sentinel_MUST_attempt_egress`.
The count is **4 either side of this plan**, derived by running the group with and without the
new file rather than asserted.

## Threat-model dispositions honoured

| Threat ID | How it was met |
|---|---|
| T-190-11-T13 | Success requires `status_code == 200` **and** `payload.get("ok") is True` (identity, plus a JSON-object gate). All eight documented codes driven to failure; the completion vocabulary asserted **absent** from every rendering of a failure (D-31 asserted directly, not described). **PLANT observed RED at 13 failed / 12 passed, and its captured log shows the success path executing for a `channel_not_found` reply** |
| T-190-11-SPLIT | No shared `_check_response` with any sibling; `raise_for_status` asserted absent; the sibling MODULE NAMES asserted absent from this file, matcher proved non-inert on a planted haystack. `dir(protocol)` additionally asserted to contain no such helper, and this file asserted to own its own `ok` handling — so the absence is a decision. **Fenced from BOTH sides now** |
| T-190-11-HOST | `SLACK_API_BASE` imported from `egress.py` with exactly one spelling; `_endpoint`'s SIGNATURE proves the destination cannot see stored data; a `base_url` config refused with zero calls to the wire; the recorded URL asserted equal to the constant. **T14 additionally driven for this capability across five hostile destinations with a raw-string positive control** |
| T-190-11-TOKEN | `Authorization: Bearer` asserted present and equal to the sentinel; the body asserted to be exactly `{channel, text}` with no `token` key and no occurrence of the sentinel anywhere in it. The sentinel asserted absent from all four failure shapes |
| T-190-11-D18 | Exactly one call reaches the binder on `rate_limited`, asserted — with the recorder's **second queued response a SUCCESS on purpose**, so a retrying adapter would have reported a posted message rather than failing noisily. No retry, no backoff, no idempotency key, no queue, asserted per line |
| T-190-11-CHECK | `check` asserted to reach `auth.test`, to carry **no body at all**, and never to reach `chat.postMessage`. Its verdict is asserted both ways (a working token names the bot AND the workspace; a revoked one returns `ok=False` with the code verbatim) |
| T-190-SC | **Zero installs.** `slack_sdk` explicitly refused — it constructs its own client, which breaks D-05 outright, for one POST. `json` and `logging` are stdlib; `pydantic` and the egress binder were already declared. `git diff --numstat` over both commits prints nothing |

## ⭐ Assumption for SECURITY.md — A3 (new, measured here)

### A3 — `auth.test` is not driven against a live workspace

> **Status:** accepted assumption, fenced by a fail-CLOSED verdict. **New in this plan.**
>
> **The assumption.** `auth.test` accepts a POST carrying only the `Authorization` header and
> no body, and answers `{"ok": true, "user": "<bot handle>", "team": "<workspace>", …}`.
> **§R11 documents `chat.postMessage` only** — the identity endpoint, its no-body call shape
> and its reply field names are not in the research and are not driven against a live
> workspace (D-30's blocking dependency: no throwaway Slack channel exists yet).
>
> **What breaks if it is wrong.** The verdict fails **CLOSED**, in every direction: a reply
> that is not a JSON object, one whose `ok` is not `True`, or one that names nobody all return
> `AdapterCheckResult(ok=False)` with Slack's own words attached. So a wrong guess produces a
> check that **refuses to go green**, never one that goes green wrongly. What degrades is
> usability (an operator sees a red check for a working token), not honesty.
>
> **What is NOT affected.** `send` — it uses `chat.postMessage`, which §R11 documents at HIGH
> confidence, and it shares no code with the identity path beyond the transport call.
>
> **Trigger:** the first live `post_message` UAT row (D-30). **VALIDATION already names this
> as the recommended FIRST row of the phase**, because it is the row that falsifies T13.
> Capture the real `auth.test` reply, compare it against `SLACK_AUTH_OK` in
> `tests/unit/test_190_slack_ok_false.py`, and correct `_identity_of` if it differs. The same
> row confirms the success-body field names (`ts`, `channel`) used in `detail`.

## Known Stubs

**None in this plan's own output.** Every function in `slack_adapter.py` is wired to a real
code path; nothing returns a hardcoded empty value and no placeholder text exists.

**All three capabilities now resolve to a real adapter** — `get_adapter('post_message')`
returns this module, and the registry's D-04 assert has been meaningful since 190-08. What is
still deliberately absent belongs to a named plan: the executor wiring that actually sends
(190-13). Until it lands, this adapter is reachable only through the registry and its own
suite — which is why the four known REDs above are still red, and why **CONN-02 is not marked
complete here**.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: auth-path | `backend/app/services/connectors/slack_adapter.py` | **This file CONSTRUCTS a credential header**, which its sibling deliberately does not (that one hands a pair to the library and the library encodes it). It is unavoidable — the vendor's auth is a bearer token — and there is nothing to encode, so no encoded credential string exists here. It is flagged rather than left implicit because **190-14's standing fence must not ban the header's name outright**: a blanket ban that is correct for the ticket adapter would be wrong for this one. The property to fence here is *the token appears in no body, no log and no refusal*, which this plan's suite drives across all four failure shapes |

Nothing else outside this plan's `<threat_model>`: no network endpoint, no file access and no
schema change was opened.

## Scope / rule notes

- **D-32 scope fence honoured:** Slack `post_message` only. No fourth capability, no catalog,
  no webhook, no OAuth authorization-code flow, no service account, no retry / idempotency key
  / queue, no expression language, no migration, no router change, no frontend file opened.
  **190-09's `D-190-DEF-07`** (the UI-SPEC §2h banner/gate conflict) belongs to 190-16 / 190-18
  and was deliberately not touched.
- **CLAUDE.md provider-docs-first:** honoured through §R11's vendor citations, with the
  Context7 / `ctx7` unavailability stated rather than silently skipped (see above).
- **CLAUDE.md `graphify update .`** run after the production-source change (`graphify-out/` is
  untracked, so no artefact entered either commit).
- **G-5 hot-file ledger:** `slack_adapter.py` is **new** — 0 prior phases. No ledger row
  applies and none is added; a row for a one-plan-old file would be noise.
- **No `xfail`, `skip` or `skipif`** in the new test file (`grep -cE` → 0).
- **The 189 acronym fence is untouched and green** — the three-letter acronym is spelled
  nowhere in either new file.

## Next Phase Readiness

**Ready.** What downstream plans inherit and owe:

| Owed by | What |
|---|---|
| **190-13** | `await get_adapter("post_message").send(args={"text": …}, credential=…, config=…)`. `config` is the CONNECTION ROW's config (`default_channel` ONLY). Catch `protocol.AdapterError`; `SlackPostFailed` carries `.result` (an `AdapterResult` with `ok=False`, `provider_message` verbatim, `raw_status`) and `.bucket` (one of §4d's three). **`EgressRefused`, `EgressResponseTooLarge` and `EgressResponseUndecodable` pass straight through** and are not `AdapterError` subclasses — catch them separately or they escape. Identical to the sibling's contract, deliberately |
| **190-13 / the check endpoint** | `check()` has THREE exits: `EgressRefused` (refused), `SlackUnreachable` (unreachable), `AdapterCheckResult(ok=False)` (rejected — and **only** rejected). `identity` reads *"{bot} in {workspace}"* when Slack supplies both |
| **190-13** | ⚠ **Do not "normalise" the two HTTP adapters' verdict functions.** They are fenced from both sides now, and the fences' matchers are proved non-inert. The vendors disagree; flattening them is the defect |
| **190-14** | ⚠ **The credential-header fence must be SCOPED, not tree-wide.** 190-10's hand-off asks for the encoding vocabulary matched case-insensitively — correct for that file, and it would be WRONG applied to this one, where a bearer header is the vendor's own auth mechanism. Fence *this* file on `token`-in-body and sentinel-in-refusal instead; both are already driven in `test_190_slack_ok_false.py` and can be lifted verbatim |
| **190-14** | All three capabilities now resolve to a real, importable adapter whose `CAPABILITY` equals its registry key — the promise 190-08 left with a date on it is now keepable |
| **UAT / D-30** | **Slack is VALIDATION's recommended FIRST live row**, and A3 above is the reason it is worth more than one row's cost: it confirms `auth.test`'s shape as well as falsifying T13 |
| **`/gsd:secure-phase`** | T13 has a driven falsification whose log line shows the threat happening. T14 is driven for this capability with a positive control. A3's SECURITY.md block is drafted verbatim above, with its trigger |

**Three things not to re-litigate:** (1) there is no `ts` gate — `ok: true` is the vendor's own
assertion, and demanding more fails sends that succeeded; (2) a stored `base_url` is refused
rather than ignored, because the shipped config model forbids the key; (3)
`provider_message` carries the code ALONE — `needed`/`provided` are on the log line by
decision, not by oversight.

## State bookkeeping — hand-edited, and why

**The SDK state verbs were NOT called.** D-190-DEF-01 has five recorded occurrences this
phase, the most recent (190-06) where both verbs *reported doing nothing* while deleting 39
lines including `stopped_at` and three history blocks. `STATE.md` and `ROADMAP.md` were edited
by hand, per the plan-03/04/05/06/07/08/09/10 convention, then diffed.

**`REQUIREMENTS.md` deliberately NOT marked.** CONN-02 and CONN-03 are marked **together at
phase close** (the convention D-190-DEF-02 set at 190-01). CONN-02 is unmet until 190-13
wires the send; claiming it here would assert a capability that does not exist, in the phase
whose whole discipline is not over-claiming.

## Self-Check: PASSED

| Claim | Result |
|---|---|
| `backend/app/services/connectors/slack_adapter.py` | FOUND (561 L) |
| `backend/tests/unit/test_190_slack_ok_false.py` | FOUND (744 L) |
| `.planning/…/190-11-SUMMARY.md` | FOUND |
| commit `b336e047` (Task 1) | FOUND |
| commit `6473603d` (Task 2) | FOUND |
| No file deletions in either commit | CONFIRMED |
| `grep -c PLANT` adapter / test file | 0 / 0 |
| Suite green | 25 passed, 0 failed |

---
*Phase: 190-live-connector-slice-connector-security-stretch*
*Completed: 2026-08-09*
