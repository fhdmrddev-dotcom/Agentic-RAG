/**
 * Phase 184-09 Task 1 (CANVAS-04 / R11) — useGroundingBundle.
 *
 * THE ONLY CALLER OF `GET /workflows/grounding-bundle` IN THE APP. The route shipped in
 * Phase 182 and its typed client in 184-06; until now nothing has read it. Everything the
 * canvas's governance rails offer a user to pick FROM comes through here, and this module
 * invents none of it: the tool list this hook returns is the server's array, handed on
 * untouched. That is the whole of R11's "no frontend constant" rule — a whitelist assembled
 * client-side would let knowledge-base content whitelist itself, which is the elevation of
 * privilege the server-owned registry exists to prevent.
 *
 * THE `degraded` FIELD IS THE HONESTY SIGNAL AND IT IS WHY THIS HOOK EXISTS AS A UNION.
 * An EMPTY `degraded` array is the ONLY value that means "this palette is complete". A
 * registry blip is served at HTTP 200 with empty lists, which is byte-indistinguishable
 * from an author who genuinely owns nothing — so a caller that branches on emptiness will
 * render an ordinary, empty, entirely believable picker while the truth is that we never
 * got to ask. A non-empty `degraded` therefore resolves to `kind: "unavailable"` and NEVER
 * to `kind: "ready"`, and the `ready` member's `degraded` is typed as the EMPTY TUPLE so
 * that "a degraded bundle presented as a complete palette" is not a state anyone can
 * construct — the 184-06 fail-closed-by-shape idiom rather than a fail-closed-by-test one.
 *
 * The partial `tools` array RIDES ALONG on the unavailable member. A degraded read is not
 * an empty read: the server may have answered with a real tool list while failing to reach
 * the folder registry, and throwing that away would turn "we could not load everything"
 * into "you have nothing". The caller decides what to say; this hook refuses only to let it
 * be said as if it were complete.
 *
 * A network failure, an expired token (401) and a mid-session flag flip (404) all resolve
 * to `reason: "unreachable"`. The client cannot distinguish "gated" from "unbuilt" from
 * "offline" and must not pretend to — all three mean "we could not get an answer".
 *
 * NO POLLING, AND NO "FETCH ONCE" REF. The effect is keyed on `enabled` alone, so the call
 * fires when the palette is first wanted and never repeats while it stays wanted. A
 * `requestedRef` that suppressed the second run would look tidier and would WEDGE under
 * `<StrictMode>` (`main.tsx:7`), whose deliberate mount → cleanup → mount cycle aborts the
 * first request and would then be refused a replacement, leaving the hook loading forever.
 *
 * `idle` AND `loading` ARE DERIVED, NOT STORED. Only the server's ANSWER lives in state;
 * the two waiting readings fall out of `enabled` plus the absence of an answer. That is
 * what `react-hooks/set-state-in-effect` is asking for — a synchronous `setState` in the
 * effect body to announce "loading" is a cascading render — and it buys two things beyond
 * the lint: the reading before the first answer is honest by construction rather than by a
 * transition someone could forget to write, and a previously read palette SURVIVES a
 * transient disable or a re-enable instead of being wiped back to a client-authored empty.
 *
 * PHASE 185 (D-185-09) — `kbTools` RIDES ON BOTH ANSWER MEMBERS, DELIBERATELY. The
 * server's knowledge-base tool list is a fixed constant served OUTSIDE every registry
 * read in `assemble_grounding_bundle`, so it arrives intact even on a 200 that named a
 * failed folder or skill registry. Carrying it only on `ready` would mean a PostgREST
 * blip on an unrelated registry silently UN-MARKS a locked step — the canvas would show
 * a governed step as ungoverned while the engine went on gating it. The client uses this
 * list for one thing: the local `available_tools ∩ kb_tools` intersection that moves the
 * dial, the strike-through and the canvas seal on the SAME render as a tool chip. It
 * never enforces, so a wrong read is a display bug and never a safety hole.
 *
 * `isAbortError` is a module-local copy of the double-shaped check shipped at
 * `usePanelReconcile.ts:84-92`, exactly as `useLiveValidation.ts:168-173` also keeps one.
 * Neither hook can import the other's private predicate without depending on a whole
 * unrelated module, and the shipped precedent is a local copy per in-hook fetch.
 */
import { useEffect, useState } from "react"

import { getGroundingBundle, type GroundingBundle } from "@/lib/api"

/**
 * The four honest readings of the palette.
 *
 * `ready.degraded` is the empty TUPLE type, not `string[]`: the only way to construct this
 * member is with a literal `[]`, so a caller cannot widen a partial read into a complete
 * one and the compiler carries the guarantee the docblock above claims.
 *
 * `kbTools` sits on BOTH ANSWER members and on NEITHER waiting member. The two waiting
 * readings carry no data by design and are frozen at module scope so a caller may compare
 * them by identity across renders; giving either a field would break that.
 */
export type GroundingBundleState =
  /** Never asked — `enabled` has not been true yet. Zero requests have been issued. */
  | { kind: "idle" }
  /** Asked, still waiting. */
  | { kind: "loading" }
  /** A complete palette: the server answered and named no failed registry. */
  | {
      kind: "ready"
      tools: string[]
      /** D-185-09 — the server's knowledge-base tool list, handed on untouched. */
      kbTools: string[]
      folders: GroundingBundle["folders"]
      skills: GroundingBundle["skills"]
      degraded: readonly []
    }
  /**
   * We could not build a palette a user may trust. `reason` separates a 200 that named
   * failed registries (`"degraded"` — `tools` may still be partly populated) from no
   * usable answer at all (`"unreachable"` — `tools` is empty).
   */
  | {
      kind: "unavailable"
      reason: "degraded" | "unreachable"
      tools: string[]
      /**
       * D-185-09 — STILL POPULATED on the `"degraded"` reading. The list is a fixed
       * server constant, not a per-caller registry read, so a failed folder/skill read
       * must never un-mark a locked step. On `"unreachable"` there is no answer at all,
       * so it is `[]` and the canvas simply marks nothing — the server still enforces.
       */
      kbTools: string[]
      degraded: string[]
    }

/**
 * The two readings the server has not authored: no answer AND none wanted (`idle`), no
 * answer AND one wanted (`loading`). Frozen at module scope so a caller can compare the
 * returned state by identity across renders — they carry no data to vary.
 */
const IDLE: GroundingBundleState = { kind: "idle" }
const LOADING: GroundingBundleState = { kind: "loading" }

/** The server's answer — the only part of this hook's reading that is stored. */
type GroundingBundleAnswer = Extract<GroundingBundleState, { kind: "ready" } | { kind: "unavailable" }>

/** The shipped `usePanelReconcile.ts:84-92` double-shaped check — an abort is not a failure. */
function isAbortError(err: unknown): boolean {
  if (err instanceof Error && err.name === "AbortError") return true
  if (err && typeof err === "object" && "name" in err && (err as { name: string }).name === "AbortError")
    return true
  return false
}

/**
 * Read the server's palette once, when it is wanted.
 *
 * @param enabled  `false` issues no request at all and leaves any previously read palette
 *                 in place — a transient disable must not discard the server's last word
 *                 and replace it with a client-authored empty one.
 */
export function useGroundingBundle(enabled: boolean): GroundingBundleState {
  const [answer, setAnswer] = useState<GroundingBundleAnswer | null>(null)

  useEffect(() => {
    // Not wanted: no request, and NO state reset (see the `enabled` parameter note).
    if (!enabled) return

    const controller = new AbortController()

    getGroundingBundle(undefined, controller.signal)
      .then((bundle) => {
        // Post-await guard, the `usePanelReconcile.ts:70-75` shape. This hook fires once
        // per `enabled` change and has no ordering problem to solve, so the signal IS the
        // whole staleness question here — unlike the validation loop, where a monotonic
        // sequence had to carry it because a superseded reply can still resolve.
        if (controller.signal.aborted) return
        if (bundle.degraded.length > 0) {
          // A 200 that named a failed registry. NOT ready — see the module docblock.
          setAnswer({
            kind: "unavailable",
            reason: "degraded",
            tools: bundle.tools,
            // Deliberately NOT suppressed on this branch — see the union member's note.
            kbTools: bundle.kb_tools ?? [],
            degraded: bundle.degraded,
          })
          return
        }
        setAnswer({
          kind: "ready",
          tools: bundle.tools,
          kbTools: bundle.kb_tools ?? [],
          folders: bundle.folders,
          skills: bundle.skills,
          degraded: [],
        })
      })
      .catch((err: unknown) => {
        // An abort caused by unmount or by a change in `enabled` is silent by design.
        if (isAbortError(err)) return
        if (controller.signal.aborted) return
        // No answer at all means no list: the canvas marks nothing and the server, which
        // is the only thing that enforces, is unaffected.
        setAnswer({
          kind: "unavailable",
          reason: "unreachable",
          tools: [],
          kbTools: [],
          degraded: [],
        })
      })

    return () => controller.abort()
  }, [enabled])

  // The waiting readings are derived, never stored — see the module docblock.
  return answer ?? (enabled ? LOADING : IDLE)
}
