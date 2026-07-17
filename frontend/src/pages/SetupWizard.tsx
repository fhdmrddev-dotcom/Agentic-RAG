// ─────────────────────────────────────────────────────────────────────────────
// Phase 158 Plan 11 (DEPLOY-02 / UI-SPEC §0 + §7-§9, D-06 / D-14) — the wizard host.
//
// The full-page, pre-auth install-wizard step machine. Mirrors the
// `admin/ControlRoomPage.tsx` shell (a full-page component holding a tab/step state
// machine — NO url router; a `currentStep` useState, exactly like the Control Room's
// active-tab state and the Skill Studio's tab machine). It composes the 8 shipped
// setup leaves (158-09/10) in the Success-Criteria step order and owns the shared
// session state (token · detect · preset · bind · operator email · provider) + the
// step navigation + the finalize→lock-out transition.
//
// THE RAIL — generalized from `skills/studio/LifecycleStepper.tsx`: the wizard's
// 6-node progress rail (`WizardStepper` below) PORTS the LifecycleStepper's NODE_TONE
// map + numbered/✓ glyph + connector line + the click-to-revisit `<button
// aria-label="Go to {step}">` (the D-14 idempotency + a11y already solved there). The
// actual LifecycleStepper is bound to the skill PublishGate read-model, so the pattern
// is ported to the 6 wizard steps rather than the component reused whole — the same
// reuse-by-composition discipline the rest of this phase follows. Only the CURRENT
// step narrates (quiet-idle); completed steps are click-to-revisit (idempotent, D-14).
// Below `sm` the rail collapses to the strip variant ("Step N of 6 · {name}").
//
// SECURITY (T-158-11): this pre-auth branch is UX only — the SetupMiddleware gate +
// require_setup_token (158-03/06) are the wall. The token is entered once (the gate),
// held in state, threaded to every setupApi write; no secret renders in full; there is
// no raw-HTML injection sink here (every value is a plain React text node).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react"
import { Lock, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

import { SetupTokenGate } from "@/components/setup/SetupTokenGate"
import { EnvironmentDetectCard } from "@/components/setup/EnvironmentDetectCard"
import { PresetPickerStep, type SetupPreset } from "@/components/setup/PresetPickerStep"
import { ConnectionBindStep } from "@/components/setup/ConnectionBindStep"
import { OperatorBootstrapStep } from "@/components/setup/OperatorBootstrapStep"
import { ProviderKeyStep } from "@/components/setup/ProviderKeyStep"
import { SmokeChecklist } from "@/components/setup/SmokeChecklist"
import { FinalizedLockout } from "@/components/setup/FinalizedLockout"
import {
  EXTRACTION_PRESETS,
  type ProviderPickerValue,
} from "@/components/settings/ProviderPicker"
import type {
  BindBody,
  DetectResult,
  FinalizeBody,
  SmokeBody,
  SmokeCheckId,
} from "@/lib/setupApi"

// The 6 wizard steps, in the Success-Criteria order (D-06). Index === step number.
const STEPS = [
  { key: "detect", name: "Detect" },
  { key: "preset", name: "Preset" },
  { key: "connect", name: "Connect" },
  { key: "operator", name: "Operator" },
  { key: "provider", name: "Provider" },
  { key: "smoke", name: "Smoke" },
] as const

// A red smoke row jumps back to the step that owns its fix (idempotent re-entry, D-14).
const CHECK_OWNER_STEP: Record<SmokeCheckId, number> = {
  supabase_auth: 2, // Connect
  postgres_schema: 2, // Connect
  redis_ping: 2, // Connect
  provider_key: 4, // Provider
  operator_row: 3, // Operator
}

// Tone → Aether Deep Midnight tokens, ported from LifecycleStepper's NODE_TONE. The
// wizard's active node is `--primary`-washed (UI-SPEC: the active-step ring is the one
// reserved --primary use in the rail); completed = emerald; upcoming = muted.
const NODE_TONE = {
  ok: "bg-emerald-500/15 border-emerald-500 text-emerald-500",
  current: "bg-primary/15 border-primary text-primary",
  dim: "bg-muted border-border text-muted-foreground",
} as const
const NAME_TONE = {
  ok: "text-emerald-500",
  current: "text-primary",
  dim: "text-muted-foreground",
} as const

/** Mask a token to its last 4 — the only form it is echoed in (T-158-11 / T-158-10). */
function maskToLast4(token: string): string {
  const t = token.trim()
  return t.length <= 4 ? "····" : `····${t.slice(-4)}`
}

/**
 * The 6-node progress rail — the ported LifecycleStepper (see file header). `full`
 * renders the horizontal numbered/✓ nodes with click-to-revisit buttons on any
 * already-reached step; `strip` collapses to a one-line "Step N of 6 · {name}" for
 * narrow viewports.
 */
function WizardStepper({
  current,
  maxReached,
  onJump,
  variant,
}: {
  current: number
  maxReached: number
  onJump: (index: number) => void
  variant: "full" | "strip"
}) {
  if (variant === "strip") {
    return (
      <p role="status" className="flex items-center gap-2 text-xs">
        <span className="font-semibold text-primary">
          Step {current + 1} of {STEPS.length}
        </span>
        <span className="text-muted-foreground">·</span>
        <span className="text-muted-foreground">{STEPS[current].name}</span>
      </p>
    )
  }

  return (
    <nav aria-label="Setup progress" className="flex items-start">
      {STEPS.map((s, i) => {
        const reached = i <= maxReached
        const here = i === current
        const tone: keyof typeof NODE_TONE = here ? "current" : reached ? "ok" : "dim"
        // Completed/reached nodes carry ✓; the current + not-yet-reached carry the number.
        const glyph = !here && reached ? "✓" : String(i + 1)
        // Only an already-reached, non-current node is click-to-revisit (idempotent, D-14).
        const clickable = reached && !here
        const content = (
          <>
            {/* Connector runs edge-to-edge between circles (13px radius + 4px gap). */}
            {i < STEPS.length - 1 && (
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-[calc(50%+17px)] top-[12px] h-0.5 w-[calc(100%-34px)]",
                  i < maxReached ? "bg-emerald-500/45" : "bg-border",
                )}
              />
            )}
            <span
              className={cn(
                "relative z-10 flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 text-[11px]",
                NODE_TONE[tone],
              )}
            >
              {glyph}
            </span>
            <span className={cn("mt-1.5 text-[10px] font-semibold", NAME_TONE[tone])}>{s.name}</span>
          </>
        )
        const base = "relative flex flex-1 flex-col items-center text-center"
        return clickable ? (
          <button
            key={s.key}
            type="button"
            className={cn(base, "cursor-pointer bg-transparent")}
            onClick={() => onJump(i)}
            aria-label={`Go to ${s.name}`}
          >
            {content}
          </button>
        ) : (
          <div key={s.key} className={base} aria-current={here ? "step" : undefined}>
            {content}
          </div>
        )
      })}
    </nav>
  )
}

/** Seed the provider selection from the first EXTRACTION preset (OpenAI, D-12). */
function initialProviderValue(): ProviderPickerValue {
  const p = EXTRACTION_PRESETS[0]
  return {
    provider: p.key,
    model: p.model,
    base_url: p.base_url,
    api_key: "",
    dimensions: p.dims,
    threshold: p.threshold,
  }
}

interface SetupWizardProps {
  /** Route to the normal auth/app surface once setup is finalized. Defaults to a full
   *  navigation to `/` (drops the `/setup` path AND reloads so the box picks up the
   *  finalized markers + the runtime-hydrated Supabase creds). Injectable for tests. */
  onExitToApp?: () => void
}

export function SetupWizard({ onExitToApp }: SetupWizardProps = {}) {
  // Session state — host-owned, threaded to the leaves (the leaves are pure controlled
  // components; only their transient test/reveal state is local, per 158-09/10).
  const [token, setToken] = useState<string | null>(null)
  const [detect, setDetect] = useState<DetectResult | null>(null)
  const [step, setStep] = useState(0)
  const [maxReached, setMaxReached] = useState(0)
  const [preset, setPreset] = useState<SetupPreset>("onebox")
  const [bind, setBind] = useState<BindBody>({})
  const [operatorEmail, setOperatorEmail] = useState("")
  const [providerValue, setProviderValue] = useState<ProviderPickerValue>(initialProviderValue)
  const [finalized, setFinalized] = useState(false)

  // Advance / revisit — a single mover that never rewinds `maxReached`, so jumping back
  // to a completed step leaves the rail's furthest-reached progress intact (D-14).
  function goStep(next: number) {
    setStep(next)
    setMaxReached((m) => Math.max(m, next))
  }

  const goToApp = onExitToApp ?? (() => window.location.assign("/"))

  // ── Finalized: the ONLY surface after finalize is the lock-out (SC#2 / D-14). ──
  if (finalized) {
    return <FinalizedLockout onGoToApp={goToApp} />
  }

  // ── Pre-step: the setup-token gate is the first screen (its own full-page shell). ──
  if (token === null) {
    return (
      <SetupTokenGate
        onTokenAccepted={(t, d) => {
          setToken(t)
          setDetect(d)
          setStep(0)
          setMaxReached(0)
        }}
      />
    )
  }

  // The submitted config the smoke checklist probes (note the `service_role_key` field
  // name) vs the full config finalize commits (note `supabase_service_role_key`) — the
  // 158-06/08 field-name split (158-10 SUMMARY "Next Phase Readiness").
  const smokeBody: SmokeBody = {
    supabase_url: bind.supabase_url,
    service_role_key: bind.supabase_service_role_key,
    postgres_dsn: bind.postgres_dsn,
    redis_url: bind.redis_url,
    provider: providerValue.provider,
    provider_key: providerValue.api_key,
  }
  const finalizeBody: FinalizeBody = {
    supabase_url: bind.supabase_url,
    supabase_anon_key: bind.supabase_anon_key,
    supabase_service_role_key: bind.supabase_service_role_key,
    supabase_publishable_key: bind.supabase_publishable_key,
    supabase_secret_key: bind.supabase_secret_key,
    postgres_dsn: bind.postgres_dsn,
    redis_url: bind.redis_url,
    operator_emails: operatorEmail.trim() || undefined,
    provider: providerValue.provider,
    provider_key: providerValue.api_key,
  }

  function renderStep() {
    switch (step) {
      case 0:
        return <EnvironmentDetectCard detect={detect} onContinue={() => goStep(1)} />
      case 1:
        return <PresetPickerStep value={preset} onChange={setPreset} onContinue={() => goStep(2)} />
      case 2:
        return (
          <ConnectionBindStep
            token={token as string}
            value={bind}
            onChange={setBind}
            onContinue={() => goStep(3)}
          />
        )
      case 3:
        return (
          <OperatorBootstrapStep
            token={token as string}
            email={operatorEmail}
            onEmailChange={setOperatorEmail}
            bind={{
              supabase_url: bind.supabase_url,
              supabase_service_role_key: bind.supabase_service_role_key,
              postgres_dsn: bind.postgres_dsn,
            }}
            onCreated={() => goStep(4)}
          />
        )
      case 4:
        return (
          <ProviderKeyStep
            token={token as string}
            value={providerValue}
            onChange={setProviderValue}
            onContinue={() => goStep(5)}
          />
        )
      case 5:
      default:
        return (
          <SmokeChecklist
            token={token as string}
            smoke={smokeBody}
            finalize={finalizeBody}
            onBackToFix={(target) => setStep(CHECK_OWNER_STEP[target])}
            onFinalized={() => setFinalized(true)}
          />
        )
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Slim setup-state banner — the MaintenanceBanner shape, neutral/primary tint
          (NOT amber), role="status". */}
      <div
        role="status"
        className="flex items-center justify-center gap-2 border-b border-primary/30 bg-primary/10 px-4 py-2 text-center text-[13px] font-medium text-foreground"
      >
        <Sparkles className="h-3.5 w-3.5 flex-none text-primary" aria-hidden="true" />
        <span>First-run setup — configure this workspace to get started.</span>
      </div>

      {/* Header band — the OperatorBand-style wordmark + the 🔒 setup-session chip
          (minted once the token is accepted; echoed masked to last-4 only). */}
      <header className="flex items-center justify-between gap-3 border-b border-border/60 px-6 py-3">
        <span className="font-headline text-base font-semibold text-foreground">First-run setup</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
          <Lock className="h-3 w-3" aria-hidden="true" />
          setup session · <span className="font-mono">{maskToLast4(token)}</span>
        </span>
      </header>

      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-8 sm:py-10">
        {/* Rail: full ≥ sm, strip < sm (UI-SPEC Responsive). */}
        <div className="mb-8 hidden sm:block">
          <WizardStepper current={step} maxReached={maxReached} onJump={goStep} variant="full" />
        </div>
        <div className="mb-6 sm:hidden">
          <WizardStepper current={step} maxReached={maxReached} onJump={goStep} variant="strip" />
        </div>

        {renderStep()}
      </main>
    </div>
  )
}
