# Sketch 200 — element audit: `library` · `publish` · `run-dialog` · `fork-delete`

READ-ONLY audit. No source file was modified.

**Audited against `develop` at `658cac4e`** (`merge(port): publish, run dialog and the fork/delete ladder, from sketch 200`).

⚠ **The tree moved under this audit.** `RunModal.tsx`, `PublishGauntlet.tsx`, `ForkNameDialog.tsx`,
`WorkflowDeleteSheet.tsx` and `WorkflowSoul.tsx` were all rewritten at **03:15:45**, mid-pass, by the
`658cac4e` merge. Every row below for those files is a **re-read after that landing**, not a
pre-merge reading. The library files (`WorkflowCard.tsx`, `LibraryToolbar.tsx`, `WorkflowsPage.tsx`)
are from `14b8897d` @02:28 and were read after it. Anyone re-running this audit against a later HEAD
should treat the SHIPS counts as a floor, not a ceiling.

Derived from the four sheets only. `200-CHECKLIST.md` and `index.html`'s `JOURNEY` array were not opened.

---

## `library.html`

| Sheet element | Bucket | Evidence |
|---|---|---|
| Left rail — app mark | SHIPS | `frontend/src/components/layout/NavPanel.tsx:134` (`<Sparkles>` logo tile) |
| Left rail — expand/collapse (`menu_open`) | SHIPS | `frontend/src/components/layout/NavPanel.tsx:140` — `aria-label` flips Expand⇄Collapse |
| Left rail — New Chat (`add_comment`) | SHIPS | `frontend/src/components/layout/NavPanel.tsx:45,148` — the rail's `+`, reachable from every view |
| Left rail — Chat | SHIPS | `frontend/src/lib/nav-items.ts:31` |
| Left rail — Workflows (ACTIVE state) | SHIPS | `frontend/src/lib/nav-items.ts:36` (`feature: "workflow_authoring"`) |
| Left rail — Documents | SHIPS | `frontend/src/lib/nav-items.ts:37` |
| Left rail — Classification | SHIPS | `frontend/src/lib/nav-items.ts:41` |
| Left rail — Library Health | SHIPS | `frontend/src/lib/nav-items.ts:42` |
| Left rail — Governance | SHIPS | `frontend/src/lib/nav-items.ts:50` |
| Left rail — Skills | SHIPS | `frontend/src/lib/nav-items.ts:54` |
| Left rail — Settings | SHIPS | `frontend/src/lib/nav-items.ts:58` |
| Left rail — Account | SHIPS | `frontend/src/components/layout/ProfileMenu.tsx:81` (`aria-label="Account menu"`) |
| `Workflows` page title (24px/600) | SHIPS | `frontend/src/pages/WorkflowsPage.tsx:903` |
| Subtitle `Repeatable, locked automations — author, publish, and run.` | SHIPS | `frontend/src/pages/WorkflowsPage.tsx:906`. ⚠ **Documented refusal of the sheet's tail:** ships as `…and Run into a thread.`; the docblock at `:894-900` states the sheet's wording would delete a true product fact. Element + register identical. |
| `+ Build a workflow` primary button | SHIPS | `frontend/src/components/workflows/library/LibraryToolbar.tsx:104` (`CREATE_LABEL`), rendered `:312` |
| Search field, placeholder `Search by name or purpose` | SHIPS | `frontend/src/components/workflows/library/libraryVocabulary.ts:168`; rendered `LibraryToolbar.tsx:340` |
| `search` glyph inside the field | SHIPS | `frontend/src/components/workflows/library/LibraryToolbar.tsx:331` (`<Search`) |
| Chip `Ready to run` | SHIPS | `libraryVocabulary.ts:57`; render order `:66-73`; mapped `LibraryToolbar.tsx:357` |
| Chip `Yours` | SHIPS | `libraryVocabulary.ts:58` |
| Chip `Still building` | SHIPS | `libraryVocabulary.ts:59` |
| Chip `Starters` | SHIPS | `libraryVocabulary.ts:60` |
| Chip `Makes a file` | SHIPS | `libraryVocabulary.ts:61` (selects on `soulDeliverable` — `libraryFilter.ts:19`) |
| Chip `Strict` | SHIPS | `libraryVocabulary.ts:62` → `frontend/src/components/workflows/deriveTier.ts:61` |
| Per-chip mono count (`31`, `108`, `80`, `3`, `81`, `77`) | SHIPS | `LibraryToolbar.tsx:373-385` (`data-testid="library-chip-count-*"`; the 200-port note at `:374` sets mono + dim); supplied `WorkflowsPage.tsx:1068`. Counts run over the **full merged** feed — `grep -n LIMIT backend/app/db/workflows.py` returns only `LATERAL … LIMIT 1`, no pagination — so the numbers are library-wide, not page-scoped. |
| Pressed/active chip tone | SHIPS | `LibraryToolbar.tsx:359` (`const active = activeChips.includes(chip)`) |
| Right-aligned project `<select>` + `All projects` | SHIPS | `LibraryToolbar.tsx:128` (`PROJECT_ALL_LABEL`), `:442` (`data-testid="library-project-select"`), `:449` |
| Project options (`Project Alpha` / `Project Beta`) | SHIPS | `LibraryToolbar.tsx:451-453`, mapped over `folders` fed from `WorkflowsPage.tsx:1071`. Shipped adds a third option (`UNBOUND`) the sheet does not draw. |
| Two-column card grid, max 1200px | SHIPS | `WorkflowsPage.tsx:1095` — `mx-auto grid max-w-[1200px] gap-4 md:grid-cols-2` |
| Card — 3px left colour gutter | SHIPS | `WorkflowCard.tsx:394` (`GUTTER_CLASSES`, `w-[3px]`), toned `:1064` from `GUTTER_TONE` (`:640`) |
| Card — workflow name | SHIPS | `WorkflowCard.tsx:1085` (`face.lead`) |
| Card — leading mark glyph | SHIPS (extra) | `WorkflowCard.tsx:1084` (`data-testid="row-mark"`) — the sheet draws no mark here; shipped adds one |
| Card — dim mono version `v2.4` | SHIPS | `WorkflowCard.tsx:1086`; composed `cardFace.ts:200` with `VERSION_PREFIX`. ⚠ Published rows read `definition.version` because `PublishedRow` carries **no** version column (`backend/app/api/workflows.py:259-269`); drafts read the column (`:407`). Documented at `libraryRow.ts:68-72`; never faked to 1. |
| Card — `⋯` overflow trigger | SHIPS | `WorkflowCard.tsx:1239` (`aria-label="Workflow actions"`) |
| Card — status dot (colour-keyed) | SHIPS | `WorkflowCard.tsx:1114` (`data-testid="row-answer-dot"`, `data-run={gutter}`) |
| Card — `Worked 2 days ago` | SHIPS | `libraryVocabulary.ts:425` (`RUN_WORKED`) + `runFacts.ts:161,240-242` (`completed → worked`; word plus relative time) |
| Card — `Failed 4 days ago` | SHIPS | `libraryVocabulary.ts:428` (`RUN_FAILED`) |
| Card — `Stopped 3 days ago` | SHIPS | `libraryVocabulary.ts:437` (`RUN_STOPPED`; `cancelled → stopped`, `runFacts.ts:163`) |
| Card — `Never run` | SHIPS | `libraryVocabulary.ts:465`; gated on `hasAnyRun === false` (`runFacts.ts:228`) so it cannot claim "never" about somebody else's run |
| Card — `person` glyph + `Run by someone else` | SHIPS | word `libraryVocabulary.ts:496`; glyph `WorkflowCard.tsx:1111` (`<User data-testid="row-answer-glyph">`); wire field `has_any_run` at `backend/app/api/workflows.py:269,409` |
| Card — `Still building` state word | SHIPS | `libraryVocabulary.ts:304` (`STATE_DRAFT`), painted as `face.state` on the answer line (`WorkflowCard.tsx:1131`) |
| Card — `build` glyph leading the draft status line | **FE-WIRING** | The leading-mark switch has exactly **three** arms, all keyed on `gutter` (`WorkflowCard.tsx:1110-1121`): `not-by-you` → `<User>`, `unknown` → `null`, else the dot. A draft resolves to a dot, never a glyph. `face.mark` / `face.state` already carry the draft key on the same line (`:1131`) and nothing consumes them for a mark. `grep -n "Wrench\|Hammer\|Construction" WorkflowCard.tsx` → **0**. |
| Card — draft card dimmed (`opacity-80`) | **FE-WIRING** | `runnable` is already resolved on the card at `WorkflowCard.tsx:879`; the root class string is unconditional (`:377`, `CARD_CLASSES`). `grep -c "opacity-" WorkflowCard.tsx` → **2**, both on delete-confirm buttons (`:1434`, `:1444`); none on the card root. |
| Card — identity line, 11px uppercase letter-spaced | SHIPS | `WorkflowCard.tsx:442` (`IDENTITY_CLASSES` — `uppercase … tracking-wider`), node `:1157` (`data-testid="row-identity"`) |
| Card — `YOURS` / `SHARED` lead word | SHIPS | `rowIdentity.ts:503` (`CHIP_PREDICATES.yours`), toned `WorkflowCard.tsx:468-469` |
| Card — `•` separator on the identity line | SHIPS | `WorkflowCard.tsx:480` (`IDENTITY_SEPARATOR`, U+2022 per the 200-port note) |
| Card — project segment (`Main` / `Analytics` / …) | SHIPS | Renders as an adjacent chip in the same 11px uppercase register rather than inline in the run: `WorkflowCard.tsx:1187-1192`, fed `WorkflowsPage.tsx:1101` (`folderName(row.def?.project_folder_id)`). The port note at `:1180-1186` records the deliberate non-merge (the suite pins this column by child index). |
| Card — `42 share this name` | SHIPS (conditional) | `libraryVocabulary.ts:560` (``return `${n} share this name` ``); resolved `rowIdentity.ts:506` — `ofN` is non-null **only on a colliding name**, counted over the full merged library. The sheet draws it on all six cards; shipped shows it only where it is true. |
| Card — `changed last month` | SHIPS | `rowIdentity.ts:507` → `relativeChanged(row.updatedAt, now)`; `null` when the wire did not say — never fabricated |
| Card — footer hairline rule | SHIPS | `WorkflowCard.tsx:420` (`FOOTER_CLASSES`; full border tone per the 200-port note at `:407-418`) |
| Card — `▶ Run` text verb | SHIPS | `WorkflowCard.tsx:1394` (`data-testid="published-run"`); bare icon+word styling `:499-501` (`PRIMARY_CLASSES`) |
| Card — `Open` text verb (draft) | SHIPS | `WorkflowCard.tsx:326` (`OPEN_LABEL`), rendered `:1413` |

**SHIPS 44 · FE-WIRING 2 · BE-NEEDED 0 · NEW 0**
The library sheet is essentially fully ported. Both open items are presentation-only arms on nodes
that already render, each with the deciding key resolved one line away.

---

## `publish.html`

| Sheet element | Bucket | Evidence |
|---|---|---|
| Left rail (all 12 items) | SHIPS | Same evidence as the `library.html` section — `lib/nav-items.ts:31-58`, `NavPanel.tsx:134,140,148`, `ProfileMenu.tsx:81` |
| Dimmed + blurred builder behind the modal | SHIPS | `PublishGauntlet.tsx` `{open && …}` block — `fixed inset-0 … bg-black/60 backdrop-blur-sm`, over `WorkflowBuilderPage` |
| Modal container (680px, bordered) | SHIPS | Same block — `max-h-[85vh] w-full max-w-2xl … rounded-lg border border-border bg-card` |
| Backdrop click-to-dismiss | SHIPS | Same block — dedicated `tabIndex={-1}` button, `aria-label="Close dialog"`, `onMouseDown={requestClose}` |
| Hero requirement sentence (17px) | SHIPS | `WorkflowSoul.tsx` `soul-purpose` at `pub` scale (`PURPOSE_CLASS.pub = "text-xl font-semibold leading-tight"`); source `definition.business_requirement`. Honest empty state: `draft · purpose not declared yet`. |
| Quiet line `Needs a starting instruction.` | **FE-WIRING** | Node ships (`WorkflowSoul.tsx`, `data-testid="soul-needs"`) but renders the **raw key** — `needs kickoff_prompt`. `entryInputKeys` (`soulData.ts:148-155`) returns `def.input_keys` (raw strings) or `def.inputs[].key`. ⚠ **The human label IS on the wire and the frontend read-shape throws it away:** `InputFieldSpec` carries `label: str` at `backend/app/models/harness.py:504`, reaching the client inside `WorkflowDefinition.inputs` (`harness.py:532`), while `frontend/src/components/workflows/soulData.ts:72` declares `inputs?: Array<{ key?: string }>` — `label` is not in the read-shape. See the BE-NEEDED note for the one subset this does not cover. |
| `SEARCH` / `REASON` / `EMIT` step glyphs | SHIPS | `PhaseSpine.tsx:86-89` — one dot per phase, glyph from `PHASE_GLYPHS` (`soulData.ts`); `pub` sizing `h-9 w-9 text-[18px]` (`:33`) |
| `SEARCH` / `REASON` / `EMIT` uppercase type WORDS | **FE-WIRING** | `PhaseSpine.tsx:92` renders `p.name` — the **author's** phase name, truncated — not a type word. The type is read one line above at `:59` (`p.config?.phase_type`), and a type→word vocabulary already ships: `phaseVocabulary.ts:211` (`PHASE_TYPE_SENTENCES`) and `:246` (`PHASE_TYPE_LABELS`). `grep -n "phaseVocabulary" PhaseSpine.tsx` → **0** — nothing imports it here. ⚠ Neither shipped map yields the sheet's exact words; the nearest are `Server step` / `AI agent step` / `Deliverable`. |
| Separator between step words | SHIPS | `PhaseSpine.tsx:66-68` renders `·`; the sheet draws `|`. Same node, different glyph. |
| Compact bordered band holding steps + tier + output | SHIPS | `WorkflowSoul.tsx`, `pub`-only branch — `rounded border-y border-border bg-background/60 px-3 py-2`, spine left, tier + output pushed right. Landed with `658cac4e`; `card` and `run` scales keep the stacked shape byte-for-byte (the `WorkflowDoorSwitch.baseline` pin). |
| `STRICT` chip | SHIPS | `WorkflowSoul.tsx` `TierChip` (`data-testid="soul-tier"`, `data-tier`), words `deriveTier.ts:61`; glyph + WORD, never colour alone |
| `Produces: an answer in chat` | SHIPS | `WorkflowSoul.tsx` `OutputLine` → `produces: answer in chat`; derivation `soulData.ts:157-163` (terminal `llm_emit` → file, absent → chat) |
| Gauntlet stage `Owner` | SHIPS | `PublishGauntlet.tsx:170` |
| Gauntlet stage `Valid` | SHIPS | `PublishGauntlet.tsx:171` |
| Gauntlet stage `Goal` | SHIPS | `PublishGauntlet.tsx:172` |
| Gauntlet stage `Structure` | SHIPS | `PublishGauntlet.tsx:173` |
| Gauntlet stage `Pause` | SHIPS | `PublishGauntlet.tsx:174` |
| Gauntlet stage `Grounding` | SHIPS | `PublishGauntlet.tsx:175` |
| Gauntlet stage `Golden Run` | SHIPS | `PublishGauntlet.tsx:176` (`Golden run`) |
| Gauntlet stage `Citations` | SHIPS | `PublishGauntlet.tsx:177` |
| Gauntlet stage `Judge` | SHIPS | `PublishGauntlet.tsx:178`. ⚠ Shipped carries a **tenth** stage the sheet omits — `Commit` (`:179`, `draft_changed`) — so a build that copies the sheet's nine would delete a real check. |
| Connecting line between stages | SHIPS | `PublishGauntlet.tsx:483-487` (`data-testid="spine-conn"`; green once reached) |
| Green ring + ✓ badge per passed stage | SHIPS | `PublishGauntlet.tsx:459-462` (`border-success/50 bg-success/10`) and `:494-500` (the `✓` corner badge) |
| Explanation paragraph (`…a real trial run… an independent review… It can honestly refuse.`) | SHIPS | `PublishGauntlet.tsx:750-751` — verbatim |
| Label `A typical instruction to test with` | SHIPS | `PublishGauntlet.tsx:764` — verbatim. The wire key `golden_input` is demoted to a hover-titled mono tag beside it (`:766-771`), not dropped. |
| Textarea + placeholder `Choose something typical, not a corner case — this is what gets graded.` | SHIPS | `PublishGauntlet.tsx:778` — verbatim |
| Footer bar (raised, bordered, right-aligned) | SHIPS | `PublishGauntlet.tsx:791` — `-mx-4 -mb-4 … border-t border-border bg-muted/30` |
| `Cancel` button | SHIPS | `PublishGauntlet.tsx:807-813` (`data-testid="publish-cancel"`); routed through the same `requestClose` as ✕ and backdrop, so it is blocked mid-publish |
| `Publish — run the checks` button | SHIPS | `PublishGauntlet.tsx:821` — verbatim |
| Modal title bar `◆ Publish this workflow` + ✕ (not drawn on the sheet) | SHIPS (extra) | `PublishGauntlet.tsx` `{open && …}` block. The sheet leads straight with the hero and draws no title bar; recorded so a sheet-faithful rebuild does not delete the only visible dismiss on touch. |

**SHIPS 28 · FE-WIRING 2 · BE-NEEDED 0 · NEW 0**
The gauntlet, its stage set, both footer controls and every string in the resting form landed in
`ccf6512f` / `658cac4e`. What remains is two word-level reads inside the soul.

---

## `run-dialog.html`

| Sheet element | Bucket | Evidence |
|---|---|---|
| Left rail (all 12 items) | SHIPS | As above — `lib/nav-items.ts:31-58` |
| Dimmed library behind the modal | SHIPS | `RunModal.tsx:271` — `fixed inset-0 … bg-black/60 backdrop-blur-sm`; mounted over `WorkflowsPage` (`WorkflowsPage.tsx:1183-1192`) |
| Backdrop `Workflows` heading + search box | SHIPS | `WorkflowsPage.tsx:903`; search `LibraryToolbar.tsx:331,340` |
| Backdrop drawn as an **80px row list** (icon tile · name · `Last updated 2 days ago` · right-aligned status word) | **NEW** | The library renders a two-column **card grid** (`WorkflowsPage.tsx:1095`), not a row list; no list/compact variant exists — `grep -n "<li\|role=\"list\"" WorkflowCard.tsx` → **0**, and the per-row icon tile and right-aligned `Template-Test` / `Active` words have no shipped counterpart. ⚠ Almost certainly the sheet author's shorthand for *"the library, dimmed"* rather than a request — do not build a list view off this sheet. |
| Modal container (560px) | SHIPS | `RunModal.tsx:273` — `w-[min(560px,92%)]` |
| Header title = workflow name, 17px, truncating | SHIPS | `RunModal.tsx:312`. ⚠ The sheet's `Quarterly Business Review — Northwind Logistics` is one author-typed **name**, not name + project — stated in the port docblock at `:299-301`, which is exactly why the shipped header truncates at 17px. No separate project element is owed. |
| Header ✕ close | SHIPS | `RunModal.tsx:314-322` (`data-testid="run-modal-close"`, `aria-label="Close"`, `onClick={onCancel}`) — landed in `0827e21b`; it is now the first focusable in the trap |
| Label `Knowledge base` | SHIPS | `RunModal.tsx:337` — no colon, matching the sheet |
| Knowledge-base `<select>` | SHIPS | `RunModal.tsx` `data-testid="run-scope-select"`. ⚠ Gated on `folders.length > 0` — a user with no folders sees no control at all (matches `ChatArea`'s guard). |
| Option `Workflow default — Template-Test` | SHIPS | Same `<select>` — `Workflow default — 📁 {authorDefaultName}` when the author folder is visible; bare `Workflow default` when it is not, never a whole-KB lie |
| Option `General Knowledge Base` | SHIPS | Same `<select>` — renders `All documents` for an unbound workflow; the sheet's second option maps to the folder options from `overrideOptions` |
| Label `What should this run work on?` | SHIPS | `RunModal.tsx:374` — verbatim |
| Kickoff textarea + placeholder | SHIPS (copy delta) | `RunModal.tsx:381` — ships as `Describe the task for this run…`; sheet draws `Provide initial instructions or context for this workflow run...` |
| ⓘ glyph on each info line | SHIPS | `RunModal.tsx:523` and `:540` (`<Info className="mt-0.5 h-4 w-4 flex-none">`); the two-line `gap-2` info group is at `:520` |
| Info line 1 — `This workflow needs a starting instruction.` | **FE-WIRING** | ⚠ **Documented refusal at `RunModal.tsx:514-519`:** *"There is no authored per-key label anywhere on the wire"* — so it ships as `This workflow expects: {keys}` (`:522-529`). **That claim is refuted by the wire:** `InputFieldSpec.label: str` exists at `backend/app/models/harness.py:504` and travels in `WorkflowDefinition.inputs` (`:532`); the frontend read-shape `soulData.ts:72` (`Array<{ key?: string }>`) drops it before `entryInputKeys` (`soulData.ts:148-155`) ever sees it. Widening that read-shape covers every definition that authors `inputs[]`. |
| Info line 2 — `Run opens this workflow's run surface. The chat thread is still created, and stays reachable from there.` | SHIPS | `RunModal.tsx:541-547` — verbatim, gated on the same `canvasEnabled` flag `doRun` reads, so the sentence cannot drift from the behaviour |
| Footer bar (raised, `justify-end`) | SHIPS | `RunModal.tsx:558` — `border-t border-border bg-muted/30 px-6 py-3` |
| `Cancel` | SHIPS | `RunModal.tsx:565` |
| `Run workflow` | SHIPS | `RunModal.tsx:581` — ships as `▶ Run workflow`; stays enabled on empty input, disabled only while a launch is in flight |
| Template-upload control + `Stored untrusted — never run as code…` (not drawn on the sheet) | SHIPS (extra) | `RunModal.tsx:387-497`. Recorded so a sheet-faithful rebuild does not delete it. |

**SHIPS 18 · FE-WIRING 1 · BE-NEEDED 0 · NEW 1**

---

## `fork-delete.html`

| Sheet element | Bucket | Evidence |
|---|---|---|
| Page h1 `Two dialogs, deliberately unequal` | NEW (sheet didactic) | `grep -rn "deliberately unequal" frontend/src` → **0**. Explanatory sheet chrome, not a product surface — not recommended to build. |
| Subtitle `A harmless action asks lightly. A permanent one asks heavily. The difference is the design.` | NEW (sheet didactic) | `grep → 0`. Sheet chrome. |
| `SECTION 1 · MAKING A COPY (a harmless action, asked lightly)` | NEW (sheet didactic) | `grep → 0`. Sheet chrome. |
| `SECTION 2 · DELETING (permanent, so asked heavily)` | NEW (sheet didactic) | `grep → 0`. Sheet chrome. |
| `FIELD STATES` heading + the 3 stacked field specimens | NEW (sheet didactic) | A specimen board — the product renders **one** field in one of three states, never three at once. `grep -rn "Field States" frontend/src` → **0**. |
| `SECTION 3 · WHY THEY LOOK DIFFERENT` + the 4-row rule table (`Names what it affects` / `States exact numbers first` / `Spends danger colour` / `Leaves a receipt`) | NEW (sheet didactic) | `grep -rn "Names what it affects" frontend/src` → **0**. The sheet's own argument about the two dialogs; the rules are honoured in code (see the delete rows below) but the table is not a surface. |
| Fork — heading `Name your copy` | SHIPS | `libraryVocabulary.ts:597` (`FORK_DIALOG_TITLE`), rendered `ForkNameDialog.tsx:229` |
| Fork — sub-line `You are copying Quarterly Business Review. Give your copy a name you will recognise later.` | SHIPS (copy delta) | `libraryVocabulary.ts:633-638` (`forkDialogSub`), rendered `ForkNameDialog.tsx:230-232`; shipped appends `— you can change it in the Builder.` |
| Fork — name input | SHIPS | `ForkNameDialog.tsx:242-258` — `h-10 w-full rounded-md border bg-background px-3` |
| Fork — consequence box `Opens a new private copy you can edit. The published version stays live and unchanged.` | SHIPS | String verbatim `libraryVocabulary.ts:95-96`; rendered as the sheet's **raised box** at `ForkNameDialog.tsx:283` (`rounded-md border border-border bg-muted/40 p-4`) — landed in `232f06fd` |
| Fork — `Cancel` | SHIPS | `libraryVocabulary.ts:603`, rendered `ForkNameDialog.tsx:295` |
| Fork — `Create my copy` | SHIPS | `libraryVocabulary.ts:600`, rendered `ForkNameDialog.tsx:306` |
| Fork state 1 EMPTY — `Give it a name.` | SHIPS | `libraryVocabulary.ts:608`; selected `ForkNameDialog.tsx:171` |
| Fork state 2 CLASHING — amber field border | SHIPS | `ForkNameDialog.tsx:257` — `clash ? "border-amber-500" : "border-border"`. The port note at `:193-205` records that the FIELD (not only the hint) now tints, and that amber is not danger colour. |
| Fork state 2 CLASHING — `You already have one called this. Allowed, but you will not be able to tell them apart.` | SHIPS (near-verbatim) | `libraryVocabulary.ts:623-624` — shipped uses an em-dash (`Allowed — but you will not…`). It warns and never blocks (D-20); hint tone `ForkNameDialog.tsx:272`. |
| Fork state 3 FREE — `Name available.` | SHIPS (copy delta) | `libraryVocabulary.ts:611` — ships as `No other workflow of yours has this name.`; the emerald tone was dropped in the port (`ForkNameDialog.tsx:272` now resolves muted) |
| Delete — title `Delete this workflow?` (both states) | SHIPS | `WorkflowDeleteSheet.tsx:178` |
| Delete — loading spinner glyph | SHIPS | `WorkflowDeleteSheet.tsx:208` — `<Loader2 … animate-spin>` on the preview-loading arm |
| Delete — loading line `Checking what this will remove…` | SHIPS | `WorkflowDeleteSheet.tsx:210` — verbatim; the port note at `:200-206` records that it replaced `Loading the exact counts…` because that named the mechanism |
| Delete — caption `Permanently removed` | SHIPS | `WorkflowDeleteSheet.tsx:230-232` — quiet uppercase mono. The port note at `:220-224` records that it **lost its red on purpose**, per the sheet's own §3 rule (`spends danger colour: yes, on the button only`). |
| Delete — victim raised box | SHIPS | `WorkflowDeleteSheet.tsx:233` — `rounded-md border border-border bg-muted/40 p-4` |
| Delete — victim name on its own line | SHIPS | `WorkflowDeleteSheet.tsx:234` |
| Delete — `1 version • 17 run records` | SHIPS | `WorkflowDeleteSheet.tsx:235-237` — `{preview.versions} versions · {preview.runs} run records`. Wire: `WorkflowDeletePreview` at `backend/app/api/workflows.py:1543-1552`, route `:1573` (`/{definition_id}/delete-preview`). ⚠ **No singular arm** — a one-version row renders `1 versions`, where the sheet draws `1 version`. |
| Delete — caption `Kept — not touched` | SHIPS | `WorkflowDeleteSheet.tsx:245-247` |
| Delete — kept box (transparent, bordered) | SHIPS | `WorkflowDeleteSheet.tsx:248` — `rounded-md border border-border bg-transparent p-4` |
| Delete — `17 chat threads become normal chats. Transcripts and files stay. Your knowledge base is untouched.` | SHIPS (near-verbatim) | `WorkflowDeleteSheet.tsx:249-252` — shipped joins with an em-dash (`— transcripts & files stay`) and carries an honest 0-threads arm (`No chat threads to keep.`) the sheet does not draw |
| Delete — `Keep it` | SHIPS | `WorkflowDeleteSheet.tsx:280` (and `:192` on the preview-error arm) |
| Delete — `Delete forever` (danger fill) | SHIPS | `WorkflowDeleteSheet.tsx:291`, `bg-destructive` — the only red on the surface |
| Delete — `Recorded with your name in the audit log.` | SHIPS | `WorkflowDeleteSheet.tsx:331` — shipped prefixes the `✎` write mark (the Phase 146-148 receipt vocabulary) |
| Delete — in-flight amber banner (not drawn on the sheet) | SHIPS (extra) | `WorkflowDeleteSheet.tsx:255-268` (`data-testid="delete-inflight-banner"`), rendered only when `preview.in_flight > 0` |
| Delete — Deleting… / Deleted · recorded / retry terminals (not drawn on the sheet) | SHIPS (extra) | `WorkflowDeleteSheet.tsx:295-320` |

**SHIPS 24 · FE-WIRING 0 · BE-NEEDED 0 · NEW 6**
All six NEW rows are the sheet's own explanatory chrome. Every product element on this sheet ships,
several verbatim.

---

## Combined totals — four sheets

**SHIPS 114 · FE-WIRING 5 · BE-NEEDED 0 · NEW 7**

- **The 7 NEW** are 6 pieces of `fork-delete` sheet didactic chrome plus 1 `run-dialog` backdrop
  rendition (a row-list library that is sheet shorthand, not a request). **None is a product
  capability worth building.**
- **The 5 FE-WIRING** are all presentation- or read-shape-level, on nodes that already render:
  the draft glyph, the draft dim, the phase-type words, and the needs sentence (counted once per
  sheet where it appears — publish and run-dialog, same root cause).

## BE-NEEDED — none, with one conditional

**No element on these four sheets is blocked on data absent from the wire.** Every fact the sheets
draw — versions, run outcome and recency, `has_any_run`, name-collision counts, `updated_at`, delete
victim/kept counts, in-flight runs, the gauntlet stage set, tier, deliverable — is already carried by
`PublishedRow` / `DraftRow` (`backend/app/api/workflows.py:259-269`, `:395-409`),
`WorkflowDeletePreview` (`:1543-1552`), or the `definition` JSONB.

One item is worth naming because it is a **partial** gap and a shipped comment asserts it is total:

**Human-readable input labels.** The sheets' `Needs a starting instruction.` (publish) and
`This workflow needs a starting instruction.` (run-dialog) both require a per-key human label.

- **Already on the wire — this half is FE-WIRING, not BE work.** `InputFieldSpec.label: str` at
  `backend/app/models/harness.py:504`, carried in `WorkflowDefinition.inputs` (`:532`). The frontend
  simply does not read it: `frontend/src/components/workflows/soulData.ts:72` declares
  `inputs?: Array<{ key?: string }>`.
- **Genuinely missing — the only BE gap these four sheets surface.** A definition that declares
  `PhaseSpecJSON.input_keys` (`backend/app/models/harness.py:73`, a bare `list[str]`) with **no**
  `inputs[]` block has no label anywhere, and `entryInputKeys` prefers exactly that field
  (`soulData.ts:150`). Closing it means adding a label alongside the entry phase's `input_keys` —
  the field to add is on `PhaseSpecJSON`; the routes that would carry it
  (`GET /workflows/published`, `/starters`, `/drafts`) already return the whole `definition` dict,
  so **no new endpoint is required — only the model field and its authoring path.**
- ⚠ `RunModal.tsx:514-519` states as fact that *"There is no authored per-key label anywhere on the
  wire"*. That is true only for the `input_keys`-only subset; it should not be relied on as a
  general refusal.
