import { useMemo, useState } from "react"
import { useStore } from "zustand"

import { useBuilderStore } from "@/components/workflows/BuilderStoreProvider"
import {
  declaredInputFor,
  refuseDeclaredInputKey,
  undeclaredAskKeys,
  type DeclaredInput,
  type DeclaredInputRefusal,
} from "@/components/workflows/declaredInputs"
import {
  DECLARED_INPUTS_AFFORDANCE_LABEL,
  DECLARED_INPUTS_EMPTY,
  DECLARED_INPUTS_EXPLANATION,
  DECLARED_INPUTS_TITLE,
  DECLARED_INPUT_ADD,
  DECLARED_INPUT_DECLARE,
  DECLARED_INPUT_KEY_LABEL,
  DECLARED_INPUT_LABEL_LABEL,
  DECLARED_INPUT_OFFERS_TITLE,
  DECLARED_INPUT_REFUSE_DUPLICATE,
  DECLARED_INPUT_REFUSE_EMPTY,
  DECLARED_INPUT_REFUSE_RESERVED,
  DECLARED_INPUT_REMOVE,
  DECLARED_INPUT_REQUIRED_TOGGLE,
} from "@/components/workflows/declaredInputsVocabulary"

/**
 * Phase 214.1-01 Task 2 (STEP-02 · D-214.1-01 · D-214.1-03 · D-214.1-06) — THE DOOR THAT
 * DECLARES A WORKFLOW INPUT.
 *
 * Phase 214 shipped the publish gate that refuses an undeclared launch argument, the launch
 * forms that render declared inputs, and the run wire that carries them. Nothing in the
 * product could CREATE one, so *"Asked when this runs"* was a dead end for every author and
 * the only way to send an email was to hardcode the recipient. `BUG-260828-02`. This is the
 * missing quarter.
 *
 * ── ⚠ G-2 IS OVERRIDDEN, NOT SATISFIED (D-214.1-06) ───────────────────────────────────
 *
 * NO OPERATOR-APPROVED SKETCH EXISTS FOR THIS SURFACE. The operator authorised the build
 * unattended and explicitly RETAINED THE VISUAL VETO, so nothing here invents a visual
 * language: the affordance copies `statefulAffordance`'s shape from `WorkflowBuilderPage.tsx`
 * token for token, and the dialog copies `PublishGauntlet`'s shell (the same `z-[9000]`
 * backdrop, the same dedicated backdrop `<button>` for A11Y-01, the same card chrome). Where
 * a shipped primitive did not cover a need — the per-row list, the offers block — the
 * PLAINEST thing that does is used, so the veto has something concrete to act on.
 *
 * ⭐ THE WIRING SURVIVES A RE-SKIN UNTOUCHED, and that is the property that makes the
 * override safe. Every write goes through `setDeclaredInputs`; every refusal comes from
 * `refuseDeclaredInputKey`; every offer comes from `undeclaredAskKeys`; every word comes from
 * `declaredInputsVocabulary.ts`. A rejected visual changes this file's JSX and nothing else.
 *
 * ── IT OWNS ITS OWN OPEN STATE, DELIBERATELY ──────────────────────────────────────────
 *
 * `WorkflowBuilderPage.tsx` measures 22 phases and fires G-5. It gains ONE import and ONE
 * gated node from this feature, and NO `useState` — which is the measurable form of
 * *honoured by construction* for a file that size. The dialog's open flag, the pending key
 * and the refusal all live here.
 *
 * ── THE ONE WRITE PATH ────────────────────────────────────────────────────────────────
 *
 * `setDeclaredInputs` and nothing else. A second writer for `definition.inputs[]` is how
 * `tool_args` became confusing and is precisely what D-214.1-01 exists to prevent. This
 * component never touches `meta` directly, never opens a request, and never mints an entry
 * except through `declaredInputFor`.
 *
 * ⚠ THE REFUSAL IS SHOWN, NEVER A DISABLED CONTROL. An author who types `kickoff_prompt`
 * gets a sentence saying the value would be discarded — the server strips that key at both
 * kickoff merge sites, and `214-09` measured what happens when nobody says so. A control
 * that is merely greyed out teaches nothing (D-214.1-03).
 *
 * ⚠ NO RUNTIME `export const` BESIDE THIS COMPONENT — `react-refresh/only-export-components`
 * is an ACTIVE ERROR on this directory. The words live in `declaredInputsVocabulary.ts`.
 */
export function DeclaredInputsEditor() {
  const store = useBuilderStore()
  const meta = useStore(store, (s) => s.meta)
  const phases = useStore(store, (s) => s.phases)

  const [open, setOpen] = useState(false)
  const [pendingKey, setPendingKey] = useState("")
  const [refusal, setRefusal] = useState<DeclaredInputRefusal | null>(null)

  // The declared list, read defensively: `meta` carries an index signature and its value
  // arrives from server JSONB, so a definition authored before this door existed — or by
  // something else entirely — must degrade to "nothing declared" rather than throw.
  const declared: DeclaredInput[] = useMemo(
    () => (Array.isArray(meta.inputs) ? (meta.inputs as DeclaredInput[]) : []),
    [meta.inputs],
  )

  // ⭐ THE OFFERS ARE WHAT CLOSE THE LOOP. An author who chose "Asked when this runs" on an
  // argument row has already typed the key once; asking them to guess the same spelling here
  // is how `to` in one place and `recipient` in the other produce a refusal nobody can read.
  const offers = useMemo(
    () => undeclaredAskKeys({ inputs: declared, phases }),
    [declared, phases],
  )

  const write = (next: readonly DeclaredInput[]) => {
    store.getState().setDeclaredInputs(next)
  }

  const add = () => {
    const reason = refuseDeclaredInputKey(pendingKey, declared)
    if (reason !== null) {
      setRefusal(reason)
      return
    }
    setRefusal(null)
    setPendingKey("")
    write([...declared, declaredInputFor(pendingKey)])
  }

  const declareOffer = (key: string) => {
    // Offers are derived from keys nothing declares, so they cannot be duplicates — but the
    // refusal is consulted anyway rather than trusted away, because "cannot happen" is what
    // the derivation ASSERTS and the refusal is what the door GUARANTEES.
    if (refuseDeclaredInputKey(key, declared) !== null) return
    write([...declared, declaredInputFor(key)])
  }

  const patch = (key: string, change: Partial<DeclaredInput>) => {
    write(declared.map((i) => (i.key === key ? { ...i, ...change } : i)))
  }

  const remove = (key: string) => {
    write(declared.filter((i) => i.key !== key))
  }

  const REFUSAL_SENTENCE: Record<DeclaredInputRefusal, string> = {
    reserved: DECLARED_INPUT_REFUSE_RESERVED,
    duplicate: DECLARED_INPUT_REFUSE_DUPLICATE,
    empty: DECLARED_INPUT_REFUSE_EMPTY,
  }

  const close = () => {
    setOpen(false)
    setPendingKey("")
    setRefusal(null)
  }

  return (
    <>
      {/* The affordance. `statefulAffordance`'s shape, token for token — this is a header
          sibling and must read as one, not as a new kind of control. */}
      <button
        type="button"
        data-testid="declared-inputs-affordance"
        aria-label={DECLARED_INPUTS_AFFORDANCE_LABEL}
        title={DECLARED_INPUTS_EXPLANATION}
        onClick={() => setOpen(true)}
        className="flex shrink-0 items-center gap-1 rounded border border-border bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-accent/40"
      >
        <span aria-hidden="true">✎</span>
        <span>{DECLARED_INPUTS_TITLE}</span>
        <span
          data-testid="declared-inputs-count"
          className="rounded bg-muted px-1 py-px font-mono text-[10px] text-muted-foreground"
        >
          {declared.length}
        </span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={DECLARED_INPUTS_AFFORDANCE_LABEL}
          data-testid="declared-inputs-modal"
          className="fixed inset-0 z-[9000] grid place-items-center bg-black/60 p-6 backdrop-blur-sm"
        >
          {/* A11Y-01, the shipped shape: backdrop-dismiss lives on a dedicated tabIndex=-1
              <button>, never as a mousedown handler on the role="dialog" element. */}
          <button
            type="button"
            data-testid="declared-inputs-modal-backdrop"
            aria-label="Close dialog"
            tabIndex={-1}
            className="absolute inset-0 cursor-default"
            onMouseDown={close}
          />
          <div className="relative flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-border bg-card shadow-lg">
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <span aria-hidden="true">✎</span>
                <span className="text-[15px] font-semibold text-foreground">
                  {DECLARED_INPUTS_TITLE}
                </span>
              </div>
              <button
                type="button"
                data-testid="declared-inputs-modal-close"
                onClick={close}
                aria-label="Close"
                className="rounded-md border border-border px-2 py-0.5 text-[15px] leading-none text-muted-foreground hover:text-foreground"
              >
                ✕
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <p className="mb-3 text-[12px] text-muted-foreground">
                {DECLARED_INPUTS_EXPLANATION}
              </p>

              {/* The offers, ABOVE the list: they are the thing an author most often wants,
                  and they are the exit from the loop the bug describes. */}
              {offers.length > 0 && (
                <div className="mb-4 rounded-md border border-border bg-background px-3 py-2">
                  <p className="mb-2 text-[11px] text-muted-foreground">
                    {DECLARED_INPUT_OFFERS_TITLE}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {offers.map((key) => (
                      <button
                        key={key}
                        type="button"
                        data-testid={`declared-input-offer-${key}`}
                        onClick={() => declareOffer(key)}
                        className="flex items-center gap-1.5 rounded border border-border bg-card px-2 py-1 text-[12px] text-muted-foreground hover:bg-accent/40"
                      >
                        <span className="font-mono text-foreground">{key}</span>
                        <span>{DECLARED_INPUT_DECLARE}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {declared.length === 0 && offers.length === 0 && (
                <p data-testid="declared-inputs-empty" className="text-[13px] text-muted-foreground">
                  {DECLARED_INPUTS_EMPTY}
                </p>
              )}

              <ul className="flex flex-col gap-2">
                {declared.map((entry) => (
                  <li
                    key={entry.key}
                    data-testid={`declared-input-row-${entry.key}`}
                    className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-background px-3 py-2"
                  >
                    {/* The key in the MONO face: it is a machine name an argument row binds
                        to, not prose, and the two surfaces must read as the same subject. */}
                    <span
                      data-testid={`declared-input-key-${entry.key}`}
                      className="font-mono text-[12px] text-foreground"
                    >
                      {entry.key}
                    </span>
                    <label className="flex min-w-0 flex-1 items-center gap-1.5">
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {DECLARED_INPUT_LABEL_LABEL}
                      </span>
                      <input
                        type="text"
                        data-testid={`declared-input-label-${entry.key}`}
                        value={entry.label}
                        onChange={(e) => patch(entry.key, { label: e.target.value })}
                        className="min-w-0 flex-1 rounded border border-border bg-card px-2 py-0.5 text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </label>
                    <button
                      type="button"
                      data-testid={`declared-input-required-${entry.key}`}
                      aria-pressed={entry.required}
                      onClick={() => patch(entry.key, { required: !entry.required })}
                      className={`flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                        entry.required
                          ? "border-primary/40 bg-primary/10 text-primary"
                          : "border-border bg-card text-muted-foreground hover:bg-accent/40"
                      }`}
                    >
                      <span aria-hidden="true">{entry.required ? "●" : "○"}</span>
                      <span>{DECLARED_INPUT_REQUIRED_TOGGLE}</span>
                    </button>
                    <button
                      type="button"
                      data-testid={`declared-input-remove-${entry.key}`}
                      onClick={() => remove(entry.key)}
                      className="shrink-0 rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:text-foreground"
                    >
                      {DECLARED_INPUT_REMOVE}
                    </button>
                  </li>
                ))}
              </ul>

              {/* The add control. The refusal renders BESIDE it, never as a disabled button
                  with no explanation — a refusal an author cannot read is not a refusal. */}
              <div className="mt-4 border-t border-border pt-3">
                <label className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-muted-foreground">
                    {DECLARED_INPUT_KEY_LABEL}
                  </span>
                  <input
                    type="text"
                    data-testid="declared-input-new-key"
                    value={pendingKey}
                    onChange={(e) => {
                      setPendingKey(e.target.value)
                      setRefusal(null)
                    }}
                    className="min-w-0 flex-1 rounded border border-border bg-background px-2 py-1 font-mono text-[12px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <button
                    type="button"
                    data-testid="declared-input-add"
                    onClick={add}
                    className="shrink-0 rounded border border-border bg-card px-2 py-1 text-[12px] text-muted-foreground hover:bg-accent/40"
                  >
                    {DECLARED_INPUT_ADD}
                  </button>
                </label>
                {refusal !== null && (
                  <p
                    role="alert"
                    data-testid="declared-input-refusal"
                    className="mt-2 text-[12px] text-muted-foreground"
                  >
                    {REFUSAL_SENTENCE[refusal]}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
