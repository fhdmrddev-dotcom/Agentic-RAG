/**
 * Phase 193.1-05 Task 1 (AUTH-03 — D-01 / D-02 / D-25, threats T-193.1-05-01 / -02 / -03) —
 * THE PRE-DRAFT DESCRIBE→GENERATE CONCERN, LIFTED OFF THE BUILDER PAGE UNDER G-5.
 *
 * ⚠ **THIS FILE SPELLS NEITHER HOST MODULE'S NAME ANYWHERE, INCLUDING IN PROSE, AND THAT IS
 * DELIBERATE.** The D-24(b) cycle fence in `useTemplateFirstDraft.test.tsx` is a source
 * assertion, and the crudest possible check of it — `grep -c <host> <this file>` → **0** — is
 * one a future reader can run without knowing the regexes. A docblock that named the page
 * would make that check say `3` and the constraint would stop being checkable by eye. Same
 * property, same reason, as the D-24(a) copy fence being a RAW sweep: it is the fence working.
 * The hosts are therefore named by ROLE below, and by file:line at their PRECEDENTS, which are
 * `library/useWorkflowFork.ts:112-127` and `builderStore.ts:167-180`.
 *
 * `CLAUDE.md`'s hot-file ledger row for the host page names the fire and names the reason it
 * was not honoured last time, in the same cell:
 *
 *   > "G-5 FIRES ON THE COUNT — extraction due, and deliberately NOT taken in `260814-q5r`. …
 *   >  the next phase that adds a genuinely second concern here owes a refactor recommendation
 *   >  FIRST — and the natural seam is named rather than implied."
 *
 * Phase 193.1 adds a **pre-draft template read state machine** to that screen: hold a `File`
 * client-side, call a read route, track five reading arms, gate the CTA on a race (D-07) and
 * carry the bytes across draft→save (D-06). That is a genuinely SECOND concern arriving on the
 * named seam, so the recommendation was produced as the first option and TAKEN — in Wave 2,
 * BEFORE the feature it makes room for (D-01, the 192.1 wave order). ⚠ A G-5 waiver was
 * OFFERED AND DECLINED: `.planning/STATE.md` records **no guardrail override for Phase 193.1**,
 * and that absence is a measurement rather than an omission.
 *
 * ⚠ **THIS MODULE IS A MOVE, NOT A FEATURE. It contains no template code at all.** Everything
 * below already ran on the page, in this order, with these comments. The proof is six
 * whole-`container.innerHTML` captures of the pre-draft screen taken by `193.1-01` on the
 * UNMOVED tree at `5333518b` — where this very path answered *"does not exist in 'HEAD'"*
 * (exit 128) — which the cut had to hold green with ZERO re-capture. A characterization
 * baseline only proves something if it PREDATES the change (the 188.1 lesson).
 *
 * ── WHAT THIS HOOK OWNS, AND WHAT IT DELIBERATELY DOES NOT ──────────────────────────────
 *
 * OWNS: the describe text, the pre-draft knowledge-base choice, the CTA's enablement rule, the
 * generate call with its stamp-and-transition, and the one-shot auto-draft the loose door's
 * handoff fires.
 *
 * DOES NOT OWN — and each exclusion is a measurement rather than a taste:
 *
 *  - **The rendered draft id.** `draftId` is read at four places in the drafted view; only the
 *    RESET belongs to this concern, so the reset travels inside `onDraftStarted` and the state
 *    stays on the page.
 *  - **The seed receipt** (`showReceipt` / `receiptPhases`). It is a DRAFTED-view concern that
 *    this concern merely triggers, so it arrives as the `onDrafted` callback and its two setters
 *    never reach this file.
 *  - **The panel selection.** `selectedSlug` is the page's one selection contract, shared by two
 *    graph views; it also travels inside `onDraftStarted`.
 *
 * Every page concern arrives as a CALLBACK and none is reached for — the
 * `library/useWorkflowFork.ts:146-165` contract, and behind it
 * `hooks/useDraftPersistence.ts:472`'s posture: one args object IN, a callback OUT, so the
 * caller keeps ownership of what happens next.
 *
 * ── ⚠ D-24(b) — WHY THE DEFINITION SHAPE IS DERIVED AND NOT IMPORTED ────────────────────
 *
 * `BuilderDefinition` is declared ON THE HOST PAGE (its `:478`), so the obvious spelling of the
 * type below is `import type { BuilderDefinition } from "@/pages/…"` — which typechecks clean,
 * lints clean, and builds a live edge from this module back into the page it was cut out of.
 * Under `"moduleResolution": "bundler"` WITH `"allowImportingTsExtensions": true`
 * (`frontend/tsconfig.app.json:13-14`) the `.tsx`-suffixed spelling compiles too, so the hazard
 * has two shapes rather than one.
 *
 * `library/useWorkflowFork.ts:112-127` solved this once already, by DECLARING its seed type
 * locally rather than importing the page's. The same answer is taken here in its third form,
 * which `builderStore.ts:167-180` demonstrates: the shape is DERIVED from the store action that
 * consumes it, so it is declared in exactly one place and a second hand-copied field list
 * cannot drift from it. **Do not "tidy" this back into an import** —
 * `useTemplateFirstDraft.test.tsx` fences every import form in both suffix spellings against
 * BOTH hosts, and each fence has been observed RED against a real plant in this file.
 *
 * ── ⚠ THE SUBTREE DELTA, MEASURED — STATED RATHER THAN SMOOTHED ─────────────────────────
 *
 * Recorded HERE as well as in the SUMMARY, for 188.2's and 192.1's stated reason: a later
 * reader must not be able to mistake this growth for a regression, and the figure has to live
 * where the growth is. Same named line classifier (blank / comment / code, every line exactly
 * one of the three, JSX comment blocks counted as comment), RE-VALIDATED before any figure
 * below was trusted — run against 188.2's published known-good, the pre-cut `PhaseNodeCard.tsx`
 * at `95a4c915`, it reproduced `797 / 518 / 249 / 30` exactly.
 *
 *   PAGE      2073 → 2045   (−1.4 %)    CODE 835 → 809   (−3.1 %)
 *   SUBTREE   page + this module  2073 → 2324  (**+12.1 %**)   CODE 835 → 894  (+7.1 %)
 *
 * **COMMENT is again the dominant term — 1146 → 1328 (+182 L), which is 73 % of the +251.**
 * CODE grew just +59: the two exported interfaces, the derived definition type, the import
 * block, the hook wrapper, the callback refs and the host's two inline callbacks — the
 * irreducible cost of a seam.
 *
 * ⚠ **THIS IS THE SMALLEST GROWTH OF THE FIVE CUTS THIS PROJECT HAS DONE, and the reason is
 * structural rather than virtuous.** 188.2 measured +67.1 %, Phase 192 +126.2 %, 192.1 +52.7 %
 * and Phase 193 +124.2 %. Two of those REWROTE while they moved, and every one of them landed
 * in FIVE OR MORE destination modules, each carrying its own header, imports and props type.
 * This is a MOVE of ONE self-contained concern into ONE module, so exactly one header's worth
 * of prose was minted.
 *
 * ⚠ AND THE PAGE FELL BY 28 LINES WHILE 85 CODE LINES LANDED HERE, WHICH IS STATED RATHER THAN
 * SMOOTHED: the cut left receipt prose at each site it emptied, in this project's own recorded
 * habit. Pretending the delta is the span is how the next estimate goes wrong.
 * Re-derive: `wc -l` on the page and on this file; `git show 99a6cc14:<page> | wc -l` for the
 * before column. ⚠ THE FIGURES INCLUDE THIS DOCBLOCK — measured, written, then RE-measured,
 * and only the digits were corrected so the line count could not move again.
 *
 * ── NAMING ─────────────────────────────────────────────────────────────────────────────
 *
 * ⚠ This file NAMES NO GOVERNED DOOR WORD, in code or in prose. It is swept RAW by the
 * D-24(a) copy fence (the `SWEPT_SOURCES` list in the door shell's suite, widened to four
 * entries in this same commit under D-14), and a docblock quoting a governed word reds it —
 * which is the fence working, not the fence misfiring. Refer to the CTA by `DESCRIBE_CTA`,
 * never by its words.
 */
import { useCallback, useEffect, useRef, useState } from "react"
import { generateWorkflow, readTemplatePlaceholdersFromFile } from "@/lib/api"
import type { BuilderPhase, BuilderStore } from "./builderStore"
import type { TemplatePlaceholdersState } from "@/hooks/useTemplatePlaceholders"

/**
 * ── 193.1-07 (D-07 / D-08 / D-25) — THE PRE-DRAFT READ, AND WHY ITS UNION IS IMPORTED ──
 *
 * The five honest readings are `useTemplatePlaceholders.ts`'s, imported rather than
 * re-declared, and that is a constraint rather than a convenience. The row that renders
 * them types its `state` prop on THAT union and says why in its own docblock: *one wire
 * shape for both doors means the two surfaces cannot derive different arms from the same
 * server answer.* A second, structurally-similar union declared here would typecheck at
 * every site except the one that matters and would let the two doors drift.
 *
 * ⚠ **A MEASURED CORRECTION TO THIS PLAN, RECORDED BESIDE THE CLAIM RATHER THAN OVER IT.**
 * The plan asks for a SIXTH arm — `notWord` — derived here "so the union is the whole answer
 * and the row stays purely presentational". Measured at HEAD that premise is false: the row
 * ALREADY derives `notWord` itself, from `none` plus the held filename, gated on EMPTINESS
 * rather than on the extension alone so a deck that somehow did yield fields still renders
 * them. That derivation has one home, the row is not in this plan's `files_modified`, and a
 * sixth arm would be a value the shipped component cannot accept. So the union stays FIVE and
 * this hook supplies the row's OTHER input — the held file — instead of a second predicate.
 */
export type TemplateReadState = TemplatePlaceholdersState

/**
 * The server's answer PLUS THE SUBJECT IT ANSWERED FOR.
 *
 * ⚠ THE SUBJECT IS THE `File` OBJECT, COMPARED BY IDENTITY — never `file.name`. The analog
 * keys on an asset id, a STRING, where identity and equality coincide; here two different
 * documents can carry one name, and a name-keyed hook would show the first document's fields
 * under the second document's filename. **No shipped hook proves `File`-identity keying**, so
 * the suite asserts it directly, including the same-name / different-object case.
 *
 * Exported because Plan 08 carries a COMPLETED answer across the door handoff as a seed.
 */
export type TemplateReadAnswer = {
  file: File
  state: Extract<
    TemplateReadState,
    { kind: "fields" } | { kind: "none" } | { kind: "unavailable" }
  >
}

/**
 * The two readings the server has not authored, FROZEN AT MODULE SCOPE.
 *
 * ⚠ THIS IS LOAD-BEARING HERE FOR A REASON THE ANALOG DOES NOT HAVE. `onDraft`'s dependency
 * array gains the reading, and the one-shot auto-draft effect depends on `onDraft`'s
 * identity — so a fresh `{kind:"idle"}` object each render would re-create the callback, and
 * re-running that effect is how a one-shot becomes a loop.
 */
const READ_IDLE: TemplateReadState = { kind: "idle" }
const READ_LOADING: TemplateReadState = { kind: "loading" }

/** The shipped `usePanelReconcile.ts:84-92` double-shaped check — an abort is not a failure. */
function isAbortError(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") return true
  if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "AbortError")
    return true
  return false
}

/**
 * Read a held document's fill-in fields, once per `File` OBJECT.
 *
 * A LEAF, exported separately because BOTH describe screens need it and only one of them
 * hosts the rest of this module's concern (the other never calls `/generate` at all — its
 * CTA is a handoff). Plan 08 mounts it on the second door directly.
 *
 * @param file The held document, or `null` when none is held. `null` ⇒ `idle` and ZERO
 *             requests — which is the whole of D-08: no document ⇒ nothing to wait for ⇒ the
 *             CTA is never disabled, with no second conditional to get wrong.
 * @param seed A COMPLETED answer carried across the door handoff. It is installed only for
 *             the exact `File` it answered for, so a seed that does not match the held
 *             document is ignored rather than trusted.
 */
export function useTemplateRead(
  file: File | null,
  seed?: TemplateReadAnswer | null,
): TemplateReadState {
  // ⚠ The seed is read as an INITIAL value AND re-checked in the effect below. The handoff
  // mounts a fresh host, so the initial read is the live path; the effect's check is what
  // makes a seed arriving one render later still cost zero requests.
  const [answer, setAnswer] = useState<TemplateReadAnswer | null>(seed ?? null)
  // The effect reads the answer through a ref so it can stay keyed on `[file]` ALONE. With
  // `answer` in the key, installing an answer would re-run the effect and abort a request
  // that had already been answered — noise that reads exactly like a staleness bug.
  const answerRef = useRef<TemplateReadAnswer | null>(seed ?? null)
  const seedRef = useRef<TemplateReadAnswer | null>(seed ?? null)
  seedRef.current = seed ?? null

  const install = useCallback((next: TemplateReadAnswer) => {
    answerRef.current = next
    setAnswer(next)
  }, [])

  useEffect(() => {
    if (!file) return
    // Already answered for THIS document — nothing to ask.
    if (answerRef.current && answerRef.current.file === file) return
    // The handoff's completed read. Installing it is what keeps the reading out of `loading`
    // at the exact instant the auto-draft one-shot fires — the blind-draft race D-07 closes.
    const carried = seedRef.current
    if (carried && carried.file === file) {
      install(carried)
      return
    }

    const controller = new AbortController()
    readTemplatePlaceholdersFromFile(file, controller.signal)
      .then((res) => {
        if (controller.signal.aborted) return
        // ⚠ COMPARE POSITIVELY. `read !== "unreadable"` would wave through `undefined` from
        // an older server or a shape change; TypeScript types the field as a two-value union
        // and will NOT protect you at runtime.
        if (res.read !== "ok") {
          install({ file, state: { kind: "unavailable", reason: "unreadable" } })
          return
        }
        const fields = res.placeholders ?? []
        // NON-EMPTY BY CONTRACT: an empty read is `none`, never `fields` with `[]`. "A
        // document with no fields presented as a document with fields" is therefore not a
        // state a caller can construct.
        install(
          fields.length > 0
            ? { file, state: { kind: "fields", fields } }
            : { file, state: { kind: "none" } },
        )
      })
      .catch((err: unknown) => {
        // An abort caused by unmount or by a replaced document is silent by design.
        if (isAbortError(err)) return
        if (controller.signal.aborted) return
        install({ file, state: { kind: "unavailable", reason: "unreachable" } })
      })

    return () => controller.abort()
    // Keyed on the FILE OBJECT — the change detector. Replacing one document with another of
    // the same name is a new subject, and the previous answer must not survive it.
  }, [file, install])

  // The waiting readings are DERIVED, never stored. An answer about a different document
  // reads as `loading`, not as its own stale self.
  if (!file) return READ_IDLE
  if (!answer || answer.file !== file) return READ_LOADING
  return answer.state
}

/**
 * The definition shape the store's own `setDrafted` accepts — see the D-24(b) block above for
 * why it is derived from the action rather than imported from the page that declares it.
 */
export type TemplateFirstDefinition = Parameters<
  ReturnType<BuilderStore["getState"]>["setDrafted"]
>[0]

export interface TemplateFirstDraftArgs {
  /** The Builder's store instance. The ONLY thing this hook reaches into directly, and it
   *  reaches through actions (`setComposing` / `setDrafted` / `setErrorState`) only. */
  store: BuilderStore
  /** The store's rendered phase, read by the page through its selector and passed IN — this
   *  hook declares no second `useStore` subscription for a value the page already renders on. */
  builderPhase: BuilderPhase
  /** Phase 124 CR-01: the loose door's seeded text, or absent for a fresh build. */
  initialDescribe?: string
  /** Phase 124 CR-01: run the generate→draft flow ONCE on mount using `initialDescribe`. */
  autoDraft?: boolean
  /** Phase 187-26 (GAP A): the loose door's knowledge-base choice, made BEFORE the AI drafts. */
  initialProjectFolderId?: string
  /**
   * The OPEN/TWEAK definition's OWN binding, when the Builder booted on an existing definition.
   *
   * ⚠ Passed IN as a value rather than read off an `initial` prop, because a hook that took the
   * page's `BuilderInitial` would be importing the page's type — the D-24(b) hazard the header
   * block above exists to close. The `typeof … === "string"` narrowing below is the page's own
   * and travels verbatim: the field is `string | null | undefined` on the definition.
   */
  initialDefinitionFolderId?: string | null
  /**
   * The page's pre-flight reset, as ONE call site.
   *
   * ⚠ IT CARRIES TWO PAGE CONCERNS AND MUST STAY ONE CALLBACK. `selectedSlug` (the page's one
   * selection contract) and `draftId` (the rendered persisted id) are both reset at the instant
   * a generation starts, and they are reset TOGETHER — two callbacks would let a future author
   * wire one and forget the other, which is a silent bug rather than a typecheck error. The
   * reason each reset exists is recorded at the call site in `onDraft` below.
   */
  onDraftStarted: () => void
  /**
   * The page's DRAFTED-view handoff, as ONE call site — the seed receipt (187-15 / 187-22) is
   * raised here and its two setters never reach this file. Called EXACTLY ONCE per successful
   * generation, with the definition as it was committed to the store.
   */
  onDrafted: (definition: TemplateFirstDefinition) => void
  /**
   * 193.1-07 / Plan 08 — the document picked on the OTHER describe screen, carried across the
   * handoff. Absent for a fresh build. The precedent is `initialProjectFolderId` (187-26):
   * pre-draft state chosen on the other door that only this host can spend.
   */
  initialTemplateFile?: File | null
  /**
   * …and its ALREADY-COMPLETED reading. ⚠ SEED, DO NOT RE-READ: a re-read returns the
   * reading to `loading` at the exact instant the one-shot auto-draft fires, which is the
   * blind-draft race D-07 exists to make impossible. Installed only for the `File` it names.
   */
  initialTemplateRead?: TemplateReadAnswer | null
}

export interface TemplateFirstDraft {
  /** The describe text as a rendered value. The `<textarea>` and the starter picker both write it. */
  describe: string
  /** The describe text's writer — also the starter picker's `onChoose`. */
  setDescribe: (text: string) => void
  /** The pre-draft knowledge-base choice. `""` = none picked. */
  projectFolderId: string
  /** The picker's writer. */
  setProjectFolderId: (id: string) => void
  /** Whether the CTA is enabled: some text, not mid-composition, and no read in flight. */
  canDraft: boolean
  /** The one `/generate` call in the app. Idempotent on empty text (it returns without a call). */
  onDraft: () => Promise<void>
  /** The held document, or `null`. The row's filename comes from HERE, so the name on screen
   *  and the reading below it answer for the same object. */
  templateFile: File | null
  /** The reading, as one of five honest arms. */
  templateRead: TemplateReadState
  /** The author picked a document. */
  onPickTemplateFile: (file: File) => void
  /** The author removed it — one press undoes a mis-pick, and the reading returns to `idle`. */
  onClearTemplateFile: () => void
}

export function useTemplateFirstDraft(args: TemplateFirstDraftArgs): TemplateFirstDraft {
  const {
    store,
    builderPhase,
    initialDescribe,
    autoDraft,
    initialProjectFolderId,
    initialDefinitionFolderId,
    onDraftStarted,
    onDrafted,
    initialTemplateFile,
    initialTemplateRead,
  } = args

  const [describe, setDescribe] = useState(initialDescribe ?? "")
  // Phase 103-ux: the project (knowledge base) the generated workflow binds to.
  // Chosen at the describe step (ONE calm dropdown), passed to generate, and shown
  // by name in the draft header afterwards. When opening an existing definition,
  // seed it from that definition's own binding so the header shows the bound KB.
  // Phase 187-26 (GAP A): the loose door may now have bound one before generate ran.
  const [projectFolderId, setProjectFolderId] = useState<string>(
    typeof initialDefinitionFolderId === "string" ? initialDefinitionFolderId : (initialProjectFolderId ?? ""),
  )

  // 193.1-07 (D-06 / D-07) — the held document and its reading.
  const [templateFile, setTemplateFile] = useState<File | null>(initialTemplateFile ?? null)
  const templateRead = useTemplateRead(templateFile, initialTemplateRead)

  // ⚠ ONE `&&` TERM, AND D-08 IS WHY THERE IS NO SECOND ONE. The reading is `idle` — never
  // `loading` — whenever no document is held, so the absence of a read IS the absence of a
  // gate. A `templateFile !== null &&` guard would be a second conditional that can be got
  // wrong, and it would read green against every behaviour the suite drives. The suite fences
  // this expression's SHAPE for exactly that reason, not only its outcome.
  const canDraft =
    describe.trim().length > 0 && builderPhase !== "composing" && templateRead.kind !== "loading"

  // ⚠ THE CALLBACKS ARE READ THROUGH REFS, and the reason is a measurement rather than a
  // style: `onDraft`'s dependency list on the page was `[describe, projectFolderId, store]`,
  // and the auto-draft effect below depends on `onDraft`'s identity. A page-supplied inline
  // callback is a NEW function every render, so putting it in the dependency list would
  // re-create `onDraft` on every render and re-run that effect — turning a one-shot into a
  // loop for callers who do not memoise. The refs keep the shipped identity contract EXACTLY
  // as it was, which is what makes this a move rather than a behaviour change.
  const onDraftStartedRef = useRef(onDraftStarted)
  const onDraftedRef = useRef(onDrafted)
  useEffect(() => {
    onDraftStartedRef.current = onDraftStarted
    onDraftedRef.current = onDrafted
  })

  // The two writers of the held document. Stable identities, so the row does not re-render
  // on every keystroke in the describe box.
  const onPickTemplateFile = useCallback((file: File) => setTemplateFile(file), [])
  const onClearTemplateFile = useCallback(() => setTemplateFile(null), [])

  const onDraft = useCallback(async () => {
    const text = describe.trim()
    if (text.length === 0) return
    store.getState().setComposing()
    // The page's one selection contract is released, and — 186-07 — only the RENDERED draft
    // id resets. The write loop's own mirror needs none: this callback is reachable only from
    // the describe screen, which a session can be on only before any row exists (a save
    // requires the drafted view, and the sole way back is a generate failure, which creates
    // nothing).
    onDraftStartedRef.current()
    try {
      const result = await generateWorkflow({
        describe: text,
        // Phase 103-ux: bind the generated workflow to the chosen project (KB). The
        // backend GenerateRequest accepts project_folder_id; omit when none picked.
        ...(projectFolderId ? { project_folder_id: projectFolderId } : {}),
      })
      if (result.ok) {
        // SINGLE STATE TRANSITION: commit the complete definition + "drafted" in
        // ONE store set. The graph renders whole, in one DOM batch (no timed reveal).
        // Stamp the chosen project_folder_id onto the definition if the generator
        // didn't already bind one (so the draft + later publish carry the binding).
        const def = result.definition as unknown as TemplateFirstDefinition
        if (projectFolderId && !def.project_folder_id) def.project_folder_id = projectFolderId
        store.getState().setDrafted(def)
        // 187-15 / 187-22 — raised beside the SINGLE transition, so the receipt lands in the
        // SAME DOM batch as the graph, and REPLACED per generation rather than frozen for the
        // session (D-187-09). `autoDraft` funnels through here too, deliberately (D-187-14).
        // The two receipt states themselves stay on the page — see the header block.
        onDraftedRef.current(def)
      } else {
        // ok:false is an HONEST failure — never a renderable broken draft.
        store.getState().setErrorState(result.error, result.detail)
      }
    } catch (e) {
      store.getState().setErrorState(
        "Couldn't generate the workflow.",
        e instanceof Error ? e.message : undefined,
      )
    }
  }, [describe, projectFolderId, store])

  // Phase 124 CR-01 fix: when handed off from the loose door's `DESCRIBE_CTA` button
  // (autoDraft), run the EXISTING generate→draft flow ONCE with the seeded text — so the fast
  // path actually drafts instead of dead-ending on an empty describe screen. Guarded to fire
  // exactly once, fresh-build ("empty") only.
  const autoDraftFiredRef = useRef(false)
  useEffect(() => {
    if (
      autoDraft &&
      !autoDraftFiredRef.current &&
      (initialDescribe ?? "").trim().length > 0 &&
      builderPhase === "empty" &&
      // 193.1-07 (D-07) — THE SAME REFUSAL THE CTA CARRIES, on the path that has no CTA.
      // The other door's hand-off fires this once, automatically, so a gate that lived only
      // on a button would leave the fast path sending the blind body. When the reading is
      // seeded (Plan 08) this term is already false at mount and costs a fire nothing.
      templateRead.kind !== "loading"
    ) {
      autoDraftFiredRef.current = true
      void onDraft()
    }
  }, [autoDraft, initialDescribe, builderPhase, onDraft, templateRead])

  return {
    describe,
    setDescribe,
    projectFolderId,
    setProjectFolderId,
    canDraft,
    onDraft,
    templateFile,
    templateRead,
    onPickTemplateFile,
    onClearTemplateFile,
  }
}
