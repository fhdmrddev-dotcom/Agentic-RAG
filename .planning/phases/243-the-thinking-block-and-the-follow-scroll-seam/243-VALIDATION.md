---
phase: 243
name: The Thinking Block and the Follow-Scroll Seam
kind: validation
authored: 2026-09-11
authored_at: scope-time
source: "carried verbatim from 243-CONTEXT.md § UAT — authored at scope time, not post-hoc, which is the whole point of G-4"
requirements: [CHAT-01, CHAT-02, CHAT-03, CHAT-04, CHAT-05]
---

# Phase 243 — VALIDATION

⚠ **These rows were authored at SCOPE time, in `243-CONTEXT.md`, before any plan existed.** They are
carried here rather than re-invented, because a UAT row written after the build is a description of
what was built. Only rows that a plan made **newly checkable** are added, and each one says which
plan made it so.

⚠ **A row may be recorded as OWED, and closing the phase with owed rows is legitimate — but it is
stated as a DECISION, never as a claim that everything ran.** A scoreboard that lists only what
passed is not a scoreboard.

⛔ **A blocked row is recorded with ⛔ and the reason. It is never silently omitted.**

---

## Axis 1 — Cross-provider: reasoning is a PROVIDER-SHAPED feature, so the roster is not optional

⛔ **DERIVE the roster; never re-type it.** `MODEL_CAPABILITIES` is the source of truth —
`backend/app/config.py:263`. Group by `provider`, take the **newest registry-backed** model per
group, and fill the `Model` column from that derivation at run time. An id absent from
`MODEL_CAPABILITIES` resolves `capability_source=inferred` and silently loses `emit_tier`, so a
hand-typed id can measure a weaker configuration than the one that ships (SEED-040, SEED-135).

⚠ **Only some providers emit reasoning at all.** A provider that emits none is a legitimate ⛔ row
**with the reason "emits no reasoning_content"** — and it still proves the non-reasoning path did
not regress, which is a result worth having.

**Cheapest honest method** (proven in Phase 185): drive each row as a real run with a **per-request**
`model` + `provider` on `POST /threads/{id}/messages`. That scores the whole board **without
mutating any global setting**, so the operator's environment is untouched and rows cannot
contaminate each other.

| # | Provider | Model (derive) | What this row proves | Result |
|---|---|---|---|---|
| 1 | OpenAI | *derive* | the thinking block renders, folds, and settles on the mainstream path | |
| 2 | Anthropic (native SDK) | *derive* | same, on the native-SDK path | |
| 3 | Google | *derive* | ⚠ historically the highest-risk row for tool-call emission — proves the thinking block sits above tool rows without disturbing them | |
| 4 | DeepSeek | *derive* | ⭐ **the original `reasoning_content` provider** — Phase 076.2 built this surface for it. If any row must pass, it is this one | |
| 5 | Zhipu / GLM | *derive* | | |
| 6 | MiniMax | *derive* | | |
| 7 | Moonshot / Kimi | *derive* | the only `emit_tier: coerce` native rows — the weakest emission guarantee in the registry | |
| 8 | OpenRouter | *derive* | `native_tools: False` — the non-native tool path, not a fifth flavour of the native one | |

**Per-row checklist** (the same four questions on every provider):
1. Does reasoning render at all? (CHAT-01 / CHAT-04)
2. Does the fold stay CLOSED while streaming, and settle quietly? (D-243-02)
3. Does the label read `Thought for N seconds` on a run that was WATCHED, and `Thinking` on one
   loaded from the database? (D-243-13 — **the two must differ, and that difference is deliberate**)
4. Did the answer render below the thinking line, live? (CHAT-05 / D-243-06)

---

## Axis 2 — Multi-tool

| Row | Scenario | Recognisable failure | Result |
|---|---|---|---|
| **M-1** | One prompt exercising 2+ tools (`search_documents` + `execute_code`). | The thinking block does not sit above **multiple** tool rows, or a tool row is restyled / re-ordered / re-labelled. ⛨ The tool container is an **operator constraint** — any change to it is a failure of this row, not a variation. | |

---

## Axis 3 — Parallel-thread

| Row | Scenario | Recognisable failure | Result |
|---|---|---|---|
| **P-1** | Thread A streaming reasoning while Thread B accepts a new prompt. | Reasoning from A appears on B, a fold opens on the wrong message, or B's first token is delayed by A's coalescing window. ⭐ The coalescer's accumulator is per-callback-instance closure state (243-03) — this row is its lived-experience check. | |

---

## Axis 4 — Long-message

| Row | Scenario | Recognisable failure | Result |
|---|---|---|---|
| **G-1** | ≥ 50 prior messages **or** a ≥ 5 KB user prompt. | ⭐ **Criterion 3's scroll fix must be verified on a LONG thread.** The ROADMAP names *"verified once by hand and never on a thread with fifty messages"* as a failure mode, so a fresh thread does not satisfy this row. | |

---

## The G-4 "I'd recognise failure here" rows — driven in a REAL BROWSER

⚠ **G-4 fires: this phase touches user-visible UI.** These six were defined at scope time by the
operator's own recognisability test, not derived from the build. Chrome MCP or a hand-driven browser
— **wire format and screenshots alone are insufficient** (G-4's standing rule).

| # | Scenario | Recognisable failure | Requirement | Result |
|---|---|---|---|---|
| **L-1** | Watch a slow reasoning model stream. | The fold control **churns** / the line flickers per token. | CHAT-02 | |
| **L-2** | Same run: scroll up mid-tool-call and **stay there** through the rest of the call and the tokens that follow. | Dragged back down. ⚠ **On a ≥ 50-message thread**, not a fresh one. | CHAT-03 | |
| **L-3** | Ask a reasoning model a plain question that calls **no tools**. | No thinking shown at all. ⭐ 31% of reasoning-bearing rows (105 of 340, measured) are this shape. | CHAT-04 | |
| **L-4** | Start a run, navigate away, come back **without reloading**. | Final answer still folded in narration. ⚠ **The "without reloading" is the whole row** — a reload passes trivially and proves nothing. | CHAT-05 | |
| **L-5** | Open the fold on a **33,713-char** reasoning body, then on a **198-char** one. | The tail is unreadable, or the short one looks truncated / carries an inert "Show all of it". | CHAT-01 / D-243-03 | |
| **L-6** | Put the shipped surface **beside `.planning/sketches/234-the-thinking-block/index.html`**, V1 tab. | They disagree. ⚠ **The FILE is the acceptance bar, not a description of it** — sketch-to-build drift is the named failure mode and this row is the only thing that can catch it. | CHAT-01 / criterion 1 | |

### ⚠ L-6 carries ONE declared, deliberate difference

`243-04` ships a label that **differs from the mockup on purpose**: a message the client did not
watch stream reads `Thinking` where the mockup reads `Thought for 6 seconds`. **The mockup's number
is computed from character count** (`index.html:338`, `Math.round(chars / 180)`) — a demo affordance
so the sketch has a plausible label at every Scale setting — and there is no persisted source to
swap in without a migration this phase declares none of (D-243-13).

⇒ **L-6 passes with that one difference declared.** Any OTHER difference is drift.

### ⚠⚠ SECOND DECLARED DIFFERENCE — criterion 1's words *"structured timeline"* are PRE-SKETCH LANGUAGE, and the operator rejected exactly that

The ROADMAP criterion reads: *"expanding it gives a **structured timeline** rather than a flat wall."*
**That wording predates the sketch it defers to**, and the sketch settled the question the other way.

Sketch 234's record (`README.md` §*Variants*, §*WINNER*), operator 2026-09-11:

| | Verdict |
|---|---|
| first pass — *A Prose · **B Timeline** · C Always-inline* | **superseded** — *"I do not see a difference between"* them; at the median 198 chars they were three containers around one sentence |
| Stitch **V2 Segmented** (mono labels per block — `problem-framing`, `raft-semantics`) | ⛔ **REJECTED** — *"The labels are ours, not the model's"*; printing the derivation is forbidden by the standing mindset rule |
| Stitch **V3 Beats** (four one-line bullets) | ⛔ **REJECTED** — shortest, but it *"discards the model's actual words"* |
| **V1 Thin rule** | ⭐ **WINS — it *"adds nothing and invents nothing"*: the model's own prose, made readable** |

⇒ **V1's paragraph structure IS the "structure" criterion 1 asks for** — real `<p>` elements
(`index.html:332`, `ps.map(p => <p>)`) plus the clamp, replacing today's single
`whitespace-pre-wrap font-mono` blob. **A literal timeline — per-block labels, beats, a step rail —
is an explicit operator rejection and must NOT be built.**

⛔ **A verifier scoring criterion 1 against the phrase *"structured timeline"* rather than against
`index.html` scores it wrong.** The file is the bar; the ROADMAP sentence is the question that led
to it. Carry this paragraph into `243-VERIFICATION.md` verbatim — the same treatment D-243-13 gets,
and for the same reason: **a declared difference from the bar is a decision, an undeclared one is
drift.**

---

## Rows added by this phase's plans — newly checkable, and named

| Row | Scenario | Made checkable by | Result |
|---|---|---|---|
| **N-1** | Open the fold **mid-stream** on a live reasoning run and leave it open. | 243-02 / D-243-02 — reasoning must keep arriving underneath a fold the user opened, and the fold must not close itself or re-open on its own. | |
| **N-2** | On a tool-bearing run, watch the **temp-id → DB-id reconcile** land while the fold is open. | 243-02's decided remount semantics — the fold must NOT close. `MessageList.tsx:220` keys the row `run-${runId}`, which is stable across the swap; a `key` added to the mount would break this and nothing else would notice. | |
| **N-3** | A reasoning model that emits reasoning and then calls **no** tools, on a thread that already has tool-bearing turns above it. | 243-02 — both message shapes drawn by one component; this is the pair reading as one product (sketch 235's own "Show both message shapes" question). | |
| **N-4** | Stop a run mid-reasoning. | 243-03's `.flush()` at the terminal edges — the reasoning shown must be everything that arrived, not everything-minus-one-window. | |

---

## Owed / blocked ledger

⚠ Fill this at verification. **An owed row stays visible; it is not deleted from the table above.**

| Row | Status | Reason | Who / when |
|---|---|---|---|
| | | | |

---

## ⚠ `SEED-049` — fired, and deferred by decision

`SEED-049`'s trigger names *"a chat-surface / streaming / RunCard phase"* **verbatim**, and this is
one. It is deferred **by decision, not oversight** — reviving a rotted E2E suite is a phase of its
own (D-243-09).

**Its re-open condition is concrete and this phase must answer it:** *the first criterion here that
cannot be verified without a live E2E drive.* The two candidates are **criterion 3** (scroll survives
a tool call — row **L-2**) and **criterion 5** (navigate away and back — row **L-4**).

⇒ If either cannot be honestly closed by a vitest fence plus a driven browser check, **say so in
`243-VERIFICATION.md` and re-open the seed.** ⛔ Do not close a criterion against a unit test that
cannot see it.

---

## ⚠ What this phase may CLAIM (D-243-12)

`OV-SOLO-01`: solo running continues; no independent §6.3 reviewer exists.

- The dispatched **code-review subagent is MANDATORY** (`code_review: true`, `standard`).
- **`243-VERIFICATION.md` reads "self-verified", never "reviewed."**
- Mechanical evidence — a driven fence, a byte-identical file, a measured count — is **not** weakened
  by solo running. **Judgement calls are.** Say which is which, row by row.
