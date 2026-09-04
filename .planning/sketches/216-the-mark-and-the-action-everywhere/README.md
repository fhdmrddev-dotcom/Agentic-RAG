---
sketch: 216
name: the-mark-and-the-action-everywhere
question: "Does one shared step-identity element survive five run surfaces at four sizes — and does the approval pause show what actually leaves?"
winner: null
tags: [phase-214, step-04, step-05, seed-206, run-surface, approval-pause, connection-mark, g-2]
---

# Sketch 216 — The mark and the action, everywhere

**Written 2026-08-28.** One of four G-2 acceptance bars for Phase 214. Step 1 (direction) is
`.planning/sketches/214-stitch-step-names-service-and-action/` screens `07`/`08`/`10`/`11`.

```
node drive.cjs           # 138 assertions
node drive.cjs --emit    # regenerates BUILD-CONTRACT.generated.md FROM the running sketch
```

Current state: **138 passed, 0 failed · 14 step identities · 5 surfaces · 4 sizes.**

⚠ **The operator asked for the approval pause to live here** rather than in a fifth sketch —
D-214-16 already lists it as one of the surfaces the single element must serve, so it belongs
with the others rather than beside them.

---

## Variants

| tab | what it is |
|---|---|
| **A · rich** | The mark **and** the action's real name on the spine. ⚠ Not a taste preference — **it is SC#4's wording.** |
| **B · spare** | Stitch's `11`: the mark alone. Drawn so the cost is visible rather than argued. |
| **§3 · five surfaces, one element** | `PhaseCard` (md) · chat `RunCard` (xs) · `RunSpine` (sm) · `RunStepList` (sm) · the approval pause (lg). Same markup, different `data-size`. |
| **§4 · the mark roster** | The four inks and the **named** neutral, with the reasons each ink exists. |
| **§5 · the sentence, before and after** | The measured tautology, and the failure sentinel. |

---

## 1 · ⭐ Rich wins on the criterion, not on taste — and B is what proves it

SC#4: *"a run's spine and run surfaces show the service's mark **and the action's real name**."*

Variant B's second and third rows are **the same mark and different acts** — one posted a message
to a channel, the other pinned it. On the spare spine they are one symbol twice, and the only thing
telling them apart is the author's own step name, which is exactly the thing an author may not have
written carefully.

**What B is right about, and what §3 takes from it:** the mark alone genuinely is enough at the
smallest size, where an action name would wrap or truncate to nothing. So the chat `RunCard` row
runs at `xs` and keeps both by **truncating the service and never the action** — the action is the
half that differs between two rows of the same vendor. Press *squeeze to 320px* in the toolbar to
watch it hold.

⚠ **The step's authored name and the identity line are different things and both are kept.**
*"Escalate to the on-call channel"* is what the author called it; *Post a message · Aether Slack* is
what it **is**. Phase 187's node-face ladder already ruled that the author's name wins the title and
the derived fact takes the subtitle.

---

## 2 · One element, five surfaces — D-214-16's real test

> *"Coverage should be a consequence of one component existing, not a list kept in sync."*

`drive.cjs` asserts the size is a **modifier on one selector**, never four components; that every
identity declares its size and service; that all four sizes are exercised; and that **each of the
five surfaces is present**.

⚠ **The per-surface assertion matters more than it looks.** `SEED-206`'s own warning is *"do NOT
wait for a catalog — the spine gap is live TODAY on shipped surfaces"*, and **a partial answer
leaves the seed live for the next phase to rediscover**. A single "the element renders" assertion
would pass with four of five wired.

---

## 3 · ⭐ The approval pause — a defect the phase would otherwise create

`_external_action_clause` (`grounding.py:1279-1293`) renders `config.tool_args` into *"What it will
send"*. **Under D-214-01, `tool_args` holds only the fixed values.** An `Ask at launch` or
`From an earlier step` argument is not in it — so left alone, the pause would **name the constants
and silently omit exactly the arguments that vary.** On an approval surface that is worse than
showing nothing.

The pause here is composed **after resolution**, from what will actually leave. `drive.cjs` asserts
**all three source kinds appear**, and that the pause is not fixed-only.

⚠ **All three render identically, deliberately.** Per-argument source annotation (*"you typed
this"* / *"from step 2"*) was **considered and rejected** under D-214-15 — the sentence is already
long, and the pause's question is *what leaves*, not *who chose it*. **What matters is that all
three are there.**

⭐ **D-213-14 is untouched and is now said out loud:** *"Shown here only. The record keeps what ran,
not what it said."* Shown once, in the moment, never written to the audit ledger — the receipt keeps
carrying capability, connection id, host and tool name, and never the body.

⚠ **No countdown, no timer, no progressbar** — a person's decision time is unknowable, and the
drive asserts their absence. **The decline arm is not destructive-coloured**: declining a send is a
safe, ordinary, desirable act.

---

## 4 · The measured tautology, and how it closes

Both broken lines were **driven verbatim on both shapes** at Phase 213's close (finding 1):

| shape | today | after |
|---|---|---|
| capability row | `It will run "post_message" through post_message.` | It will run **Post a message** through **Aether Slack**. |
| MCP row | `It will run "ask_question".` — **no service at all** | It will run **Ask the wiki** through **DeepWiki**. |
| service unresolvable | — | It will run **Post a message**. ⚠ **Not "Unknown service".** |

The composer fills the service slot from `config.capability` — the *same value* it puts in the tool
slot on a capability row — and an MCP row carries `capability = None`, so the clause is omitted
entirely. **The service a person needs sits on the connection row and was never read.**

D-214-14 keeps the composer **pure**: the engine already holds a pool and already reads that
connection to run the step, so it resolves the display name and hands it in **as an argument**.
⚠ **Rejected: storing the service name on the step config** — a stored copy of a derived fact goes
stale the moment the connection is renamed, and D-213-02 rejected exactly this shape for descriptors
(*computed never stored*).

---

## 5 · The mark is a reuse — do not re-map anything

`connectionMark.tsx` is *"the ONE service-to-mark map"*, with every slug verified against the
installed `@iconify-json/logos@1.2.13` rather than against any document. ⚠ **If the module must
serve a non-Settings surface, move or share it — do not fork it.**

**The ink arms are not a colour preference.** Each exists because of a measured property of the icon
body:

| ink | why |
|---|---|
| `self` | Slack's 4 drawable elements and Jira's 3 carry **their own fills** — a colour utility is inert, a fill utility flattens four brand colours into one |
| `stroke` | lucide sets `fill="none" stroke="currentColor"` as **presentation attributes**, and a CSS rule on the same element **beats** them — a fill utility here fills the outline into a solid blob |
| `fill` | ⚠ the shipped third arm, for bodies with **zero fills and no `currentColor`**: they inherit `fill: black` and go **invisible** on Deep Midnight while the slug resolves, the body is real, and every test stays green. **The import fence structurally cannot catch it** |

⚠ **SMTP takes the neutral mark, and that is a finding rather than a gap.** `logos` carries no SMTP
mark at all; its only mail-shaped names are *vendors*. Borrowing Gmail's mark for a Fastmail SMTP
connection is the ROADMAP's own named *"a logo is approximated"* failure.

⚠ **The neutral is NAMED** — never nothing, never another service's mark. That answers `SEED-206`'s
measured ClickUp hole: an unmapped service takes a mark the map **decided on**, not an absence the
render discovered.

---

## 6 · ⚠ `BUG-260826-05` — measure before fixing

D-214-18 is explicit and the bug names its own run: `e2c0db68-dc94-4864-b7bd-afd0e163f69b`. **Read
`workflow_phases.error` for that failed phase and compare it against the `run_failed` frame.**

- **Column populated** ⇒ the defect is in *what the event carries*. Fix the emitter;
  `PhaseCard.tsx:253` needs nothing.
- **Column empty too** ⇒ the defect is in the *executor's failure path*.

⚠ **Deciding before measuring is how the phase fixes the wrong half.**

⭐ **The sentinel's condition narrows; its words do not change.** It is an honesty mechanism, and
firing it when the reason *is* known trains readers to distrust it — a cost larger than the bug it
was built for. The sketch reproduces it character for character and gives it **its own quieter
treatment**, so a real adapter failure and an absent reason never look alike. `drive.cjs` asserts
both, and that exactly **one** sentinel is on screen — two would mean the condition is too wide.

---

## 7 · What this sketch does not cover

- **The argument form** → sketch 214. **Publish's refusal** → sketch 215. **The describe door** →
  sketch 217.
- ⚠ **`WorkflowRunPage` has no `WorkspacePanel` mount** — `ChatLayout.launch.test.tsx:502` asserts
  the panel mounts *only* in the chat branch, so `PendingAskCard` does not exist on
  `WorkflowRunPage`. **A library-launched run that pauses has nowhere to be answered.** This sketch
  draws the pause; it does not solve where it mounts, and a plan that ships the pause without
  answering that ships an unreachable surface — the same shape as the Phase 194 Stop-control
  finding.
- **The canvas grammar** (`SEED-199`) — out of scope by the roadmap's own fence. STEP-04 takes only
  the connector-mark half.
