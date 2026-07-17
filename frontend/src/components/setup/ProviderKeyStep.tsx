// ─────────────────────────────────────────────────────────────────────────────
// Phase 158 Plan 10 (DEPLOY-02 / UI-SPEC §6, D-12) — the provider-key step.
//
// REUSES `settings/ProviderPicker.tsx` WHOLE (the reuse mandate, D-17) for the
// default-LLM selection: the preset `<select>` + the always-on 🔒 endpoint footer
// (where-it-runs is never a click away). Exactly ONE provider key is required
// (OpenAI by default, D-12) — a prominent MASKED field (Eye/EyeOff `***`) sits
// above the picker so the required key is never buried in Advanced overrides. The
// key + picker share the SAME `value.api_key`, so there is one source of truth.
//
// OTHER PROVIDERS (D-12): the remaining providers render as optional, skippable
// rows — each an @lobehub brand mark via `providerLogo` (Icon Convention §1,
// byte-identical to chat/registry) + a NEUTRAL "Not configured" chip (never red —
// a not-yet-added provider is a deliberate choice, not a fault). They are added
// later in Settings; the wizard only needs one working key to finalize.
//
// FLOW: on Continue the token-gated `postProviderKey()` persists the key through
// the Phase-150 encrypt-on-write seam (D-12 — the wizard inherits `enc:v1:`
// encryption for free), then the smoke step VERIFIES it (D-13). Continue is gated
// until the chosen provider has a non-empty key.
//
// SECURITY (T-158-10): the key is masked; no field renders it in full; there is NO
// raw-HTML injection sink anywhere (every value renders as plain React text).
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Eye, EyeOff, Loader2, Bot, Info } from "lucide-react"
import {
  ProviderPicker,
  EXTRACTION_PRESETS,
  type ProviderPickerValue,
} from "@/components/settings/ProviderPicker"
import { providerLogo } from "@/lib/providerLogo"
import { postProviderKey, SetupApiError } from "@/lib/setupApi"

/** The optional "other providers" shown as skippable, add-later rows — the curated
 *  cloud LLMs minus the "custom" catch-all (the selected one is filtered out live).
 *  Keys match `providerLogo` (Icon Convention §1) so each row carries its @lobehub
 *  brand mark. */
const OTHER_PROVIDER_ROWS: ReadonlyArray<{ key: string; name: string }> = [
  { key: "openai", name: "OpenAI" },
  { key: "anthropic", name: "Anthropic" },
  { key: "google", name: "Google" },
  { key: "openrouter", name: "OpenRouter" },
]

interface ProviderKeyStepProps {
  /** The setup token — persisting the key is a token-gated write (D-15). */
  token: string
  /** The primary provider selection + its key (host-owned; the smoke + finalize
   *  steps read `provider` + `api_key` from here). */
  value: ProviderPickerValue
  onChange: (next: ProviderPickerValue) => void
  /** Advance to the smoke step once the key is persisted. */
  onContinue: () => void
}

type PostState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "error"; message: string }

export function ProviderKeyStep({ token, value, onChange, onContinue }: ProviderKeyStepProps) {
  const [showKey, setShowKey] = useState(false)
  const [state, setState] = useState<PostState>({ kind: "idle" })

  const keyPresent = value.api_key.trim().length > 0
  const saving = state.kind === "saving"

  // The other-provider rows: everything in the curated set that ISN'T the chosen
  // primary provider — informational, skippable, added later in Settings.
  const otherRows = OTHER_PROVIDER_ROWS.filter((p) => p.key !== value.provider)

  async function handleContinue() {
    if (!keyPresent || saving) return
    setState({ kind: "saving" })
    try {
      await postProviderKey(token, { provider: value.provider, api_key: value.api_key })
      onContinue()
    } catch (err) {
      const message =
        err instanceof SetupApiError
          ? err.message
          : "Couldn't save the provider key. Check it and try again."
      setState({ kind: "error", message })
    }
  }

  return (
    <section aria-label="Connect your assistant model" className="space-y-5">
      <div>
        <h2 className="font-headline text-xl font-semibold text-foreground">Connect your assistant</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Paste one provider key to power the assistant. You can add more providers later in Settings.
        </p>
      </div>

      {/* The prominent REQUIRED masked key — above the picker so it is never buried
          in Advanced overrides. Shares `value.api_key` with the picker below. */}
      <div className="space-y-3 rounded-[10px] border border-border bg-card/40 p-4">
        <div className="space-y-1.5">
          <Label htmlFor="provider-api-key">API key</Label>
          <div className="relative flex items-center">
            <Input
              id="provider-api-key"
              type={showKey ? "text" : "password"}
              value={value.api_key}
              onChange={(e) => {
                onChange({ ...value, api_key: e.target.value })
                if (state.kind === "error") setState({ kind: "idle" })
              }}
              placeholder="Paste your provider API key"
              autoComplete="off"
              spellCheck={false}
              className="pr-9 font-mono text-xs"
            />
            <button
              type="button"
              onClick={() => setShowKey((s) => !s)}
              aria-label={showKey ? "Hide API key" : "Show API key"}
              className="absolute right-2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showKey ? (
                <EyeOff className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Eye className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
          <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <Info className="mt-0.5 h-3 w-3 flex-none" aria-hidden="true" />
            <span>We'll verify this key in the next step.</span>
          </p>
        </div>

        {/* REUSE the shipped ProviderPicker WHOLE — the preset select + the always-on
            🔒 endpoint footer (D-17). It shares `value` so the key above and the
            picker stay in lock-step. */}
        <ProviderPicker
          presets={EXTRACTION_PRESETS}
          value={value}
          onChange={onChange}
          title="Default assistant model"
          description="Pick the provider that powers the chat assistant."
        />
      </div>

      {/* Other providers — optional, skippable, add-later rows. Each carries its
          @lobehub brand mark (providerLogo, Icon Convention §1) + a NEUTRAL
          "Not configured" chip (never red — Pitfall 6). */}
      {otherRows.length > 0 && (
        <div className="space-y-2">
          <p className="text-[12px] font-semibold text-muted-foreground">Other providers (optional)</p>
          <ul className="space-y-1.5">
            {otherRows.map((p) => {
              const Mark = providerLogo(p.key)
              return (
                <li
                  key={p.key}
                  className="flex items-center gap-2.5 rounded-[10px] border border-border bg-card/30 px-3.5 py-2.5"
                >
                  <span className="flex h-5 w-5 flex-none items-center justify-center text-muted-foreground">
                    {Mark ? <Mark size={18} /> : <Bot className="h-4 w-4" aria-hidden="true" />}
                  </span>
                  <span className="flex-1 text-sm text-foreground">{p.name}</span>
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 flex-none rounded-full bg-muted-foreground/40"
                    />
                    Not configured
                  </span>
                </li>
              )
            })}
          </ul>
          <p className="text-[11px] text-muted-foreground">
            Add any of these anytime in Settings after setup — one key is enough to finish.
          </p>
        </div>
      )}

      {state.kind === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}

      <div className="space-y-1.5">
        <Button onClick={handleContinue} disabled={!keyPresent || saving} className="w-full sm:w-auto">
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> Saving…
            </>
          ) : (
            "Continue"
          )}
        </Button>
        {!keyPresent && (
          <p className="text-[11px] text-muted-foreground">
            Paste a key for your chosen provider to continue.
          </p>
        )}
      </div>
    </section>
  )
}
