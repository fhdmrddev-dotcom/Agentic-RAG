/**
 * Phase 118 Plan 06 Task 2 — ClassificationRulesPage (CLASS-01 / UX-01). Locked G-2
 * sketch = sketches/037-rule-builder-and-list (Winner A — the rules list + a right-side
 * push/split builder).
 *
 * The dedicated Classification-rules surface reached from the sidebar "Automation"
 * group (App.tsx ActiveView "classification-rules", routed by Plan 04). It composes:
 *  - the rules list (the AutomationGroup row anatomy 037-A — ● name [G] · condition →
 *    📁 action · toggle · ⋯) from listRules();
 *  - the RuleBuilderPanel (Task 1) opened in the SAME right-side push/split panel the
 *    app uses for document detail (027/112) — `minmax(0,1fr) <panel>`, NO router, a
 *    straight React state-switch — on "New rule" / Edit.
 *
 * Honest states: loading (role=status) ≠ error (role=alert + retry) ≠ a calm empty.
 * Re-fetch-not-optimistic after a save/toggle/delete (listRules reconcile).
 *
 * UX-01: Deep Midnight / Aether, mobile-responsive (the builder collapses to a
 * full-width column below the breakpoint), WCAG 2.1 AA.
 */
import { useCallback, useEffect, useMemo, useState } from "react"
import { Plus } from "lucide-react"
import { AutomationGroup } from "../ingestion/AutomationGroup"
import { RuleBuilderPanel } from "./RuleBuilderPanel"
import { listRules, listFolders, listMetadataFields } from "@/lib/api"
import type { ClassificationRule, Folder, MetadataFieldDef } from "@/types"

type LoadState = "loading" | "ready" | "error"

// 768px = the app's mobile breakpoint (mirrors IngestionPage). On the rules page it
// collapses the push/split grid to a single full-width column so the list + builder
// never get crushed side-by-side on a phone.
const MOBILE_BREAKPOINT = 768

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT,
  )
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    onResize()
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])
  return isMobile
}

// The builder panel is open either composing a NEW rule or editing an EXISTING one.
type BuilderState = { mode: "new" } | { mode: "edit"; rule: ClassificationRule } | null

export function ClassificationRulesPage() {
  const isMobile = useIsMobile()

  const [rules, setRules] = useState<ClassificationRule[]>([])
  const [state, setState] = useState<LoadState>("loading")
  const [folders, setFolders] = useState<Folder[]>([])
  const [customFields, setCustomFields] = useState<MetadataFieldDef[]>([])
  const [builder, setBuilder] = useState<BuilderState>(null)

  const loadRules = useCallback(async () => {
    setState("loading")
    try {
      const data = await listRules()
      setRules(data)
      setState("ready")
    } catch {
      setState("error")
    }
  }, [])

  useEffect(() => {
    void loadRules()
    // Folders (the builder's 📁 action options) + custom fields (the condition
    // popover) load alongside; a failure degrades to an empty option set, never a
    // page error.
    listFolders().then(setFolders).catch(() => setFolders([]))
    listMetadataFields().then(setCustomFields).catch(() => setCustomFields([]))
  }, [loadRules])

  // id → folder name for the AutomationGroup → folder action label.
  const folderNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const f of folders) map[f.id] = f.name
    return map
  }, [folders])

  // ── Builder open/close + list reconcile (re-fetch-not-optimistic) ────────────
  const handleNewRule = useCallback(() => setBuilder({ mode: "new" }), [])
  const handleEditRule = useCallback(
    (rule: ClassificationRule) => setBuilder({ mode: "edit", rule }),
    [],
  )
  const handleCancelBuilder = useCallback(() => setBuilder(null), [])

  const handleSaved = useCallback(() => {
    setBuilder(null)
    void loadRules() // re-fetch authoritative list (not an optimistic splice)
  }, [loadRules])

  const handleToggled = useCallback((updated: ClassificationRule) => {
    setRules((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))
  }, [])

  const handleDeleted = useCallback(
    (id: string) => {
      setRules((prev) => prev.filter((r) => r.id !== id))
      // If the deleted rule was open in the builder, close it.
      setBuilder((cur) =>
        cur && cur.mode === "edit" && cur.rule.id === id ? null : cur,
      )
    },
    [],
  )

  const panelOpen = builder !== null

  return (
    <div className="flex h-full flex-col overflow-hidden p-8">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-headline font-bold text-foreground">
            Classification rules
          </h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Suggest a folder for matching uploads — never a silent move. You accept or
            dismiss each suggestion on the document.
          </p>
        </div>
        <button
          type="button"
          onClick={handleNewRule}
          aria-label="New rule"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground transition-[filter] hover:brightness-110 focus:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        >
          <Plus className="h-4 w-4" />
          New rule
        </button>
      </div>

      <div
        className="grid min-h-0 flex-1 gap-6"
        style={{
          gridTemplateColumns:
            !isMobile && panelOpen ? "minmax(0,1fr) 430px" : "minmax(0,1fr)",
        }}
      >
        {/* Rules list column. */}
        <div className="min-w-0 overflow-y-auto rounded-xl bg-card/50 ghost-border p-4">
          {state === "loading" && (
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 py-8 text-sm text-muted-foreground"
            >
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              Loading rules…
            </div>
          )}

          {state === "error" && (
            <div role="alert" className="flex flex-col items-start gap-2 py-8">
              <p className="text-sm text-destructive">Couldn&rsquo;t load your rules.</p>
              <button
                type="button"
                onClick={() => void loadRules()}
                className="text-xs text-primary hover:underline focus:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded"
              >
                Try again
              </button>
            </div>
          )}

          {state === "ready" && (
            <AutomationGroup
              rules={rules}
              onEditRule={handleEditRule}
              onToggled={handleToggled}
              onDeleted={handleDeleted}
              folderNames={folderNames}
            />
          )}
        </div>

        {/* Right-side push/split builder panel (state-switch, no router). On mobile
            the grid is a single column, so the builder stacks below the list. */}
        {panelOpen && builder && (
          <div className="min-h-0 min-w-0">
            <RuleBuilderPanel
              folders={folders}
              customFields={customFields}
              rule={builder.mode === "edit" ? builder.rule : null}
              onSaved={handleSaved}
              onCancel={handleCancelBuilder}
            />
          </div>
        )}
      </div>
    </div>
  )
}

export default ClassificationRulesPage
