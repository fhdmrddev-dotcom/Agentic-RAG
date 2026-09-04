/**
 * The Connections home — a top-level page, not a Settings tab.
 *
 * ⚠ WHY THIS EXISTS AS ITS OWN PAGE, because the history matters and the previous
 * arrangement was a deliberate compromise rather than an accident:
 *
 * Connections shipped as Settings tab "5" (Phase 190-16). On 2026-08-31 the nav entry
 * `Settings` was found to be tagged `model_management` — Operators-only per
 * `api/features.py:21` — so `visibleNavItems` dropped it for every member and took the
 * whole connections surface of Phases 211-216 with it. The fix (`235a0f9ff`) added an
 * UNGOVERNED `Connections` rail entry that mounted `<SettingsPage initialTab="5" />`.
 *
 * That fixed the member and created the operator: an operator saw BOTH rail entries, and
 * both opened the same page with the same full tab strip — the destinations differed only
 * by which tab was pre-selected. `ChatLayout`'s own comment conceded it: *"`initialTab` is
 * a pin, not a lock"*.
 *
 * So the surface moves out instead. One rail entry, one destination, and the member fix
 * becomes STRUCTURAL rather than incidental: connections no longer live inside a page
 * whose own `GET`/`PUT /settings` carry `require_visible("model_management")`
 * (`api/settings.py:331,341`). `ConnectionsTab` fetches its own rows through
 * `listConnectorConnections()` (`:1397`) and needs neither endpoint — it always could,
 * which is why the pin worked at all.
 *
 * ⚠ UNGOVERNED BY DESIGN, NOT BY OMISSION — the reasoning is carried over verbatim from
 * `nav-items.ts`: a connection is a per-user asset, like a thread. If connections ever
 * need governing they get their OWN feature key, never `model_management`, whose audience
 * is about models.
 *
 * ⚠ THE COPY IS REUSED, NOT REWRITTEN. `CONNECTIONS_SECTION_TITLE` and
 * `CONNECTIONS_SECTION_DESCRIPTION` are the same two strings the Settings card used, now
 * carried by the page header. No new words are invented here; `connectionsCopy.ts` stays
 * the single source, so a change to the sentence still lands in one file.
 *
 * ⚠ ONE VISUAL DELTA, RECORDED RATHER THAN SMUGGLED: the `SectionCard` wrapper is gone.
 * On a dedicated page an `<h1>Connections</h1>` above a card *titled* "Connections" is the
 * same word twice, so the card's chrome was dropped and its two strings promoted into the
 * page header — which is the shape `SettingsPage` already uses for its own header. The
 * table inside is untouched. If a card frame is wanted back, that is a design call and it
 * belongs in a sketch, not here.
 */
import { ConnectionsTab } from "@/components/settings/ConnectionsTab"
import {
  CONNECTIONS_SECTION_DESCRIPTION,
  CONNECTIONS_SECTION_TITLE,
} from "@/components/settings/connectionsCopy"

export function ConnectionsPage() {
  return (
    /* The shell matches SettingsPage's exactly — `max-w-6xl` is the measure Phase 212
       adopted specifically BECAUSE of this table's five columns (Connection · Sends to ·
       Used by · Credential · State). Narrowing it here would re-break what that widening
       fixed. */
    <div className="flex flex-col h-full overflow-y-auto p-8">
      <div className="max-w-6xl w-full mx-auto space-y-8">
        <div>
          <h1 className="text-2xl font-headline font-bold text-foreground">
            {CONNECTIONS_SECTION_TITLE}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {CONNECTIONS_SECTION_DESCRIPTION}
          </p>
        </div>

        <ConnectionsTab />
      </div>
    </div>
  )
}
