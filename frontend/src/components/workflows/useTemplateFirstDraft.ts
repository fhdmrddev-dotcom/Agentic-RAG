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
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { generateWorkflow, readDescribeFile } from "@/lib/api"
// 296-07 (step 0) — the post-draft bind, moved to its own leaf.
import { bindDraftFiles, type BindSubject } from "./templateDraftBind"
// 197-06 (D-13) — the response type's new arm, imported as a TYPE. The client half of this
// concern already lives in that module; declaring a structurally-similar shape here would be
// the `TemplateReadAnswer` mistake in a second place — two homes for one server answer.
import type { GenerateReadiness } from "@/lib/api"
// 291-04 — the describe door's wire types, imported as TYPES from the same single home.
import type {
  DescribeFormBody,
  DescribeReadResult,
  DescribeReferenceBody,
  DescribeRole,
  GenerateField,
  GenerateRemoved,
  ReferenceAssetDescriptor,
} from "@/lib/api"
import type { BuilderPhase, BuilderStore, TemplateAssetDescriptor } from "./builderStore"
// Phase 281 (FIX-10) — the describe refusal table's KEY builders. A leaf module: it imports
// only the door vocabulary, so no cycle back to the page or the door shell can form here.
import { REQUEST_FAILED_KEY, refusalKey } from "./describeRefusalVocabulary"
import { ENTITLEMENT_REFUSED_KEY } from "./describeRefusalVocabulary"
// 291-06 (CR-02) — the client-only key for a form the drafter cannot be sent.
import { FORM_NOT_SENDABLE_KEY } from "./describeRefusalVocabulary"
// 291-04 — the references' notices are worded in the vocabulary leaf; this module passes DATA.
import type { BindFailure } from "./templateFirstVocabulary"
import {
  REFS_REFUSED_FALLBACK,
  refsDuplicate,
  refsOverflow,
  refsRefused,
} from "./templateFirstVocabulary"
// Imported from `_core` directly (not the `@/lib/api` barrel), so suites that mock the
// barrel wholesale still see the real class.
import { EntitlementRefusalError } from "@/lib/api/_core"

/**
 * ── 291-04 (D-04 / D-08 / D-27) — THE PRE-DRAFT READ, ONE UNION FOR EVERY FILE ON THE DOOR ──
 *
 * The describe door now reads a form, a template or a reference through ONE server door, and
 * the server names the ARM. So the reading is four kinds, not five: nothing held, in flight,
 * the server's whole answer, or no answer. Every field, type, line and sentence inside `read`
 * is the server's own — the row renders it and derives none.
 *
 * ⚠ THIS SUPERSEDES 193.1-07's RE-USE OF THE RAIL'S UNION, and the reason is measured rather
 * than preferred: the rail's `TemplatePlaceholdersState` answers *"which `{{ }}` names does a
 * BOUND template carry"*, and its route still answers only that. The door's question grew — a
 * PDF form, a Word blank, a scan — and a union that can only say `fields: string[]` would
 * have had to drop the types, the lines and the server's sentences on the floor. The rail's
 * union is NOT changed; the door's surfaces (both of them) share THIS one, which keeps the
 * one-wire-shape-for-both-doors rule that 193.1-07 recorded.
 *
 * `none` and `unavailable` still may never merge: `read` with arm `none` is a fact about the
 * DOCUMENT; `unavailable` is a fact about US.
 */
export type DescribeReadState =
  /** Nothing held — zero requests have been issued (D-08). */
  | { kind: "idle" }
  /** Asked, still waiting — including while a REPLACED file's answer is outstanding. */
  | { kind: "loading" }
  /** The server read the file; its arm, fields and sentences are all here, verbatim. */
  | { kind: "read"; result: DescribeReadResult }
  /**
   * No usable answer. `unreadable` is the read door REFUSING the file (a 422) and carries the
   * server's sentence; `unreachable` is no answer at all, and carries none.
   */
  | { kind: "unavailable"; reason: "unreadable" | "unreachable"; detail: string | null }

/** The name both doors already import; it now names the describe door's own union. */
export type TemplateReadState = DescribeReadState

/**
 * The server's answer PLUS THE SUBJECT IT ANSWERED FOR — and, since 291-04, the blanks the
 * author unticked on it (D-27). Ticks belong to the file they were made on, so they live in
 * the answer and a new file starts with every blank ticked.
 *
 * ⚠ THE SUBJECT IS THE `File` OBJECT, COMPARED BY IDENTITY — never `file.name`. The analog
 * keys on an asset id, a STRING, where identity and equality coincide; here two different
 * documents can carry one name, and a name-keyed hook would show the first document's fields
 * under the second document's filename. **No shipped hook proves `File`-identity keying**, so
 * the suite asserts it directly, including the same-name / different-object case.
 *
 * Exported because the fast door carries a COMPLETED answer across the handoff as a seed.
 */
export type TemplateReadAnswer = {
  file: File
  state: Extract<DescribeReadState, { kind: "read" } | { kind: "unavailable" }>
  unticked: readonly string[]
}

/**
 * The two readings the server has not authored, FROZEN AT MODULE SCOPE.
 *
 * ⚠ THIS IS LOAD-BEARING HERE FOR A REASON THE ANALOG DOES NOT HAVE. `onDraft`'s dependency
 * array gains the reading, and the one-shot auto-draft effect depends on `onDraft`'s
 * identity — so a fresh `{kind:"idle"}` object each render would re-create the callback, and
 * re-running that effect is how a one-shot becomes a loop.
 */
const READ_IDLE: DescribeReadState = { kind: "idle" }
const READ_LOADING: DescribeReadState = { kind: "loading" }
/** No blank unticked — frozen for the same identity reason. */
const NO_UNTICKED: readonly string[] = Object.freeze([])

/** The shipped `usePanelReconcile.ts:84-92` double-shaped check — an abort is not a failure. */
function isAbortError(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") return true
  if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "AbortError")
    return true
  return false
}

/**
 * The read door REFUSED the file (a 422 carrying a server sentence), or `null` when the
 * failure was ours (no answer at all). Read by SHAPE rather than by class, so a suite that
 * mocks the client barrel wholesale cannot turn a refusal into a crash.
 */
function refusedSentence(err: unknown): { detail: string | null } | null {
  if (!err || typeof err !== "object") return null
  const status = (err as { status?: unknown }).status
  if (status !== 422) return null
  const detail = (err as { detail?: unknown }).detail
  return { detail: typeof detail === "string" ? detail : null }
}

/**
 * THE ONE PER-FILE READ ROUTINE. Every file on the door — the slot and each of the five
 * reference places — is read by THIS, so there is one abort rule, one identity rule and one
 * positive comparison rather than a second state machine (291-04).
 *
 * @param onRefused Called when the read door REFUSES the file, with the server's sentence. The
 *                  references use it to take the file back off the list (D-03); the slot does
 *                  not, because a refused form stays attached and says so (UI-SPEC).
 */
function useDescribeRead(
  file: File | null,
  role: DescribeRole,
  seed: TemplateReadAnswer | null | undefined,
  onRefused?: (file: File, detail: string | null) => void,
) {
  // ⚠ The seed is read as an INITIAL value AND re-checked in the effect below. The handoff
  // mounts a fresh host, so the initial read is the live path; the effect's check is what
  // makes a seed arriving one render later still cost zero requests.
  const [answer, setAnswer] = useState<TemplateReadAnswer | null>(seed ?? null)
  // The effect reads the answer through a ref so it can stay keyed on `[file]` ALONE. With
  // `answer` in the key, installing an answer would re-run the effect and abort a request
  // that had already been answered — noise that reads exactly like a staleness bug.
  const answerRef = useRef<TemplateReadAnswer | null>(seed ?? null)
  const seedRef = useRef<TemplateReadAnswer | null>(seed ?? null)
  const onRefusedRef = useRef(onRefused)
  // ⚠ MIRRORED IN AN EFFECT, NOT ASSIGNED DURING RENDER — this module's own shipped idiom for
  // the callback refs below, and `react-hooks/refs` enforces it. Declaration order is what
  // makes it correct rather than merely legal: effects run in declaration order within a
  // commit, so this one has already run by the time the read effect below consults the ref on
  // the same commit.
  useEffect(() => {
    seedRef.current = seed ?? null
    onRefusedRef.current = onRefused
  })

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
    readDescribeFile(file, role, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        install({ file, state: { kind: "read", result }, unticked: NO_UNTICKED })
      })
      .catch((err: unknown) => {
        // An abort caused by unmount or by a replaced document is silent by design.
        if (isAbortError(err)) return
        if (controller.signal.aborted) return
        // ⚠ COMPARE POSITIVELY: only a 422 is the door's refusal. Anything else — a network
        // failure, a 5xx, a shape we do not know — is "no answer", never "refused".
        const refused = refusedSentence(err)
        if (refused) {
          install({
            file,
            state: { kind: "unavailable", reason: "unreadable", detail: refused.detail },
            unticked: NO_UNTICKED,
          })
          onRefusedRef.current?.(file, refused.detail)
          return
        }
        install({
          file,
          state: { kind: "unavailable", reason: "unreachable", detail: null },
          unticked: NO_UNTICKED,
        })
      })

    return () => controller.abort()
    // Keyed on the FILE OBJECT — the change detector. Replacing one document with another of
    // the same name is a new subject, and the previous answer must not survive it.
  }, [file, role, install])

  /** Untick a blank, or tick it again. The question stays in the reading either way (D-27). */
  const toggleBlank = useCallback(
    (key: string) => {
      const current = answerRef.current
      if (!current) return
      const unticked = current.unticked.includes(key)
        ? current.unticked.filter((k) => k !== key)
        : [...current.unticked, key]
      install({ ...current, unticked })
    },
    [install],
  )

  // The waiting readings are DERIVED, never stored. An answer about a different document
  // reads as `loading`, not as its own stale self.
  const current = file && answer && answer.file === file ? answer : null
  const state: DescribeReadState = !file ? READ_IDLE : current ? current.state : READ_LOADING
  return {
    state,
    untickedKeys: current ? current.unticked : NO_UNTICKED,
    toggleBlank,
    answer: current,
  }
}

/**
 * Read a held document, once per `File` OBJECT.
 *
 * A LEAF, exported separately because BOTH describe screens need it and only one of them
 * hosts the rest of this module's concern (the other never calls `/generate` at all — its
 * CTA is a handoff).
 *
 * @param file The held document, or `null` when none is held. `null` ⇒ `idle` and ZERO
 *             requests — which is the whole of D-08: no document ⇒ nothing to wait for ⇒ the
 *             CTA is never disabled, with no second conditional to get wrong.
 * @param role `form` for the slot (the default), `reference` for a reference place.
 * @param seed A COMPLETED answer carried across the door handoff. It is installed only for
 *             the exact `File` it answered for, so a seed that does not match the held
 *             document is ignored rather than trusted.
 */
export function useTemplateRead(
  file: File | null,
  role: DescribeRole = "form",
  seed?: TemplateReadAnswer | null,
) {
  return useDescribeRead(file, role, seed)
}

/** How many references the door holds (D-03). */
export const REFERENCE_LIMIT = 5
/** The client's size cap; the server's is authoritative (T-291-33). */
const REFERENCE_MAX_BYTES = 10 * 1024 * 1024

/** One line under the references picker, already worded (the component renders it). */
export type ReferenceNotice = { kind: "refused" | "overflow" | "duplicate"; text: string }

/** One held reference and its reading, in the order the author added them. */
export type HeldReference = { file: File; state: DescribeReadState }

type ReferenceSlots = { slots: readonly (File | null)[]; order: readonly number[] }

function initialSlots(initial: readonly TemplateReadAnswer[] | null | undefined): ReferenceSlots {
  const slots: (File | null)[] = Array.from({ length: REFERENCE_LIMIT }, () => null)
  const order: number[] = []
  for (const [i, answer] of (initial ?? []).slice(0, REFERENCE_LIMIT).entries()) {
    slots[i] = answer.file
    order.push(i)
  }
  return { slots, order }
}

/**
 * 291-04 (D-03) — the references' reads: up to five files, each read by THE SAME per-file
 * routine at FIVE FIXED PLACES.
 *
 * ⚠ FIXED PLACES, NOT A LIST, AND THE REASON IS HOOK ORDER PLUS IDENTITY. A hook may not be
 * called a variable number of times, so the five calls are always made; a removed file frees
 * its place rather than shifting the others down, because a shifted file would land in a
 * place whose answer is about a DIFFERENT file and would be read again. The author's order is
 * kept separately (`order`), so the list renders in pick order whatever place a file sits in.
 *
 * @param initial COMPLETED reads carried across the fast door's handoff. Seeded per place, so
 *                they cost zero requests.
 */
export function useReferenceReads(initial?: readonly TemplateReadAnswer[] | null) {
  const [held, setHeld] = useState<ReferenceSlots>(() => initialSlots(initial))
  // ⚠ The source of truth for the two writers below, kept IN STEP with every `setHeld` call
  // (assigned in the callbacks, never during render). `addFiles` must word its notice from the
  // same snapshot it writes, which a functional update could only do with a side effect.
  const heldRef = useRef<ReferenceSlots>(held)
  const [seeds] = useState<readonly (TemplateReadAnswer | null)[]>(() =>
    Array.from({ length: REFERENCE_LIMIT }, (_, i) => (initial ?? [])[i] ?? null),
  )
  const [notice, setNotice] = useState<ReferenceNotice | null>(null)

  const write = useCallback((next: ReferenceSlots) => {
    heldRef.current = next
    setHeld(next)
  }, [])

  /** The read door refused a file: take it back off the list and say why, in its words. */
  const onRefused = useCallback(
    (file: File, detail: string | null) => {
      const current = heldRef.current
      const place = current.slots.indexOf(file)
      if (place < 0) return
      const slots = [...current.slots]
      slots[place] = null
      write({ slots, order: current.order.filter((p) => p !== place) })
      setNotice({ kind: "refused", text: refsRefused(file.name, detail ?? REFS_REFUSED_FALLBACK) })
    },
    [write],
  )

  // FIVE CALLS, ALWAYS — see the docblock. Each place is read by the one routine.
  const r0 = useDescribeRead(held.slots[0], "reference", seeds[0], onRefused)
  const r1 = useDescribeRead(held.slots[1], "reference", seeds[1], onRefused)
  const r2 = useDescribeRead(held.slots[2], "reference", seeds[2], onRefused)
  const r3 = useDescribeRead(held.slots[3], "reference", seeds[3], onRefused)
  const r4 = useDescribeRead(held.slots[4], "reference", seeds[4], onRefused)
  const s0 = r0.state
  const s1 = r1.state
  const s2 = r2.state
  const s3 = r3.state
  const s4 = r4.state

  const references = useMemo<readonly HeldReference[]>(() => {
    const states = [s0, s1, s2, s3, s4]
    return held.order.flatMap((place) => {
      const file = held.slots[place]
      return file ? [{ file, state: states[place] }] : []
    })
  }, [held, s0, s1, s2, s3, s4])

  const anyReading = [s0, s1, s2, s3, s4].some((s) => s.kind === "loading")

  const addFiles = useCallback(
    (files: readonly File[]) => {
      const current = heldRef.current
      const slots = [...current.slots]
      const order = [...current.order]
      const overflow: string[] = []
      let duplicate: File | null = null
      let tooBig: File | null = null
      for (const file of files) {
        const isHeld = slots.some((h) => h !== null && h.name === file.name && h.size === file.size)
        if (isHeld) {
          duplicate = file
          continue
        }
        if (file.size > REFERENCE_MAX_BYTES) {
          tooBig = file
          continue
        }
        const free = slots.indexOf(null)
        if (free < 0) {
          overflow.push(file.name)
          continue
        }
        slots[free] = file
        order.push(free)
      }
      write({ slots, order })
      // ONE line, for the most consequential thing this pick did.
      if (overflow.length > 0) setNotice({ kind: "overflow", text: refsOverflow(...overflow) })
      else if (tooBig) setNotice({ kind: "refused", text: refsRefused(tooBig.name, REFS_REFUSED_FALLBACK) })
      else if (duplicate) setNotice({ kind: "duplicate", text: refsDuplicate(duplicate.name) })
      else setNotice(null)
    },
    [write],
  )

  /** Un-pick the reference at `index` in the rendered list. Frees its place; no confirmation. */
  const removeAt = useCallback(
    (index: number) => {
      const current = heldRef.current
      const place = current.order[index]
      if (place === undefined) return
      const slots = [...current.slots]
      slots[place] = null
      write({ slots, order: current.order.filter((_, i) => i !== index) })
      setNotice(null)
    },
    [write],
  )

  return { references, addFiles, removeAt, notice, anyReading }
}

/**
 * The definition shape the store's own `setDrafted` accepts — see the D-24(b) block above for
 * why it is derived from the action rather than imported from the page that declares it.
 */
export type TemplateFirstDefinition = Parameters<
  ReturnType<BuilderStore["getState"]>["setDrafted"]
>[0]

/**
 * 291-04 — what else the generate result carried, handed out UNTOUCHED. Each member is the
 * response's own value: ABSENT means the server said nothing, never an empty list.
 */
export type DraftedExtras = {
  removed: GenerateRemoved[] | undefined
  fields: GenerateField[] | undefined
}

// ── 291-04 — the generate body's caps, mirrored from backend/app/api/workflow_authoring_doors.py
//    (DescribeFormIn / DescribeFormFieldIn) so a body the server would refuse is never built.
//    The server's limits are authoritative; these only keep the draft from failing.
//    291-06 (CR-02): raised to real fillable-PDF shapes, plus the server's aggregate bound. ──
const FORM_FIELDS_MAX = 1000
const FORM_TEXT_MAX = 250_000
const FORM_LABEL_MAX = 200
const FORM_ENUM_MAX = 500
const FORM_OPTIONS_TOTAL_MAX = 20_000
// The server's own refusal for a field key on EVERY arm: control characters or { } < >.
// eslint-disable-next-line no-control-regex
const FIELD_KEY_FORBIDDEN = /[\x00-\x1f\x7f{}<>]/
// …and `%`, refused on every arm except `form_fields`: a PDF field name never reaches Jinja.
const FIELD_KEY_JINJA = /%/

/**
 * The slot's read result as the generate body carries it (Pitfall 11: the RESULT travels, the
 * bytes are never read twice).
 *
 * 291-06 (CR-02): `body` is `null` with `blocked: null` when there is nothing to send (a
 * reference), and `null` with `blocked` set to a short technical sentence naming the FIRST cap
 * hit when the server would refuse it — so the caller can say so instead of dropping the form.
 *
 * For Word blanks the fields are the TICKED placed blanks only (D-27): an unticked blank stays
 * empty in the copy, so the draft must not be built to fill it.
 */
function formBodyFor(
  result: DescribeReadResult,
  unticked: readonly string[],
): { body: DescribeFormBody | null; blocked: string | null } {
  if (result.arm === "reference") return { body: null, blocked: null }
  const fields =
    result.arm === "blanks" ? result.fields.filter((f) => !unticked.includes(f.key)) : result.fields
  const blocked = formCapHit(result, fields)
  if (blocked !== null) return { body: null, blocked }
  return {
    body: {
      filename: result.filename,
      arm: result.arm,
      fields: fields.map(({ key, label, type, enum_options, origin }) => ({
        key,
        label,
        type,
        enum_options,
        origin,
      })),
      text: result.text,
    },
    blocked: null,
  }
}

/** The first mirrored server cap a form trips, as a short technical sentence, or `null`. */
function formCapHit(result: DescribeReadResult, fields: readonly DescribeReadResult["fields"][number][]): string | null {
  if (fields.length > FORM_FIELDS_MAX) {
    return `${fields.length} fields; at most ${FORM_FIELDS_MAX} can be sent`
  }
  if (result.text.length > FORM_TEXT_MAX) {
    return `the form's text is ${result.text.length} characters; at most ${FORM_TEXT_MAX} can be sent`
  }
  for (const f of fields) {
    if (f.key.length === 0 || f.key.length > FORM_LABEL_MAX) {
      return `a field name is empty or longer than ${FORM_LABEL_MAX} characters`
    }
    if (FIELD_KEY_FORBIDDEN.test(f.key)) return "a field name contains { } < > or a control character"
    if (result.arm !== "form_fields" && FIELD_KEY_JINJA.test(f.key)) {
      return "a field name contains %, which only a fillable PDF's field names may carry"
    }
    if (f.label.length > FORM_LABEL_MAX) return `a field label is longer than ${FORM_LABEL_MAX} characters`
    if (f.enum_options.length > FORM_ENUM_MAX) {
      return `a field has ${f.enum_options.length} options; at most ${FORM_ENUM_MAX} can be sent`
    }
    if (f.enum_options.some((o) => o.length > FORM_LABEL_MAX)) {
      return `an option is longer than ${FORM_LABEL_MAX} characters`
    }
  }
  const total = fields.reduce((n, f) => n + f.enum_options.length, 0)
  if (total > FORM_OPTIONS_TOTAL_MAX) {
    return `${total} options in all; at most ${FORM_OPTIONS_TOTAL_MAX} can be sent`
  }
  return null
}

/** The references' read text, in pick order — only those the server actually read. */
function referenceBodiesFor(references: readonly HeldReference[]): DescribeReferenceBody[] {
  return references.flatMap((r) =>
    r.state.kind === "read" && r.state.result.arm === "reference"
      ? [{ filename: r.state.result.filename, text: r.state.result.text }]
      : [],
  )
}

// 296-07 Task 2 (step 0, "extraction FIRST") — `bindPlanFor` and the bind loop MOVED, unchanged,
// to `templateDraftBind.ts`. This hook keeps the state the bind reports into.

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
   * 214-13 (STEP-06 / D-214-20): the connections the author ticked on the loose door, made
   * BEFORE the AI drafts. The generator's whole vocabulary for `external_action` steps.
   *
   * ⚠ ABSENT AND `[]` ARE DIFFERENT FACTS AND THIS HOP MUST NOT COLLAPSE THEM. `undefined`
   * is *no preference* — the field is omitted from the request and the server's unconstrained
   * arm is reached, which is today's behaviour byte for byte. `[]` is the author's DECISION
   * that no external step may be emitted, and it is SENT. The `onDraft` call site below
   * therefore branches on `!== undefined`, never on truthiness or on `.length`.
   */
  initialAllowedConnectionIds?: string[]
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
   *
   * ── 197-06 (D-13) — THE SECOND ARGUMENT: THE SERVER'S READINESS VERDICT ────────────────
   *
   * ⚠ THE PARAMETER IS REQUIRED; ITS VALUE MAY BE `undefined`. That asymmetry is the whole
   * point and it is the 192.1 rule this args interface already runs on (see `onTemplateBound`
   * below): a required member makes the typechecker ENUMERATE the call sites, so a host that
   * forgets the verdict is a compile error rather than a silently green screen. An optional
   * parameter would let exactly one site hide.
   *
   * ⚠ **ABSENT TRAVELS AS ABSENT.** `undefined` here means the server said NOTHING — never
   * that everything is fine. This module does not default it to `{}`, does not coerce it and
   * does not synthesise a passing status when the key is missing. The type's own docblock
   * carries the two shipped floors this obeys (`useModelRegistry`'s failed read, and
   * `model_registry`'s absent override row); the mechanism here is simply that nothing is
   * written between reading it off the response and handing it out.
   *
   * ⚠ **IT IS A SNAPSHOT, NOT LIVE STATE — the consumer's obligation, recorded at the
   * producer.** `SeedReceiptProps.phases` (`SeedReceipt.tsx:147-172`) binds the identical
   * contract in its own words: *an immutable SNAPSHOT of one `POST /generate` result, NEVER a
   * live store selector.* This verdict is what the server said about THE GENERATION, so a
   * consumer that re-derives it from the author's later edits is answering a different
   * question with this value's authority.
   *
   * ── 291-04 — THE THIRD ARGUMENT: THE RESULT'S EXTRAS (`removed`, `fields`) ───────────────
   *
   * Same rule, same reason: read off the SAME result and handed out untouched, absent as
   * absent. The arrival card is what spends them (291-05).
   */
  onDrafted: (
    definition: TemplateFirstDefinition,
    readiness: GenerateReadiness | undefined,
    extras: DraftedExtras,
  ) => void
  /**
   * 193.1-07 (D-06) — the bind's descriptor, handed to the host's SINGLE writer.
   *
   * ⚠ REQUIRED, not optional, and the reason is the 192.1 rule: a required member makes the
   * typechecker enumerate the call sites where a default would let one hide. This module
   * writes NOTHING to the definition itself — the host passes its shipped attach handler
   * here, so that handler's `setTemplateAsset` + `saveNow` stay the ONE writer on the
   * definition JSONB and the bind introduces no second sequencing machinery. The write is
   * serialised against the create that triggered it by `performWrite`'s own single-flight
   * guard and supersession drain, not by anything this module does.
   */
  onTemplateBound: (asset: TemplateAssetDescriptor) => void
  /**
   * 291-04 (D-07) — the reference descriptors of ONE bind, handed to the host in ONE batch so
   * it writes `assets[]` once. REQUIRED for the reason `onTemplateBound` is. Never called with
   * an empty list.
   */
  onReferencesBound: (assets: ReferenceAssetDescriptor[]) => void
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
  /**
   * 291-04 (D-03) — the references picked on the other describe screen, each WITH its
   * completed reading, for the same seed-do-not-re-read reason.
   */
  initialReferences?: readonly TemplateReadAnswer[] | null
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
  /** The slot's reading. */
  templateRead: TemplateReadState
  /** The author picked a document. */
  onPickTemplateFile: (file: File) => void
  /** The author removed it — one press undoes a mis-pick, and the reading returns to `idle`. */
  onClearTemplateFile: () => void
  /** 291-04 (D-27) — the Word blanks the author unticked on the held file. */
  untickedKeys: readonly string[]
  /** 291-04 (D-27) — untick a blank, or tick it again. */
  onToggleBlank: (key: string) => void
  /** 291-04 (D-03) — the held references, in pick order, each with its reading. */
  references: readonly HeldReference[]
  /** 291-04 — the one line under the references picker, or `null`. */
  referenceNotice: ReferenceNotice | null
  /** 291-04 — the author picked one or more references. */
  onAddReferenceFiles: (files: readonly File[]) => void
  /** 291-04 — the author removed the reference at this index of `references`. */
  onRemoveReference: (index: number) => void
  /** 291-04 — any file on the door is still being read (the CTA waits; Pitfall 11). */
  anyReading: boolean
  /**
   * D-06's bind. Uploads the held document — and, since 291-04, each held reference — to the
   * definition that now exists and hands the returned descriptors to the host's writers.
   *
   * ⚠ **IT CATCHES EVERYTHING AND NEVER REJECTS, AND THAT IS THE WHOLE GUARD.** Its one caller
   * is the write loop's created-id callback, which is invoked from INSIDE that loop's own
   * `try`. A synchronous throw out of the callback is therefore rendered as a FAILED SAVE for
   * a row that WAS created, and for a terminal-shaped error it sets the loop's halt flag —
   * which nothing in the session ever clears. An `async` function converts a synchronous
   * throw into a rejection, and the internal `catch` converts the rejection into state. Both
   * layers are load-bearing: the suite asserts the RETURNED PROMISE resolves, not merely that
   * the state is right, because a `void`-ed call that rejects has nowhere to be caught.
   */
  bindHeldTemplate: (definitionId: string) => Promise<void>
  /**
   * The bind's own failure, held until the next attempt.
   *
   * ⚠ IT CARRIES A FILENAME AND NOTHING ELSE — a shape that structurally cannot hold server
   * prose, a status code or an id (`library/useWorkflowFork.ts:205`'s posture). The raw error
   * goes to `console.error` at the boundary, where the developer's evidence and the person's
   * sentence stay two different things and neither replaces the other.
   */
  bindFailed: { filename: string } | null
  /**
   * 296-07 (291-IN-08) — EVERY failure of the last bind, in order, each a kind and a filename
   * (still no server prose). `bindFailed` above is the last of these, kept for its readers.
   */
  bindFailures: readonly BindFailure[]
  /** 296-07 (291-IN-03) — the sentences the template bind could not place a blank for. */
  bindUnplaced: readonly string[]
  /** 296-07 (291-WR-01) — a draft is being written: the file sections are locked. */
  composing: boolean
}

/** Frozen empties, so the returned arrays keep one identity at rest. */
const NO_FAILURES: readonly BindFailure[] = Object.freeze([])
const NO_SENTENCES: readonly string[] = Object.freeze([])

export function useTemplateFirstDraft(args: TemplateFirstDraftArgs): TemplateFirstDraft {
  const {
    store,
    builderPhase,
    initialDescribe,
    autoDraft,
    initialProjectFolderId,
    initialAllowedConnectionIds,
    initialDefinitionFolderId,
    onDraftStarted,
    onDrafted,
    onTemplateBound,
    onReferencesBound,
    initialTemplateFile,
    initialTemplateRead,
    initialReferences,
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
  const slot = useTemplateRead(templateFile, "form", initialTemplateRead)
  const templateRead = slot.state
  const untickedKeys = slot.untickedKeys
  // 291-04 (D-03) — the references, on the same per-file read.
  const referenceReads = useReferenceReads(initialReferences)
  const referencesReading = referenceReads.anyReading
  const anyReading = templateRead.kind === "loading" || referencesReading

  // ⚠ D-08 IS WHY THERE IS NO "HAS A FILE" TERM. Each reading is `idle` — never `loading` —
  // whenever nothing is held, so the absence of a read IS the absence of a gate. A
  // `templateFile !== null &&` guard would be a second conditional that can be got wrong, and
  // it would read green against every behaviour the suite drives. The suite fences this
  // expression's SHAPE for exactly that reason, not only its outcome.
  const canDraft =
    describe.trim().length > 0 && builderPhase !== "composing" && templateRead.kind !== "loading" && !referencesReading

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
  // 296-07 (291-WR-01) — while a draft is being written the files are LOCKED: the sections
  // render disabled, and these writers refuse too, so the bind can only see what was sent.
  const composing = builderPhase === "composing"
  const composingRef = useRef(composing)
  useEffect(() => {
    composingRef.current = composing
  })
  const onPickTemplateFile = useCallback((file: File) => {
    if (!composingRef.current) setTemplateFile(file)
  }, [])
  const onClearTemplateFile = useCallback(() => {
    if (!composingRef.current) setTemplateFile(null)
  }, [])
  const addReferenceFiles = referenceReads.addFiles
  const removeReferenceAt = referenceReads.removeAt
  const onAddReferenceFiles = useCallback(
    (files: readonly File[]) => {
      if (!composingRef.current) addReferenceFiles(files)
    },
    [addReferenceFiles],
  )
  const onRemoveReference = useCallback(
    (index: number) => {
      if (!composingRef.current) removeReferenceAt(index)
    },
    [removeReferenceAt],
  )

  // ── 193.1-07 (D-06) — THE BIND ─────────────────────────────────────────────────────────
  //
  // The held document is read through a REF rather than the dependency list, and the reason
  // is the same one the callback refs above record: `bindHeldTemplate` must keep a stable
  // identity, because the host installs it inside a callback the write loop mirrors once per
  // render. Reading the file at FIRE time is also the correct semantics — the bind runs when
  // the row is created, which is strictly after the pick.
  const templateFileRef = useRef<File | null>(templateFile)
  const templateAnswerRef = useRef<TemplateReadAnswer | null>(slot.answer)
  const referencesRef = useRef<readonly HeldReference[]>(referenceReads.references)
  const onTemplateBoundRef = useRef(onTemplateBound)
  const onReferencesBoundRef = useRef(onReferencesBound)
  /**
   * 214-13 — the ticked vocabulary, read at FIRE time through a ref.
   *
   * ⚠ IT IS NOT IN `onDraft`'s DEPENDENCY LIST, AND THE REASON IS THIS FILE'S OWN MEASURED
   * ONE. An ARRAY prop has a new identity on every render unless its owner memoises it, and the
   * auto-draft effect below depends on `onDraft`'s identity — so naming it there would re-create
   * the callback on every render and re-run that effect, turning the one-shot hand-off into a
   * loop that fires `/generate` repeatedly. Reading it at fire time is also the correct
   * semantics: the draft is composed against whatever the author had ticked when they pressed.
   *
   * ⚠ `undefined` SURVIVES THIS HOP AS `undefined`. There is no `?? []` here — that one
   * character would turn *no preference* into *forbid everything* for every caller that never
   * supplied the prop, which is every shipped mount but the loose door's.
   */
  const allowedConnectionIdsRef = useRef<string[] | undefined>(initialAllowedConnectionIds)
  // Mirrored in an effect for the reason recorded on the two callback refs above, and safe
  // here for a stronger one: the ONLY readers are the async bind and the generate call, which
  // run after every effect on the commit that held the pick has flushed.
  useEffect(() => {
    templateFileRef.current = templateFile
    templateAnswerRef.current = slot.answer
    referencesRef.current = referenceReads.references
    onTemplateBoundRef.current = onTemplateBound
    onReferencesBoundRef.current = onReferencesBound
    allowedConnectionIdsRef.current = initialAllowedConnectionIds
  })

  // 296-07 (291-IN-08 / 291-IN-03) — every failure of the last bind, and its unplaced sentences.
  const [bindFailures, setBindFailures] = useState<readonly BindFailure[]>(NO_FAILURES)
  const [bindUnplaced, setBindUnplaced] = useState<readonly string[]>(NO_SENTENCES)
  const lastFailure = bindFailures.length > 0 ? bindFailures[bindFailures.length - 1] : null
  const bindFailed = useMemo(
    () => (lastFailure ? { filename: lastFailure.filename } : null),
    [lastFailure],
  )
  /**
   * 296-07 (291-WR-01 / 291-WR-02) — WHAT THE DRAFT WAS WRITTEN FROM, taken in `onDraft`. The
   * bind attaches this, never the live lists: a file changed after the press was not read by
   * the model, and a reference whose read never answered was never sent. `null` until a draft
   * is written (the bind then falls back to the live lists, the pre-296 path no product flow
   * reaches: the bind only runs on the create a generation now triggers).
   */
  const bindSnapshotRef = useRef<BindSubject | null>(null)

  // 296-07 (step 0) — the bind loop lives in `templateDraftBind.ts`; this wrapper hands it the
  // refs it reads at fire time and the setters it reports into. Behaviour unchanged.
  const bindHeldTemplate = useCallback((definitionId: string) => {
    // A new bind answers afresh: the last bind's failures and sentences are cleared first.
    setBindFailures(NO_FAILURES)
    setBindUnplaced(NO_SENTENCES)
    return bindDraftFiles(
      definitionId,
      // 296-07 (291-WR-01 / WR-02): the snapshot `onDraft` took, when there is one.
      bindSnapshotRef.current ?? {
        file: templateFileRef.current,
        answer: templateAnswerRef.current,
        references: referencesRef.current,
      },
      {
        onTemplateBound: (asset) => onTemplateBoundRef.current(asset),
        onReferencesBound: (assets) => onReferencesBoundRef.current(assets),
        onFailed: (failure) => setBindFailures((prev) => [...prev, failure]),
        onUnplaced: (sentences) => setBindUnplaced(sentences),
      },
    )
  }, [])

  const onDraft = useCallback(async () => {
    const text = describe.trim()
    if (text.length === 0) return
    // 291-04 (Pitfall 11) — the draft is written FROM the reads, so it waits for them. The CTA
    // is already disabled while anything reads; this is the same refusal on the call itself.
    if (anyReading) return
    store.getState().setComposing()
    // The page's one selection contract is released, and — 186-07 — only the RENDERED draft
    // id resets. The write loop's own mirror needs none: this callback is reachable only from
    // the describe screen, which a session can be on only before any row exists (a save
    // requires the drafted view, and the sole way back is a generate failure, which creates
    // nothing).
    onDraftStartedRef.current()
    // ── 291-04 (D-04 / Pitfall 11) — THE FILES' READ RESULTS, NEVER THEIR BYTES ───────────
    //
    // ⚠ EACH SPREAD IS GATED ON ITS OWN ARM, AND AN EMPTY LIST IS NEVER SENT. `form` travels
    // only on a `read` slot (a failed read is no document); `references` only when at least
    // one was read. With nothing attached neither key exists, so the body is byte-identical
    // to the shipped one — the suite snapshots it.
    const formRead =
      templateRead.kind === "read" ? formBodyFor(templateRead.result, untickedKeys) : null
    const formBody = formRead?.body ?? null
    // ── 291-06 (CR-02) — A FORM IS SENT WHOLE OR THE DRAFT IS STOPPED IN WORDS, NEVER DROPPED.
    // The one exception is the shipped template_placeholders fallback below, which still
    // carries a template's keys; everywhere else a blocked form would be drafted blind. The
    // early return comes after setComposing() and onDraftStarted, so the screen takes the same
    // path as any server refusal.
    const placeholdersFallback =
      templateRead.kind === "read" &&
      templateRead.result.arm === "template_fields" &&
      templateRead.result.fields.length > 0
    if (formRead?.blocked != null && !placeholdersFallback) {
      store.getState().setErrorState(FORM_NOT_SENDABLE_KEY, formRead.blocked)
      return
    }
    const referenceBodies = referenceBodiesFor(referencesRef.current)
    // 296-07 (291-WR-01 / WR-02) — the SNAPSHOT the bind attaches: the slot file and its reading
    // as they are now, and only the references whose text is in this request.
    bindSnapshotRef.current = {
      file: templateFileRef.current,
      answer: templateAnswerRef.current,
      references: referencesRef.current.filter(
        (r) => r.state.kind === "read" && r.state.result.arm === "reference",
      ),
    }
    try {
      const result = await generateWorkflow({
        describe: text,
        // Phase 103-ux: bind the generated workflow to the chosen project (KB). The
        // backend GenerateRequest accepts project_folder_id; omit when none picked.
        ...(projectFolderId ? { project_folder_id: projectFolderId } : {}),
        ...(formBody !== null ? { form: formBody } : {}),
        // ── 193.1-07 (SC#1 / D-19) — THE FIELDS THE SUPPLIED DOCUMENT ACTUALLY ASKS FOR ──
        //
        // ⚠ SINCE 291-04 THIS IS THE NO-FORM BRANCH ONLY. The server reads a template's keys
        // off `form` itself, so the shipped list is sent only when a template's read could
        // not travel as a form (the server's caps would refuse it) — the draft is then still
        // built to the template's fields, the shipped way, rather than blind. It is never sent
        // beside `form`, and an empty array is never sent: `[]` and an absent key are two
        // DIFFERENT statements to the model.
        //
        // ⚠ AND IT IS INDIVISIBLE FROM THE BIND ABOVE (D-19). A deliverable step written to
        // fill a document that was never attached is TERMINAL at run and can never publish.
        ...(formBody === null &&
        templateRead.kind === "read" &&
        templateRead.result.arm === "template_fields" &&
        templateRead.result.fields.length > 0
          ? { template_placeholders: templateRead.result.fields.map((f) => f.key) }
          : {}),
        ...(referenceBodies.length > 0 ? { references: referenceBodies } : {}),
        // ── 214-13 (STEP-06 / D-214-20) — THE AUTHOR'S TICKED SERVICES, AS THE GENERATOR'S
        //    VOCABULARY ─────────────────────────────────────────────────────────
        //
        // ⚠ THE SPREAD BRANCHES ON `!== undefined`, NOT ON TRUTHINESS, AND THAT IS THE WHOLE
        // FIELD. `[]` is FALSY and it is the author's DECISION that no external step may be
        // emitted — an `? :` on the array itself, or a `.length` test, would silently drop
        // exactly that decision and send *no preference* instead, which reaches the server's
        // UNCONSTRAINED arm. The two mean opposite things; see the field's own doc on
        // `GenerateWorkflowBody` and the parameter's doc on `generate_workflow_definition`.
        //
        // ⚠ AND AN ABSENT PROP STAYS ABSENT FROM THE BODY. Every shipped mount but the loose
        // door's supplies nothing, so the request they send is byte-identical to today's.
        ...(allowedConnectionIdsRef.current !== undefined
          ? { allowed_connection_ids: allowedConnectionIdsRef.current }
          : {}),
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
        //
        // 197-06 (D-13): the verdict is read off the SAME `result` the definition came from,
        // and handed out UNTOUCHED. ⚠ No `?? {}`, no coercion, no synthesised pass — an
        // absent verdict is a fact about what the server said and it survives this hop as
        // `undefined`. This is the ONLY boundary in the chain that could drop it, which is
        // why the whole of D-13's client work is this one argument.
        onDraftedRef.current(def, result.readiness, { removed: result.removed, fields: result.fields })
        // 291-04: the extras travel UNTOUCHED by the same rule — each is the response's own
        // value or `undefined`, never a list this module made up.
      } else {
        // ok:false is an HONEST failure — never a renderable broken draft.
        // Phase 281 (D-11/D-13, SEED-221): the store holds the table KEY (the code joined to its
        // additive sub-reason), never words; the page turns it into a sentence + next step.
        store.getState().setErrorState(refusalKey(result.error, result.reason_code), result.detail)
      }
    } catch (e) {
      // Phase 281 (D-24) / 281-REVIEW WR-03: only a TYPED entitlement refusal carries a server
      // SENTENCE; any other throw rides REQUEST_FAILED_KEY and its text stays reveal-only.
      store.getState().setErrorState(
        e instanceof EntitlementRefusalError ? ENTITLEMENT_REFUSED_KEY : REQUEST_FAILED_KEY,
        e instanceof Error ? e.message : undefined,
      )
    }
    // ⚠ `templateRead` JOINS THE DEPENDENCY LIST, which is why the reading and the wire must
    // live in ONE module: a reading held on the host would either be stale in this closure or
    // would re-create this callback on every render. The waiting readings and the empty tick
    // list are frozen at module scope precisely so this list does not churn.
  }, [describe, projectFolderId, store, templateRead, untickedKeys, anyReading])

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
      // 291-04: the references are waited for the same way.
      !anyReading
    ) {
      autoDraftFiredRef.current = true
      void onDraft()
    }
  }, [autoDraft, initialDescribe, builderPhase, onDraft, anyReading])

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
    untickedKeys,
    onToggleBlank: slot.toggleBlank,
    references: referenceReads.references,
    referenceNotice: referenceReads.notice,
    onAddReferenceFiles,
    onRemoveReference,
    anyReading,
    bindHeldTemplate,
    bindFailed,
    bindFailures,
    bindUnplaced,
    composing,
  }
}
