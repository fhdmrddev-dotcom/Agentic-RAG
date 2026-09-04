# Phase 222 — PREFLIGHT (reviewer, Claude)

**Reviewing:** `222-CONTEXT.md` at `e4467af48`. **Written before the door executes**, per the
reviewer role in `AGENTS.md` §3.1. I do not re-plan and I send no build direction: each finding
below is either a fact about shipped code Gemini could not have known, or a question for the
operator.

⚠ **STATE, STATED PLAINLY BECAUSE "FINISHED" IS AMBIGUOUS: Gemini finished `discuss-phase`, not
the phase.** One commit, two files, **zero frontend files touched**. There is no `PLAN.md` and no
door. The rest of this document is a review of nine locked decisions, not of an implementation.

---

## 1 · ⭐ THE ONE THAT WOULD HAVE KILLED THE JOIN — AND IT IS MY ERROR, NOT GEMINI'S

`222-CONTEXT.md` records, under *measured facts*:

> Egress refusals return HTTP **400** with closed reason codes (`address_not_public`, …).

**Gemini wrote down exactly what I told it.** `BUS-047`, my own message, says *"a destination that
fails egress validation is HTTP 400 carrying the refusal `reason_code`"*. **Both halves of that
sentence are wrong about the code I then shipped**, and I am recording it here rather than
quietly correcting the route, because a builder planning against a contract has no way to catch
a reviewer's error except by hitting it at integration — which is the Phase 204 shape this split
is supposed to be defended against.

Measured at `api/connectors.py:1063`:

| | `BUS-047` promised | **shipped** |
|---|---|---|
| status | `400` | **`422`** |
| `detail` | the `reason_code` | **a plain English string** |
| oversize document | *not mentioned* | **`502`, its own sentence** |

```python
raise HTTPException(
    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
    detail=f"Connection refused by security policy: {exc.reason_code}",
)
```

⚠ **THE SECOND ROW IS THE SERIOUS ONE.** `frontend/src/lib/api/connectors.ts:59`
(`readConnectorReasonCode`) returns the code **only when `detail` is an OBJECT**; for a string it
returns `null`, and `readConnectorFailure:43` likewise yields `{reasonCode: null}`. So **the
closed six-code set cannot reach the door at all** from this route. `D-222-06` — *"render an
explicit warning alert using the closed refusal reason"* — **is not buildable as written**, and
the only way to build it would be to string-match an English sentence.

⚠ **AND THE ROUTE IS INCONSISTENT WITH ITS OWN FILE.** `update_grants` and
`_CHECK_NOTHING_TO_CHECK` in the same module already answer
`detail={"reason_code": …, "message": …}`. `probe-auth` is the odd one out.

**This is mine to fix, on the seam, and it must be ANNOUNCED BEFORE it changes** — I bound myself
in `BUS-047` to put any contract change on the bus *before* making it, never after.

## 2 · `D-222-06` flattens two states `BUS-047` explicitly asked to keep apart

> *"Egress HTTP 400 errors **and** `kind: unreachable` render an explicit warning alert…"*

`BUS-047`: *"Those are REFUSALS TO ACT, not descriptions of the server… **Please do not flatten
the two into one error state** — that distinction is the whole reason the codes are closed."*

**"We would not go there"** and **"we went, and got no answer"** send a person to different
places: the first is our policy, the second is their server. One alert for both re-merges them.
Not a defect in the decision-making — a decision I would like re-taken with the reason visible.

## 3 · `D-222-02` — auto-probing while somebody TYPES opens sockets to hosts they are passing through

The decision fires the probe *"automatically with debouncing when a valid URL is entered (and on
blur)"*. `https://a.com` is a valid URL on the way to `https://a.company.example`, so a slow
typist emits probes at **real public hosts they never intended to contact**. Egress validation
refuses private addresses; it does **not** refuse a public stranger, and refusing one would defeat
the feature.

⚠ `BUS-047` deliberately left the trigger to the door and named the stake: *"it opens a socket to
a stranger's address"*. **The nearest precedent is 212's pre-save discovery, which is a BUTTON.**
Blur-only or button-only both keep the feature and remove the typing trail. **Operator's call, not
mine** — I am naming the consequence, not the choice.

## 4 · Nothing locks the `window.open` gesture, which is the likeliest silent failure

`222-CONTEXT.md` correctly records the hazard in its facts, then locks no decision about it.
`D-222-04` says *"a single prominent Sign in button"* and stops there. **Measured while driving
the crypto half: a popup opened AFTER an `await` is blocked, and it fails SILENTLY** — no error,
no window, a button that appears to do nothing. `/authorize` is an async call, so the natural
implementation is the failing one. This deserves a decision of its own, not a note.

## 5 · No decision covers a connection that is ALREADY authorized

Notion **currently holds a live token** (minted 2026-09-01, expires `02:28Z`). Nothing in the nine
decisions says what the door shows for a row that is already connected — re-authorize, disabled,
or a status line. It will be the very first row the operator tests the door against.

## 6 · G-2 is inverted: the presentation is locked BEFORE the sketch that is supposed to judge it

`D-222-08` makes the sketch the acceptance bar for five door states — while `D-222-02` … `D-222-07`
have already fixed the inline probing state, the button copy, the alert treatment and the field
order. CLAUDE.md's G-2 puts `/gsd:sketch` **before** planning precisely so the drawing decides
these. Worth an explicit operator override if the order is deliberate; recorded either way.

---

## What is RIGHT, stated so the corrections are not read as a verdict on the whole

- **`D-222-01` is exactly the contract.** Branching on `kind` alone, no URL heuristics.
- **`D-222-04` splits DCR from BYO on `registration_required`, correctly**, and routes the
  `true` arm into the *shipped* Phase 215 form rather than inventing a second one.
- **`D-222-05` renders `detail` verbatim** and keeps the paste-a-token door working, which is
  what stops this phase from being a regression for GitHub.
- **`D-222-09` owes the un-mocked integration test** — §3.1's requirement, carried unprompted.
- **`BUS-051`'s grants rule was absorbed correctly**: no boolean seed, absence inherits.
- **SEED-237's frontmatter was written back** (`status: in_progress`, `folded_into: 222`), which
  is the register discipline `SEED-233` went without for a whole phase.

## The gate baselines, re-derived on this tree rather than inherited

| Gate | Value |
|---|---|
| `tsc -p tsconfig.app.json` | **66** |
| count gate | **OK · 183/183 · total 7127 · pinned 6404 · failed 0** |
| `ConnectionFormPanel.test.tsx` | 160/160 |

⚠ Growth is the gate WORKING. `7127` includes `+2` from `BUG-260901-01`'s tests; a plan reading a
larger number has read the correct current one.

---

# Post-execution review — plans 222-01 … 222-04

Added as Gemini executed, so findings reach it in-phase rather than in a gap round.

## Fence: CLEAN

`222-01` (`lib/api/connectors.ts` + types), `222-02` (`connectionFormCopy.ts`,
`servicesCatalog.ts`), `222-03` (sketch), `222-04` (`McpAuthDoor.tsx`,
`ConnectionFormPanel.tsx`). **No crypto file, no seam file, no migration touched.**

⚠ `222-05` writes `backend/tests/integration/test_222_mcp_oauth_seam.py` — a backend path, and
**correctly so**: §3.1's un-mocked join test cannot live on one side of the fence by definition.
Recorded so it is not later mistaken for a crossing.

## ⭐ The prediction I got wrong, recorded because being wrong is the finding

`§4` above named the `window.open` gesture as *"the likeliest silent failure"* in the built door.
**It is not.** `McpAuthDoor.tsx:138` opens `about:blank` **synchronously, before any `await`**,
and assigns `href` afterwards — the one pattern that survives a popup blocker — citing `BUS-049`.
A reviewer's prediction is a hypothesis, and this one was falsified by the code.

## ⚠ BUG-260901-02 — `config: {}` DESTROYS the registered client id (`BUS-053`)

`handleOAuthConnect`'s edit arm sends `config: {}`; `update_connection` **replaces** the column
(`connector_service.py:1041`). Driven:

```
ConnectorConnectionUpdate(name=…, mcp_server_url=…, config={})
  → written to the config column: {"headers": {}}
  → custom_client_id survives: False
```

⚠ **Notion's live row holds `bD78Ksp3xBJew1kL` right now.** Wiping it sends `/authorize` down its
re-registration arm (`api/connectors.py:1171`), whose own comment says why that must not happen:
*"re-registering on every Connect would mint a NEW application … a different `client_id` on the
token than on the consent that authorised it."* Every press would orphan a registration at the
vendor. **Not fixed by me — Gemini's file, and it is mid-execution.**

## ⚠ BUG-260901-03 — a blocked popup succeeds silently

Every use of `popup` is guarded by `if (popup)`, so when the blocker returns `null` the flow still
creates/updates the connection, calls `/authorize`, **mints a single-use pending handle**, and then
does nothing: no window, no message, `isAuthorizing` back to false. The correct guard is a refusal
**before** the async work, so nothing is created for a window that cannot open.
