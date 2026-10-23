---
phase: 290
slug: the-card-and-the-team-picture
status: verified
threats_open: 0
asvs_level: default
block_on: high
register_authored_at_plan_time: true
created: 2026-10-24
---

# Phase 290 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Register built from the four PLAN `<threat_model>` blocks (290-01 .. 290-04): 22 `T-` rows
> (T-290-01 .. T-290-18 plus one `T-290-SC` row per plan). Every `mitigate` row was verified
> against the shipped code on `develop` (HEAD `42992063b`), not against SUMMARY prose.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| Workflow definition JSONB -> client derivations | `deriveTeam` / `resolveStepLine` read author-supplied phases (types, slugs, names, validator kinds, criteria, `on_failure`, `max_parallel_agents`) | Untrusted author strings and shapes; rendered only as JSX text / attributes |
| Viewer -> someone else's published / starter definition | Team view and ⌥ ledger render a definition the viewer can already open read-only (D-07) | No new field or request leaves the server; access stays with existing endpoints + RLS |
| Builder in-memory store -> canvas Team view | Team view must not commit edits (keyboard reorder) | Phase order commits via `onCommitNodes` |

No new endpoint, request, schema, migration, auth path or package was added by the phase
(`git log 1f9673d25..HEAD -- frontend/package.json frontend/package-lock.json package.json` is empty).

---

## Threat Register

| Threat ID | Category | Component | Disposition | Mitigation / Evidence | Status |
|-----------|----------|-----------|-------------|------------------------|--------|
| T-290-01 | Tampering | teamModel.ts keyed reads | mitigate | `own()` for sentences/subtitles/labels/gate words `teamModel.ts:354-356,387`; slug->step is a `Map` `:338`; `nodeTitle` kept only when non-empty string `:199-200`; non-string `name` stripped before `nodeTitle` `:198`; `constructor` / `__proto__` raw-floor tests `teamModel.test.ts:576-597` | closed |
| T-290-02 | Denial of service | deriveTeam on hostile shapes | mitigate | `Array.isArray(phases)` `:331`, `Array.isArray(validators)` `:382`, `isRow` guards `:162,384`; `Number.isInteger` seats `:212`; derived gates only behind `hasConfig` `:419`; `seatDots = min(seats, SEAT_DOT_CAP=8)` `:124,369`; one `Map.get` per skip `:258`; `malformed` no-throw `teamModel.test.ts:580`, `batchHostile` `:552` | closed |
| T-290-03 | Tampering (integrity) | lines[] | mitigate | Only step->step line is `kind: "jump"`, pushed only when `stepNumberOf.get(parseSkipTarget(raw))` resolves `teamModel.ts:253-261,405-411`; SC#3 sweep over ALL_FIXTURES + TEAM_FIXTURES with POSITIVE CONTROL `teamModel.test.ts:93-102` | closed |
| T-290-04 | Spoofing (false assurance) | failure / absence words | mitigate | Citations check only for `groundingCauseOf === "detected"` `teamModel.ts:285`; redo-aware words, pre-timing and retries 0 skip redo `:250,271`; unknown `on_failure` -> stop (WR-01) `:266-269`; lax-int retries (WR-06) `:234-243`; tests `teamModel.test.ts:253,328,336,413,452` | closed |
| T-290-05 | Elevation (access) | teamModel.ts / teamVocabulary.ts | mitigate | teamModel imports only phaseVocabulary / ownProperty / definitionOps / teamVocabulary `teamModel.ts:36-60`; `?raw` purity fence (react, `@/lib/api`, clock, fetch) with positive controls `teamModel.test.ts:668-698`; teamVocabulary.ts has zero imports (grep) | closed |
| T-290-SC (01) | Tampering | npm installs | accept | No package installed; manifest diff since base empty | closed |
| T-290-06 | Tampering / Elevation (stored XSS) | StepChipLine.tsx | mitigate | Words rendered as JSX text (`StepChipLine.tsx:68`, no raw-HTML API in file); `./stepLine.ts` + `./StepChipLine.tsx` in `LIBRARY_SUBTREE_PATHS` `librarySubtree.fences.test.ts:124-125`, swept by "renders no raw HTML" `:324` and "reads no owner display name" `:673` | closed |
| T-290-07 | Tampering (prototype keys) | stepLine.ts lookup | mitigate | `own(PHASE_TYPE_SENTENCES, type)` `stepLine.ts:57`; `phaseGlyph` hasOwnProperty guard `lib/phaseGlyph.tsx:121`; `constructor` tests `stepLine.test.ts:125-130`, `StepChipLine.test.tsx:166-171` (no mark, raw text) | closed |
| T-290-08 | Denial of service | resolveStepLine | mitigate | `Array.isArray` `stepLine.ts:64`; non-objects filtered `:65`; one sort `:68`; collapsed line `slice(0, STEP_LINE_VISIBLE=3)` `:31,71` | closed |
| T-290-09 | Information disclosure | chip words | accept | Plan 290-02 records the rationale; see Accepted Risks AR-290-02 | closed |
| T-290-SC (02) | Tampering | npm installs | accept | No package installed | closed |
| T-290-10 | Tampering / Elevation (stored XSS) | TeamPicture.tsx | mitigate | Author text as JSX text / attributes only (`data-line-source={line.source}` `TeamPicture.tsx:451`); `?raw` fence forbids innerHTML / dangerouslySetInnerHTML / `@/lib/api` with positive controls `TeamPicture.test.tsx:540-554`; planted `<img onerror>` name and `<b>` criteria render literally `:294-306`; `./TeamPicture.tsx` in `CANVAS_SUBTREE_PATHS` `WorkflowCanvas.test.tsx:106` | closed |
| T-290-11 | Tampering (integrity) | WorkflowCanvas keyboard reorder | mitigate | `teamShown` early-return in the reorder effect `WorkflowCanvas.tsx:1156,1160,1216`; ⌥→/⌥← in Team does not call `onCommitNodes`, with Steps positive control `WorkflowCanvas.team.test.tsx:153-169`. See residual note (WR-02) below | closed |
| T-290-12 | Denial of service | line layer / seat dots | mitigate | One `<path>` per `model.lines` item `TeamPicture.tsx:443-452`; seat dots from capped `step.seatDots` `:239`; `ResizeObserver` guarded `:417`; `line-clamp-2/3` `:231,276,486`; `overflow-x-auto` plane `:424` | closed |
| T-290-13 | Information disclosure | ⌥ ledger on others' published workflow | accept | Plan 290-03 records the rationale; see AR-290-03 | closed |
| T-290-14 | Elevation (access) | switch reachability | mitigate | TeamPicture imports only react, phaseGlyph, phaseVocabulary types, teamModel, teamVocabulary `TeamPicture.tsx:30-62`; derives in-memory via `useMemo(deriveTeam(phases,...))` `:373`; `@/lib/api` fence `TeamPicture.test.tsx:542`; builder passes only a name `WorkflowBuilderPage.tsx:2163` | closed |
| T-290-SC (03) | Tampering | npm installs | accept | No package installed | closed |
| T-290-15 | Tampering (guard coverage) | count gate BASELINE | mitigate | All seven new suites pinned `scripts/vitest-count-gate.cjs:4369-4375` | closed |
| T-290-16 | Repudiation | gate verdicts | mitigate | `290-04-GATES.md` records each command (e.g. `:11`), the phase base `1f9673d25` and a throwaway base worktree `b290base` for inherited-at-base proof `:5-7,25` | closed |
| T-290-17 | Information integrity | ledger rows | mitigate | Rows with re-derived triples `(was \`0 / 0 / 0\`)` `docs/HOT-FILE-LEDGER.md:11980-11985` and sections `:23546+`; re-run 2026-10-24: `check-claude-md-size.cjs` exit 0, `check-hot-file-ledger.cjs 290` exit 0 ("ledger gate OK"); CLAUDE.md WorkflowCanvas cell reads "extraction FIRST next" | closed |
| T-290-18 | Spoofing (false assurance) | escalated-seal drift | mitigate | `.planning/reported-bugs/BUG-261021-05-escalated-step-sealed-must-prove-it-but-engine-checks-nothing.md`: `surface: Agentic-RAG`, `status: open`, concrete `re_open_trigger` (frontmatter :5,:7,:12) | closed |
| T-290-SC (04) | Tampering | package installs | accept | No package installed | closed |

*Status: open · closed*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Residual note (not an open threat) — WR-02

`290-REVIEW.md` WR-02 (deferred, re-open trigger: next phase listing `WorkflowCanvas.tsx`):
in Team view the builder's undo/redo listener and the open PhaseFormPanel stay live while the
header reads "View only". T-290-11's declared scope (the keyboard reorder effect) is mitigated;
these are the operator's own edit paths over their own in-memory definition (no cross-user or
server-side effect, autosave/RLS unchanged), so this is a UX-honesty gap rather than a tampering
vector. Recorded here so the "View only" claim's limits are on the security record.

### Unregistered flags

None. All four SUMMARY `## Threat Flags` sections report "None" and map to registered IDs.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-290-SC | T-290-SC (all four plans) | No package is installed by any 290 plan; manifest/lockfile diff since base `1f9673d25` is empty | plan author (290-01..04 threat_model) | 2026-10-21 |
| AR-290-02 | T-290-09 | Only the seven fixed type sentences or a raw unknown type render, from a definition the viewer already receives; no new field or request | plan author (290-02 threat_model) | 2026-10-21 |
| AR-290-03 | T-290-13 | The ⌥ ledger shows slugs/kinds/criteria of a definition the viewer can already open read-only in the builder (D-07); no new field or request | plan author (290-03 threat_model) | 2026-10-21 |

*Accepted risks do not resurface in future audit runs.*

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-10-24 | 22 | 22 | 0 | gsd-security-auditor (Claude, fresh context) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-10-24
