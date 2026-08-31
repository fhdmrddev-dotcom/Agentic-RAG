---
phase: 221-six-applications-one-token
plan: 01
status: complete
commits:
  - 01ee71e9a  docs(221): four hot files were invisible to their own guardrail
  - 9c0fb3b70  feat(221): an application is a rung on the ladder, not a label
  - b49a03fb5  feat(221): six applications under one connection, and the band grants nothing
gates:
  count_gate: "178/178 · total 7020 · pinned 6299 · failed 0"
  tsc: "66 (baseline 66)"
  backend_unit: "70 failed / 3282 passed (baseline 70 failed / 3261 passed)"
  claude_md_size: "104,620 chars · 69.7% · OK"
---

# 221-01 — Six applications, one token

Google Workspace is six applications under one connection. Every acceptance criterion in the
plan is met; **three guards were driven RED against planted defects and restored
md5-identical**, and one of them found a real regression I had written.

---

## The acceptance criteria, measured

| # | Criterion | Result |
|---|---|---|
| 1 | size gate clear; four new ledger rows resolve | ✅ 104,620 / 69.7%; all four anchors resolve |
| 2 | 15 descriptors carry `app`; **no** execution field leaks | ✅ `drive 2 · gmail 5 · sheets 2 · docs 1 · calendar 4 · contacts 1`, asserted over the EMITTED list |
| 3 | `app:drive: allow` → read `allow`, planted write `ask` | ✅ |
| 4 | `foo:bar` refused with a 422 | ✅ |
| 5 | six groups / one ungrouped+banded / no bands where unknown | ✅ |
| 6 | `DirectionBand` has no interactive element, **driven RED** | ✅ planted control → exactly one test failed → restored |
| 7 | `ConnectionGrantsList.tsx` **shorter** than 344 | ✅ **222** (−122) |
| 8 | zero-action connection reads **Not usable**, not Ready | ⚠ **AMENDED — see below** |
| 9 | count gate OK · tsc ≤ 66 · backend ≤ 70 failed | ✅ all three |

---

## ⚠ The finding that matters: my own rule was wrong, and the pins caught it

**Criterion 8 shipped narrower than D-221-12 as written, on purpose.**

The first cut did exactly what the decision said — *"a connection with no usable actions is Not
usable"* — applied to every connection shape. **Nine tests went red, and they were right.**

1. **Three byte-for-byte row pins** (`SEND_EMAIL`, `POST_MESSAGE`, `CREATE_TICKET`) showed
   working SMTP, Slack and Jira connections flipping to `⚠ Not usable`. **`discovered_tools` is
   a presentation cache** — a capability row's actions come from `SERVICE_TOOL_SPECS` and the
   executor never reads that column. An empty column there says nothing about whether the
   connection works. **I would have shipped a change that called three working connections
   broken**, on a surface whose entire purpose this phase is to make honest.

2. **Phase 206.1's AR-03** — *"an EMPTY discovery is NOT evidence — absence read as success is
   the old defect"* — is the mirror image of the bug I was fixing. A row nobody has discovered
   looks identical to a row discovered and found barren. Asserting the second is **the same
   error as claiming `Ready`, pointed the other way.**

**The shipped rule:** the zero-action check is scoped to the `oauth_byo` arm — the one that
produced the lie — and splits on `discoveryHasRun` (`last_check_verdict === "ok"`):

| row | before | after |
|---|---|---|
| Microsoft 365 — oauth, active, 0 actions, never checked | `✓ Ready` ❌ | `◌ Not checked` |
| the same row once Check has run and still found nothing | `✓ Ready` ❌ | `⚠ Not usable` |
| SMTP / Slack / Jira — capability rows, empty cache | `✓ Ready` | `✓ Ready` (untouched) |
| MCP row, empty discovery | `◌ Not checked` | `◌ Not checked` (AR-03 holds) |

The operator's reported defect — *"Ready is a lie there"* — is closed either way. What changed
is that the replacement word no longer asserts a fact nobody measured.

⚠ **This is a deviation from D-221-12's literal wording and is flagged for the operator's
call.** If they want `⚠ Not usable` on an undiscovered OAuth row regardless, that is one
`discoveryHasRun: true` and a re-derivation of the three pins.

---

## The other two RED drives

- **D-221-06 (backend).** Disabling the write cap failed exactly
  `test_application_allow_does_not_reach_a_write` and nothing else; restored md5
  `760010a748a5e93afbe730069b71ea31`, 21 passing.
- **D-221-03 (frontend).** A planted `Needs approval` control in the band failed exactly the
  contract test; restored md5 `08ca3d18e515649d824eb7ac3990d247`, 16 passing.

---

## Two things found that nobody was looking for

**1. `connectionMark`'s brand-import fence rotted exactly as its own comment predicted.** The
comment read: *"a bare count rots on every service added, which is this repo's most-repeated
defect… so the count is asserted against the map it tracks rather than against a literal."* It
had never actually been changed to do that — it went `3` → `11` → `12`, and this phase's three
Google marks made it `expected 15 to be 12`. **The literal is gone.** The property the test
always *named* — *"one home, not per-component"* — is now asserted for real: a `import.meta.glob`
scan proving no other source file imports `~icons/logos/`. It **cannot rot** (adding a mark to
that module does not change it) and it was driven RED, naming the offending file by path.

⚠ Its BASELINE pin was **39 against an actual 74** — the file could have lost half its
assertions with the gate reporting OK. Re-baselined to 75; **36 of that is drift the stale pin
was hiding, not this phase's work.**

**2. `ConnectionFormPanel.oauth.test.tsx` was in NEITHER gate knob.** Shipped since Phase 215;
the gate never ran it and nothing guarded its count. That is the **sixth** suite found in this
state inside a week (three chat suites on 2026-08-31, one RED for hours unseen). The cause is
structural: the `src/components/settings/` entries in TARGETS are FILE-LEVEL by deliberate
choice, so every new file under that directory is invisible until somebody types its name.
Now in both knobs at 8.

⚠ **Five more unpinned suites are visible in the gate's own output and NOT addressed here**
(out of this phase's fence): `PromptVariableChips.test.tsx` (3), `RunHero.test.tsx` (18),
`automationFacts.test.ts` (11), `nodeEffectBanner.test.ts` (8), `toolReadOnlyMap.test.ts` (7).
The operator's open item #8 asked for a sweep; this is that sweep's result for the settings
surface, and those five are the remainder. → **`SEED-229`**.

---

## Deviations from the sketch, each with its reason

| Decision | As approved | As built | Why |
|---|---|---|---|
| **D-221-08** marks | six distinct product marks | **three** real + three Google glyph | Sheets/Docs/Contacts are absent from all three installed icon packs (measured). The plug means *"a service this map has never heard of"* and Sheets is not that; a monogram tile would need six hand-authored components, which the icon convention forbids — provider marks are single-source from the packs. Re-open trigger recorded in the map. |
| **Bands on Google** | sketch draws Drive with a reads band | **no bands on Google today** | Every Google application is currently reads-only, so a lone *Only reads* heading over all six groups is six labels saying the same thing — the noise the 2026-08-31 audit deleted. Bands appear when they start carrying information, i.e. when writes land. |
| **D-221-12** wording | *"no usable actions → Not usable"* | scoped to the oauth arm | See the finding above. |

---

## Gate reconciliation — no residual

| | baseline | close | delta |
|---|---|---|---|
| pinned files | 174 | **178** | +4 |
| pinned total | 6204 | **6299** | +95 = `21+16+14+8` new pins, `+36` connectionMark re-baseline |
| grand total | 6960 | **7020** | +60 = 51 new cases, +1 fence case, +8 newly-RUN oauth suite |

Both columns reconcile exactly. Backend: `70 failed / 3282 passed` — 70 is baseline unchanged,
`+21` passed are this plan's.

---

## G-5 disposition — discharged as planned

`ConnectionGrantsList.tsx` **344 → 222 L**. It keeps the default-posture card, the search box
and the composition; it owns no row markup. The seam was taken by construction rather than
deferred, and the criterion was falsifiable rather than asserted.

⚠ **A regression caught in the extraction:** the move dropped Phase 213's single
`grants-unknown-direction-help` line, and `ConnectionGrantsList.test.tsx` caught it **because
that test asserts a COUNT rather than a presence.** Restored, still derived from `tools` and not
`filteredTools`, so it cannot flicker while someone searches.

---

## What is owed

- ⛔ **G-4 UAT is BLOCKING at close and cannot run yet.** It needs Google connected in org
  `22f9c615` as `fhdmrd@gmail.com`; the signed-in account is a `member` there and
  `require_org_manage` refuses it. **Recorded as owed, not as passed.**
- **Plan 02** — the availability line. `blockedApplicationCount` is the constant `0` until it
  lands, so `partly` is currently unreachable by construction.
- **Nine pre-existing unresolved ledger anchors** in CLAUDE.md (two are named-only by an
  explicit Phase 196 decision; the rest are drift). Out of this phase's fence.
- **`SEED-228`** — `read_doc` on a `.docx` id returns a bare `HTTP 400 FAILED_PRECONDITION`.
- **`SEED-229`** — the five remaining unpinned suites named above.
