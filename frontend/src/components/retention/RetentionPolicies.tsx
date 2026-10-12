/**
 * Phase 275 plan 04 (S1 Policies / S2) — the Policies sub-tab: the table, the empty state, and the
 * editor that replaces the body in place.
 *
 * Every column is the SERVER's text (`scope_text`, `kept_for_text`, `tonight`), and the sub line's
 * time comes from the configured cadence (`sweep_hour_utc`) — never hard-coded. Rows are buttons:
 * Enter or click opens the editor; `Back to policies` and a save return focus to that row.
 */
import { useCallback, useEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { listPolicies, type PolicyList, type RetentionPolicy } from "@/lib/api/retention"
import { AMBER_TEXT_CLASS, RETENTION_ACTION_META, RetentionChip, RichCopy } from "./RetentionChip"
import { RetentionPolicyEditor } from "./RetentionPolicyEditor"
import { RETENTION_COPY, fillCopy, formatRetentionDate } from "./retentionCopy"

const C = RETENTION_COPY

const NEW_BUTTON =
  "h-7 border border-primary/30 bg-primary/10 px-3 text-xs font-semibold text-[hsl(239_70%_50%)] hover:bg-primary/20 dark:text-primary"

/** `HH:00 UTC` from the server's configured sweep hour. */
export function sweepTimeText(hourUtc: number | null | undefined): string {
  if (hourUtc === null || hourUtc === undefined || Number.isNaN(hourUtc)) return "—"
  return `${String(hourUtc).padStart(2, "0")}:00 UTC`
}

function ThenTags({ p }: { p: RetentionPolicy }) {
  const one = RETENTION_ACTION_META[p.stage1_action] ?? RETENTION_ACTION_META.review
  const two = p.stage2_value != null ? RETENTION_ACTION_META.delete : null
  return (
    <span className="inline-flex flex-wrap gap-1">
      <RetentionChip tone={one.tone} icon={one.icon}>
        {one.label}
      </RetentionChip>
      {two && (
        <RetentionChip tone={two.tone} icon={two.icon}>
          {two.label}
        </RetentionChip>
      )}
    </span>
  )
}

function Tonight({ p }: { p: RetentionPolicy }) {
  const t = p.tonight
  if (!t) return <span className="text-muted-foreground">—</span>
  return (
    <div className="grid gap-0.5">
      <span>
        {t.due_now > 0 ? <RichCopy text={fillCopy(C.sketchTemplates.dueNow, { N: t.due_now })} /> : "—"}
        {t.undecidable > 0 && (
          <>
            {" "}
            <RetentionChip tone="undecidable">{fillCopy(C.sketchTemplates.undecidableCount, { N: t.undecidable })}</RetentionChip>
          </>
        )}
      </span>
      <span className="font-mono text-xs text-muted-foreground">
        {t.next_due ? fillCopy(C.sketchTemplates.nextDue, { date: formatRetentionDate(t.next_due) }) : C.ported.nothingElseDue}
      </span>
    </div>
  )
}

export function RetentionPolicies({
  sweepHourUtc,
  onRecorded,
}: {
  sweepHourUtc?: number | null
  onRecorded?: () => void
}) {
  const [list, setList] = useState<PolicyList | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [editing, setEditing] = useState<{ policy: RetentionPolicy | null } | null>(null)
  const returnFocus = useRef<string | null>(null)
  const alive = useRef(true)

  const load = useCallback(async () => {
    try {
      const res = await listPolicies()
      if (!alive.current) return
      setList(res)
      setLoadError(false)
    } catch {
      if (alive.current) setLoadError(true) // keep the last-known table
    }
  }, [])

  useEffect(() => {
    alive.current = true
    void load()
    return () => {
      alive.current = false
    }
  }, [load])

  // Return focus to the row (or button) that opened the editor.
  useEffect(() => {
    if (editing || !returnFocus.current) return
    const el = document.querySelector<HTMLElement>(`[data-return-focus="${returnFocus.current}"]`)
    el?.focus()
  }, [editing, list])

  const open = (policy: RetentionPolicy | null) => {
    returnFocus.current = policy ? policy.id : "new"
    setEditing({ policy })
  }

  if (editing) {
    return (
      <RetentionPolicyEditor
        policy={editing.policy}
        onBack={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          onRecorded?.()
          void load()
        }}
      />
    )
  }

  const policies = list?.policies ?? []

  return (
    <section className="grid gap-4 rounded-[10px] border border-border bg-card p-4" aria-busy={list === null && !loadError}>
      <header className="flex flex-wrap items-center gap-2">
        <h3 className="font-headline text-base font-semibold">{C.ported.tabPolicies}</h3>
        <span className="rounded-full bg-muted px-2 text-[11px] font-semibold text-muted-foreground">{policies.length}</span>
        <span className="flex-1" />
        <Button type="button" size="sm" className={NEW_BUTTON} data-return-focus="new" onClick={() => open(null)}>
          {C.ported.newPolicy}
        </Button>
      </header>
      <p className="text-xs text-muted-foreground" data-testid="policies-sub">
        {fillCopy(C.sketchTemplates.policiesSub, { time: sweepTimeText(sweepHourUtc) })}
      </p>

      {loadError && (
        <p role="alert" className={`text-sm ${AMBER_TEXT_CLASS}`}>
          {C.contract.loadFailed}{" "}
          <button type="button" className="underline" onClick={() => void load()}>
            {C.contract.tryAgain}
          </button>
        </p>
      )}

      {list !== null && policies.length === 0 ? (
        <div className="py-12 text-center">
          <p className="font-headline text-base font-semibold">{C.contract.policiesEmptyTitle}</p>
          <p className="mt-1 text-sm text-muted-foreground">{C.contract.policiesEmptyBody}</p>
          <Button type="button" size="sm" className={`mt-4 ${NEW_BUTTON}`} onClick={() => open(null)}>
            {C.ported.newPolicy}
          </Button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs font-semibold uppercase tracking-[0.05em] text-muted-foreground">
                <th className="px-2 py-2">{C.ported.colName}</th>
                <th className="px-2 py-2">{C.ported.colAppliesTo}</th>
                <th className="px-2 py-2">{C.ported.colKeptFor}</th>
                <th className="px-2 py-2">{C.ported.colThen}</th>
                <th className="px-2 py-2">{C.ported.colTonight}</th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr
                  key={p.id}
                  role="button"
                  tabIndex={0}
                  data-return-focus={p.id}
                  aria-label={p.name}
                  className="cursor-pointer border-b border-border/60 align-top hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  onClick={() => open(p)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") open(p)
                  }}
                >
                  <td className="px-2 py-2 font-semibold text-foreground">{p.name}</td>
                  <td className="px-2 py-2 text-muted-foreground">{p.scope_text}</td>
                  <td className="px-2 py-2 text-muted-foreground">{p.kept_for_text}</td>
                  <td className="px-2 py-2">
                    <ThenTags p={p} />
                  </td>
                  <td className="px-2 py-2">
                    <Tonight p={p} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
