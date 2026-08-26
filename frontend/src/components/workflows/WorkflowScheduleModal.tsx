/**
 * Phase 204 (SCHED-01 / D-204-11) — the schedule dialog.
 *
 * One workflow's schedules: the ones that exist (with what each one will do next), and a form
 * to add another. The shell is `library/RunModal.tsx`'s, verbatim in shape — fixed overlay,
 * `role="dialog" aria-modal`, a focus trap, Escape to leave, a header with a truncating title
 * and a ✕ — because this product already has ONE dialog silhouette and a second one would be
 * a new silhouette, not a new dialog.
 *
 * ⚠ **IT STATES WHAT A SCHEDULE WILL COST BEFORE IT IS CREATED, NOT AFTERWARDS.** The two caps
 * are fields on the form rather than defaults buried in the API, because a schedule is the one
 * place in this product where a person authorises spending they will not be present to watch.
 * A cap the author never saw is a cap they never chose.
 *
 * ⚠ **IT NEVER FABRICATES A "NEXT RUN".** `next_run_at` is the SERVER's answer — computed by
 * the same `compute_next_run_at` the claimer uses — and this component renders it or renders
 * nothing. Computing a preview here would need a second cron implementation in the browser,
 * and two implementations of "when does this fire" is exactly how a schedule comes to fire at
 * one instant and be described as firing at another.
 *
 * ⚠ **THE REFUSALS ARE THE SERVER'S OWN SENTENCES.** `lib/api.ts:readScheduleFailure` pulls
 * `detail` (and the first pydantic `msg` out of a 422 array) so a malformed cron says what is
 * wrong with it. A generic "Something went wrong" here would discard the one fact the person
 * needs, and this product has a written rule against exactly that shape.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { AlertTriangle, Loader2, Play, Trash2, X } from "lucide-react"

import {
  createWorkflowSchedule,
  deleteSchedule,
  getEffectiveFeaturesPayload,
  listWorkflowSchedules,
  triggerSchedule,
  updateSchedule,
} from "@/lib/api"
import type { ScheduleCadenceKind, WorkflowSchedule } from "@/types/schedule"

export interface WorkflowScheduleModalProps {
  /** The workflow being scheduled. `id` is its definition id; `name` is what the header says. */
  workflow: { id: string; name: string }
  onClose: () => void
  /** Fired after any create/delete/toggle so a caller can refresh a badge if it has one. */
  onChanged?: (schedules: WorkflowSchedule[]) => void
}

/** Presets, so the common cases need no cron literacy — and a free-text escape for the rest. */
const CRON_PRESETS: ReadonlyArray<{ label: string; expr: string }> = [
  { label: "Every hour", expr: "0 * * * *" },
  { label: "Every day at 03:00", expr: "0 3 * * *" },
  { label: "Every weekday at 08:00", expr: "0 8 * * 1-5" },
  { label: "Every Monday at 08:00", expr: "0 8 * * 1" },
  { label: "The 1st of each month at 06:00", expr: "0 6 1 * *" },
]

/** Interval choices. The floor is 60s in three places (the model, the CHECK, and here). */
const INTERVAL_CHOICES: ReadonlyArray<{ label: string; seconds: number }> = [
  { label: "Every 15 minutes", seconds: 900 },
  { label: "Every 30 minutes", seconds: 1800 },
  { label: "Every hour", seconds: 3600 },
  { label: "Every 6 hours", seconds: 21600 },
  { label: "Every day", seconds: 86400 },
]

/** The browser's own zone, so the default is the one the author is thinking in. */
function localZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"
  } catch {
    return "UTC"
  }
}

/** Render an instant, or `null` when there is nothing to say. Absence is never a dash. */
function whenText(iso: string | null | undefined): string | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.toLocaleString()
}

/** The cadence, in words. Reads the ROW, never a form value. */
function cadenceText(s: WorkflowSchedule): string {
  if (s.cron_expression) return `${s.cron_expression} (${s.timezone})`
  if (s.interval_seconds) {
    const known = INTERVAL_CHOICES.find((c) => c.seconds === s.interval_seconds)
    return known ? known.label : `Every ${s.interval_seconds} seconds`
  }
  // Unreachable while the CHECK holds; said honestly rather than rendered as blank.
  return "No cadence recorded"
}

export function WorkflowScheduleModal({
  workflow,
  onClose,
  onChanged,
}: WorkflowScheduleModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  const [schedules, setSchedules] = useState<WorkflowSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [schedulerEnabled, setSchedulerEnabled] = useState<boolean | null>(null)

  const [name, setName] = useState("")
  const [kind, setKind] = useState<ScheduleCadenceKind>("cron")
  const [cron, setCron] = useState(CRON_PRESETS[1].expr)
  const [intervalSeconds, setIntervalSeconds] = useState(INTERVAL_CHOICES[2].seconds)
  const [timezone, setTimezone] = useState(localZone)
  const [maxTokens, setMaxTokens] = useState(500000)
  const [maxDuration, setMaxDuration] = useState(1800)
  const [kickoff, setKickoff] = useState("")

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const [rows, featuresPayload] = await Promise.all([
        listWorkflowSchedules(workflow.id),
        getEffectiveFeaturesPayload().catch(() => null),
      ])
      setSchedules(rows)
      if (featuresPayload && typeof featuresPayload.scheduler_process_enabled === "boolean") {
        setSchedulerEnabled(featuresPayload.scheduler_process_enabled)
      }
      setLoadFailed(false)
      onChanged?.(rows)
    } catch {
      // ⚠ An empty list and a failed read are DIFFERENT CLAIMS, and only one of them is ours
      // to make. Without this flag the failure path renders "No schedules yet" — an
      // affirmative statement about the user's own data, made from evidence we do not have.
      setLoadFailed(true)
    } finally {
      setLoading(false)
    }
  }, [workflow.id, onChanged])

  useEffect(() => {
    void refresh()
  }, [refresh])

  // Escape + focus trap — `RunModal`'s, unchanged in behaviour.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) {
        onClose()
        return
      }
      if (e.key !== "Tab") return
      const root = dialogRef.current
      if (!root) return
      const focusables = root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), textarea, select, [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement as HTMLElement | null
      if (e.shiftKey && active === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && active === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [onClose, busy])

  const canSubmit = useMemo(
    () => name.trim().length > 0 && (kind === "cron" ? cron.trim().length > 0 : intervalSeconds >= 60),
    [name, kind, cron, intervalSeconds],
  )

  async function withBusy(work: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await work()
    } catch (e) {
      // The server's own sentence, never a house style. See the module docblock.
      setError(e instanceof Error ? e.message : "The request was refused")
    } finally {
      setBusy(false)
    }
  }

  const onCreate = () =>
    withBusy(async () => {
      await createWorkflowSchedule(workflow.id, {
        name: name.trim(),
        // ⚠ EXACTLY ONE cadence goes on the wire. Sending both is a 422 by design, and
        // sending the unused one as `null` rather than omitting it keeps that explicit.
        cron_expression: kind === "cron" ? cron.trim() : null,
        interval_seconds: kind === "interval" ? intervalSeconds : null,
        timezone,
        max_tokens_per_run: maxTokens,
        max_duration_seconds: maxDuration,
        inputs: kickoff.trim() ? { kickoff_prompt: kickoff.trim() } : {},
      })
      setName("")
      setKickoff("")
      await refresh()
    })

  const onToggle = (s: WorkflowSchedule) =>
    withBusy(async () => {
      await updateSchedule(s.id, { is_active: !s.is_active })
      await refresh()
    })

  const onRemove = (s: WorkflowSchedule) =>
    withBusy(async () => {
      await deleteSchedule(s.id)
      await refresh()
    })

  const onRunNow = (s: WorkflowSchedule) =>
    withBusy(async () => {
      const result = await triggerSchedule(s.id)
      // ⚠ `launched: false` is a real answer with a reason, not an error. Saying "failed"
      // would hide the one fact that tells the person what to do next.
      setNotice(
        result.launched
          ? "Started. It runs in the background — open the run log to watch it."
          : result.detail || "It did not start.",
      )
      await refresh()
    })

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`Schedules for ${workflow.name}`}
      data-testid="schedule-modal"
      className="fixed inset-0 z-[9000] grid place-items-center bg-black/60 p-6 backdrop-blur-sm"
    >
      <div className="max-h-[88vh] w-[min(620px,94%)] overflow-y-auto rounded-lg border border-border bg-card shadow-lg">
        <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-3">
          <span className="min-w-0 truncate text-[17px] font-semibold text-foreground">
            Schedules — {workflow.name}
          </span>
          <button
            type="button"
            data-testid="schedule-modal-close"
            aria-label="Close"
            disabled={busy}
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex flex-col gap-6 p-6">
          {schedulerEnabled === false && (
            <div
              role="status"
              data-testid="scheduler-inactive-warning"
              className="flex items-start gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-[12px] text-amber-200"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" aria-hidden="true" />
              <div>
                <span className="font-semibold text-amber-100">Scheduler daemon is inactive</span>
                <p className="mt-0.5 leading-relaxed text-amber-200/90">
                  Automations scheduler daemon is inactive on this installation. Schedules will not execute
                  automatically on cadence unless the scheduler process is enabled or triggered manually.
                </p>
              </div>
            </div>
          )}

          {/* ── what already exists ─────────────────────────────────────────────── */}
          <section className="flex flex-col gap-2">
            <h3 className="text-[13px] font-medium text-foreground">Existing schedules</h3>
            {loading ? (
              <p className="text-[13px] italic text-muted-foreground">Loading…</p>
            ) : loadFailed ? (
              <p data-testid="schedule-load-failed" className="text-[13px] italic text-muted-foreground">
                We could not load this workflow&apos;s schedules.
              </p>
            ) : schedules.length === 0 ? (
              <p data-testid="schedule-empty" className="text-[13px] italic text-muted-foreground">
                Nothing is scheduled yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-2" data-testid="schedule-list">
                {schedules.map((s) => {
                  const next = whenText(s.next_run_at)
                  const last = whenText(s.last_run_at)
                  return (
                    <li
                      key={s.id}
                      data-testid="schedule-row"
                      data-active={s.is_active ? "true" : "false"}
                      className="flex items-start justify-between gap-3 rounded-md border border-border p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-foreground">{s.name}</p>
                        <p className="truncate text-[12px] text-muted-foreground">{cadenceText(s)}</p>
                        {/* Absence renders NOTHING — never a dash, never "—". A schedule that
                            has not run yet and one whose time we failed to read are two
                            different facts and neither is "-". */}
                        {s.is_active && next ? (
                          <p className="truncate text-[12px] text-muted-foreground">Next: {next}</p>
                        ) : null}
                        {last ? (
                          <p className="truncate text-[12px] text-muted-foreground">
                            Last ran: {last}
                            {s.last_status ? ` · ${s.last_status}` : ""}
                          </p>
                        ) : null}
                        {!s.is_active ? (
                          <p className="text-[12px] text-muted-foreground">Paused — it will not run.</p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          data-testid="schedule-run-now"
                          disabled={busy}
                          onClick={() => void onRunNow(s)}
                          title="Run now (this does not change the cadence)"
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                        >
                          <Play className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="sr-only">Run now</span>
                        </button>
                        <button
                          type="button"
                          data-testid="schedule-toggle"
                          disabled={busy}
                          onClick={() => void onToggle(s)}
                          className="rounded-md border border-border px-2 py-1 text-[12px] text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                        >
                          {s.is_active ? "Pause" : "Resume"}
                        </button>
                        <button
                          type="button"
                          data-testid="schedule-delete"
                          disabled={busy}
                          onClick={() => void onRemove(s)}
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-destructive disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span className="sr-only">Delete schedule</span>
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          {/* ── add one ─────────────────────────────────────────────────────────── */}
          <section className="flex flex-col gap-3 border-t border-border pt-4">
            <h3 className="text-[13px] font-medium text-foreground">Add a schedule</h3>

            <label className="flex flex-col gap-1">
              <span className="text-[12px] text-muted-foreground">Name</span>
              <input
                data-testid="schedule-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Monday morning report"
                className="rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground"
              />
            </label>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-[12px] text-muted-foreground">How often</legend>
              <div className="flex gap-3">
                {(["cron", "interval"] as const).map((k) => (
                  <label key={k} className="flex items-center gap-1.5 text-[13px] text-foreground">
                    <input
                      type="radio"
                      name="cadence-kind"
                      data-testid={`schedule-kind-${k}`}
                      checked={kind === k}
                      onChange={() => setKind(k)}
                    />
                    {k === "cron" ? "At a set time" : "Every so often"}
                  </label>
                ))}
              </div>

              {kind === "cron" ? (
                <div className="flex flex-col gap-2">
                  <select
                    data-testid="schedule-cron-preset"
                    value={CRON_PRESETS.some((p) => p.expr === cron) ? cron : ""}
                    onChange={(e) => e.target.value && setCron(e.target.value)}
                    className="rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground"
                  >
                    <option value="">Custom…</option>
                    {CRON_PRESETS.map((p) => (
                      <option key={p.expr} value={p.expr}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                  <input
                    data-testid="schedule-cron"
                    value={cron}
                    onChange={(e) => setCron(e.target.value)}
                    spellCheck={false}
                    className="rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[13px] text-foreground"
                  />
                  <label className="flex flex-col gap-1">
                    <span className="text-[12px] text-muted-foreground">
                      Time zone — the schedule fires by this clock, not the server&apos;s
                    </span>
                    <input
                      data-testid="schedule-timezone"
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      spellCheck={false}
                      className="rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground"
                    />
                  </label>
                </div>
              ) : (
                <select
                  data-testid="schedule-interval"
                  value={intervalSeconds}
                  onChange={(e) => setIntervalSeconds(Number(e.target.value))}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground"
                >
                  {INTERVAL_CHOICES.map((c) => (
                    <option key={c.seconds} value={c.seconds}>
                      {c.label}
                    </option>
                  ))}
                </select>
              )}
            </fieldset>

            <label className="flex flex-col gap-1">
              <span className="text-[12px] text-muted-foreground">
                Starting instruction (optional) — what each run is asked to do
              </span>
              <textarea
                data-testid="schedule-kickoff"
                value={kickoff}
                onChange={(e) => setKickoff(e.target.value)}
                rows={2}
                className="rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground"
              />
            </label>

            {/* ⚠ THE CAPS ARE ON THE FORM, NOT IN A DEFAULT. See the module docblock: this is
                the one place a person authorises spending they will not be present to watch. */}
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[12px] text-muted-foreground">Token budget per run</span>
                <input
                  type="number"
                  min={1}
                  data-testid="schedule-max-tokens"
                  value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] text-muted-foreground">Time limit per run (seconds)</span>
                <input
                  type="number"
                  min={1}
                  data-testid="schedule-max-duration"
                  value={maxDuration}
                  onChange={(e) => setMaxDuration(Number(e.target.value))}
                  className="rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground"
                />
              </label>
            </div>

            {error ? (
              <p data-testid="schedule-error" role="alert" className="text-[12px] text-destructive">
                {error}
              </p>
            ) : null}
            {notice ? (
              <p data-testid="schedule-notice" className="text-[12px] text-muted-foreground">
                {notice}
              </p>
            ) : null}

            <div className="flex justify-end">
              <button
                type="button"
                data-testid="schedule-create"
                disabled={busy || !canSubmit}
                onClick={() => void onCreate()}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : null}
                Add schedule
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
