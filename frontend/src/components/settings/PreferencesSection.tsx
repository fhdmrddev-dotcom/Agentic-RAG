import { ModelDefaultPreference } from "@/components/settings/ModelDefaultPreference"
import { EmailNotificationPreference } from "@/components/settings/EmailNotificationPreference"
import { TechnicalNamesToggle } from "@/components/admin/TechnicalNamesToggle"
import { useTechnicalNames } from "@/providers/TechnicalNamesProvider"

/**
 * Phase 283 (FIX-01 / BUG-261004-02, D-02) — the Preferences tab body: a member's personal
 * preferences, in ONE home every caller can reach.
 *
 * Both blocks below moved here BYTE-IDENTICAL from the AI Model tab of `pages/SettingsPage.tsx`.
 * They were placed there by Phase 154 (the technical-names reveal) and Phase 167 (the default chat
 * model) on the premise that every user could reach that tab — which stopped being true when Phase
 * 148 gated AI Model on `model_management`. Since then only operators could flip either one.
 *
 * ⛔ CALLS NO `model_management`-GATED ENDPOINT (D-07). The technical-names toggle is the shared
 *   `TechnicalNamesProvider` context (localStorage), and `ModelDefaultPreference` self-fetches and
 *   self-persists through the ungated, RLS-scoped `/me/preferences`. Keep it that way: this tab is
 *   rendered to members, and a gated call here is a 403 on every visit.
 *
 * No section heading — the tab label is the heading (283-UI-SPEC).
 */
export function PreferencesSection() {
  const { showTechnical, toggle: toggleTechnical } = useTechnicalNames()

  return (
    <>
      <div className="flex items-center justify-between gap-4 rounded-lg ghost-border bg-muted/20 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Show technical names</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Reveal the raw field, model, and status names alongside the plain labels — everywhere in the app.
          </p>
        </div>
        <TechnicalNamesToggle enabled={showTechnical} onToggle={toggleTechnical} />
      </div>

      <ModelDefaultPreference />

      {/* 300-05 (D-09): the member's own run-waiting email switch, ungated /me/preferences only. */}
      <EmailNotificationPreference />
    </>
  )
}
