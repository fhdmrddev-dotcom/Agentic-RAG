// ─────────────────────────────────────────────────────────────────────────────
// Phase 158 Plan 09 (DEPLOY-02 / UI-SPEC §3, D-09) — the preset picker.
//
// A REAL `role="radiogroup"` (arrow-key selectable — the Phase 155 AA bar) of
// deployment-preset cards. One-box is the PROMINENT, primary-tinted "Recommended"
// card, selected by DEFAULT (D-09) — it is the only fully-built, smoke-tested
// happy path. Managed and On-prem are visibly-secondary sibling cards: selecting
// one shows an inline honesty banner linking the matching `OPERATOR.md` variant
// section. They pre-fill defaults and point at the runbook; they do NOT launch a
// multi-preset engine (a SHOULD, D-18 — the built path is one-box).
//
// A11Y (Phase 155): a proper radiogroup with roving tabindex + arrow-key selection;
// the selected card carries an explicit ✓ indicator AND `aria-checked` — never
// colour-alone.
//
// PURE PRESENTATIONAL LEAF: props in, DOM out. The host owns the selected value
// (drives the ConnectionBindStep pre-fill) + the step machine.
// ─────────────────────────────────────────────────────────────────────────────
import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Check, ExternalLink, Server, Cloud, HardDrive, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/** The three deployment homes the wizard understands. One-box is the built happy
 *  path; the others pre-fill + link the runbook (D-09). */
export type SetupPreset = "onebox" | "managed" | "onprem"

interface PresetDef {
  key: SetupPreset
  name: string
  tagline: string
  glyph: LucideIcon
  recommended: boolean
  /** The OPERATOR.md variant section a secondary preset links (D-09/D-18). */
  runbookSection?: string
  runbookHref?: string
}

// The in-repo Home-B runbook the wizard automates; the variant sections it points at.
const OPERATOR_DOC = "/docs/OPERATOR.md"

const PRESETS: readonly PresetDef[] = [
  {
    key: "onebox",
    name: "One-box self-host",
    tagline: "One server, one docker compose up. The guided happy path — walk it right here.",
    glyph: Server,
    recommended: true,
  },
  {
    key: "managed",
    name: "Managed / cloud",
    tagline: "You host it for customers on vendor infra. Pre-fills defaults + opens the runbook.",
    glyph: Cloud,
    recommended: false,
    runbookSection: "Home A — managed SaaS",
    runbookHref: `${OPERATOR_DOC}#home-a--managed-saas-variant`,
  },
  {
    key: "onprem",
    name: "On-prem / bring-your-own-cloud",
    tagline: "Sealed in the building, or your own cloud. Pre-fills defaults + opens the runbook.",
    glyph: HardDrive,
    recommended: false,
    runbookSection: "Homes C & D — variant deltas",
    runbookHref: `${OPERATOR_DOC}#homes-c--d--variant-deltas-short`,
  },
]

interface PresetPickerStepProps {
  /** The selected preset (host-owned; one-box is the wizard's default). */
  value: SetupPreset
  onChange: (preset: SetupPreset) => void
  onContinue: () => void
}

export function PresetPickerStep({ value, onChange, onContinue }: PresetPickerStepProps) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])

  // Arrow keys move selection AND focus (ARIA radiogroup semantics — Phase 155 AA bar).
  function handleKeyDown(e: React.KeyboardEvent) {
    const idx = PRESETS.findIndex((p) => p.key === value)
    let next = idx
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (idx + 1) % PRESETS.length
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (idx - 1 + PRESETS.length) % PRESETS.length
    else return
    e.preventDefault()
    onChange(PRESETS[next].key)
    refs.current[next]?.focus()
  }

  const selected = PRESETS.find((p) => p.key === value)

  return (
    <section aria-label="Deployment preset" className="space-y-4">
      <div>
        <h2 className="font-headline text-xl font-semibold text-foreground">How are you running this?</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          One-box is the guided path. The others pre-fill sensible defaults and point you at the
          matching runbook.
        </p>
      </div>

      <div role="radiogroup" aria-label="Deployment preset" className="space-y-2.5" onKeyDown={handleKeyDown}>
        {PRESETS.map((p, i) => {
          const checked = p.key === value
          const Glyph = p.glyph
          return (
            <button
              key={p.key}
              ref={(el) => {
                refs.current[i] = el
              }}
              type="button"
              role="radio"
              aria-checked={checked}
              tabIndex={checked ? 0 : -1}
              data-preset={p.key}
              data-selected={String(checked)}
              onClick={() => onChange(p.key)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                checked
                  ? "border-primary bg-primary/10 ring-1 ring-primary/40"
                  : "border-border bg-card hover:border-border/80",
                !p.recommended && !checked && "opacity-90",
              )}
            >
              <div
                className={cn(
                  "mt-0.5 flex h-9 w-9 flex-none items-center justify-center rounded-lg",
                  checked ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
                )}
              >
                <Glyph className="h-5 w-5" aria-hidden="true" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-foreground">{p.name}</span>
                  {p.recommended && (
                    <span className="flex-none rounded-full border border-primary/40 bg-primary/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                      Recommended
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{p.tagline}</p>
              </div>

              {/* Explicit checked indicator — never colour-alone. */}
              <span
                aria-hidden="true"
                className={cn(
                  "mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border",
                  checked ? "border-primary bg-primary text-primary-foreground" : "border-border",
                )}
              >
                {checked && <Check className="h-3.5 w-3.5" />}
              </span>
            </button>
          )
        })}
      </div>

      {/* Honesty banner — secondary presets don't launch a multi-preset engine; they
          pre-fill defaults + link the OPERATOR.md variant (D-09/D-18). Amber, not red. */}
      {selected && !selected.recommended && (
        <div
          role="status"
          className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-[12px] text-amber-600 dark:text-amber-400"
        >
          <span aria-hidden="true">ⓘ</span>
          <span>
            One-box is the only fully guided path. We'll pre-fill defaults for this option — follow{" "}
            <a
              href={selected.runbookHref}
              target="_blank"
              rel="noreferrer"
              data-runbook-section={selected.runbookSection}
              className="inline-flex items-center gap-0.5 font-medium underline underline-offset-2"
            >
              OPERATOR.md → {selected.runbookSection}
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>{" "}
            for the rest.
          </span>
        </div>
      )}

      <Button onClick={onContinue} className="w-full sm:w-auto">
        Continue
      </Button>
    </section>
  )
}
