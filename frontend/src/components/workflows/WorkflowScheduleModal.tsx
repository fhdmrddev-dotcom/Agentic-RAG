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

// BUG-260829-01 — the cron composer and the plain-language echo. A pure module rather than
// locals here for the reason every sibling vocabulary file records: a component may not export
// shared constants (`react-refresh/only-export-components`), and the grammar is testable on its
// own in a way a JSX-embedded regex is not.
import {
  CRON_FIELD_ORDER,
  CRON_MEANS_PREFIX,
  CRON_UNREADABLE,
  DAILY_TIME_LABEL,
  dailyCron,
  describeCron,
  timeOfDailyCron,
} from "@/components/workflows/cronPlain"

import {
  createWorkflowSchedule,
  deleteSchedule,
  getEffectiveFeaturesPayload,
  listWorkflowSchedules,
  triggerSchedule,
  updateSchedule,
} from "@/lib/api"
import type { ScheduleCadenceKind, ScheduleTriggerResult, WorkflowSchedule } from "@/types/schedule"
import {
  launchInputFields,
  missingRequiredFields,
  requiredFieldsMessage,
  type DefShape,
} from "@/components/workflows/soulData"
// 300-01 (D-15 / D-26): the row's last outcome, in words. A zero-import leaf.
import { scheduleOutcomeLine, type ScheduleOutcomeTone } from "@/components/workflows/scheduleOutcomeVocabulary"

export interface WorkflowScheduleModalProps {
  /** The workflow being scheduled. `id` is its definition id; `name` is what the header says. */
  workflow: { id: string; name: string }
  /**
   * Phase 214-09 (STEP-02 / D-214-04) — the workflow's definition, for its DECLARED entry
   * inputs and nothing else.
   *
   * ⚠ OPTIONAL, AND ITS ABSENCE IS A REAL STATE RATHER THAN A DEFAULT. A caller that does not
   * hold the definition (this modal shipped with a `{ id, name }` scope and nothing more)
   * renders the form exactly as it shipped: no field region, and a payload byte-identical to
   * today's. It is NOT fetched here — this component reads the schedule list and the feature
   * payload, and adding a definition read would give it a third feed for a presentation fact
   * its caller already has in hand.
   */
  definition?: DefShape | null
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

/** 296-04 (BUG-261025-01): the Run now result, shown on the row that was pressed. */
const RUN_NOW_STARTED = "Started. It runs in the background — open the run log to watch it."
type RunNowTone = "success" | "warning" | "error"
interface RunNowResult {
  scheduleId: string
  tone: RunNowTone
  text: string
}
const RUN_NOW_TONE: Record<RunNowTone, string> = {
  success: "text-foreground",
  warning: "text-[hsl(var(--warning))]",
  error: "text-[hsl(0_80%_80%)]",
}

/** Read the trigger result into one row-local line. `detail` is the server's sentence, verbatim.
 *  An older backend sends no `outcome`: launched reads success, anything else the error tone. */
function runNowResult(scheduleId: string, r: ScheduleTriggerResult): RunNowResult {
  const outcome = r.outcome ?? (r.launched ? "launched" : "error")
  if (outcome === "launched") return { scheduleId, tone: "success", text: RUN_NOW_STARTED }
  const text = r.detail || "It did not start."
  return { scheduleId, tone: outcome === "error" ? "error" : "warning", text }
}

/** 300-01 (D-15): the outcome line's tone, from the shipped Run now tones (muted is the row's). */
const OUTCOME_TONE: Record<ScheduleOutcomeTone, string> = {
  muted: "text-muted-foreground",
  warning: RUN_NOW_TONE.warning,
  error: RUN_NOW_TONE.error,
}

/** 300-01 (D-14): the schedule doors' structured blank-input refusal. Read by its CODE off the
 *  thrown error (`ScheduleRefusalError` in `lib/api/schedules.ts`) rather than by importing the
 *  class, so no suite that mocks `@/lib/api` has to carry a new name. Never by matching words. */
function isMissingRequired(e: unknown): e is Error {
  return e instanceof Error && (e as { code?: unknown }).code === "missing_required"
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
  definition,
  onClose,
  onChanged,
}: WorkflowScheduleModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null)

  const [schedules, setSchedules] = useState<WorkflowSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 300-01 (D-16): the rows being started, and each row's own result line (keyed by schedule
  // id). Starting B never erases A's line; a line clears when its own row is pressed again, and
  // the whole map goes with the dialog when it closes (unmount).
  const [runningIds, setRunningIds] = useState<ReadonlySet<string>>(() => new Set())
  const [runResults, setRunResults] = useState<Readonly<Record<string, RunNowResult>>>({})
  // 300-01 (D-16): "Loading…" replaces the list only before any list has been shown; every later
  // refresh keeps the list in place and marks the <ul> aria-busy instead.
  const listShown = useRef(false)
  const [refetching, setRefetching] = useState(false)
  // 296-04 (287-SCHED): the refusal for an empty required launch input, under the inputs.
  const [requiredRefusal, setRequiredRefusal] = useState<string | null>(null)
  const [schedulerEnabled, setSchedulerEnabled] = useState<boolean | null>(null)

  const [name, setName] = useState("")
  const [kind, setKind] = useState<ScheduleCadenceKind>("cron")
  const [cron, setCron] = useState(CRON_PRESETS[1].expr)
  const [intervalSeconds, setIntervalSeconds] = useState(INTERVAL_CHOICES[2].seconds)
  const [timezone, setTimezone] = useState(localZone)
  const [maxTokens, setMaxTokens] = useState(500000)
  const [maxDuration, setMaxDuration] = useState(1800)
  const [kickoff, setKickoff] = useState("")
  // ── 214-09 (STEP-02 / D-214-04): the DECLARED entry inputs this schedule must supply ──
  //
  // ⚠ THE SAME RESOLVER THE LIBRARY RUN MODAL USES, NOT A SECOND COPY OF THE RULE.
  // `launchInputFields` is `entryInputFields` minus the reserved run-scaffolding keys
  // (`kickoff_prompt`, `folder_id`) — so this form cannot drift from that one, and the
  // "two arms, never three" label rule below is the same rule rendered on a second surface.
  // An absent `definition`, or a definition declaring nothing, gives `[]` → no field region.
  const launchFields = useMemo(() => launchInputFields(definition ?? null), [definition])
  const [inputValues, setInputValues] = useState<Record<string, string>>({})

  const refresh = useCallback(async () => {
    const quiet = listShown.current
    if (quiet) setRefetching(true)
    else setLoading(true)
    try {
      const [rows, featuresPayload] = await Promise.all([
        listWorkflowSchedules(workflow.id),
        getEffectiveFeaturesPayload().catch(() => null),
      ])
      setSchedules(rows)
      listShown.current = true
      if (featuresPayload && typeof featuresPayload.scheduler_process_enabled === "boolean") {
        setSchedulerEnabled(featuresPayload.scheduler_process_enabled)
      }
      setLoadFailed(false)
      onChanged?.(rows)
    } catch {
      // ⚠ An empty list and a failed read are DIFFERENT CLAIMS, and only one of them is ours
      // to make. Without this flag the failure path renders "No schedules yet" — an
      // affirmative statement about the user's own data, made from evidence we do not have.
      // 300-01 (D-16): a failed QUIET refetch keeps the list already shown (the last answer
      // the server gave) rather than swapping it for the failure line.
      if (!quiet) setLoadFailed(true)
    } finally {
      setLoading(false)
      setRefetching(false)
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
    try {
      await work()
    } catch (e) {
      // The server's own sentence, never a house style. See the module docblock.
      setError(e instanceof Error ? e.message : "The request was refused")
    } finally {
      setBusy(false)
    }
  }

  const onCreate = () => {
    // 296-04 (287-SCHED): refuse with words before anything is sent; the button stays enabled.
    const missing = missingRequiredFields(launchFields, inputValues)
    if (missing.length > 0) {
      setRequiredRefusal(requiredFieldsMessage(missing))
      return
    }
    setRequiredRefusal(null)
    return withBusy(async () => {
      // ── 214-09 (STEP-02 / D-214-04): the schedule's `inputs` dict stops being kickoff-only ──
      //
      // ⭐ THIS SIDE OF THE PHASE IS COMPLETE END TO END, unlike the library door.
      // `scheduler_service.py:139-162` already spreads a schedule's stored `inputs` into
      // `run_inputs`, so a declared key entered here reaches `_external_action_inputs` on
      // every unattended run. That is precisely why a scheduled `send_email` step could
      // never receive its recipient before: there was nowhere to put one.
      //
      // ⚠ ALONGSIDE `kickoff_prompt`, NEVER REPLACING IT. The pre-change dict is built
      // FIRST and the declared values are layered on top, so a definition that declares
      // nothing produces the object this form has always sent, byte for byte.
      //
      // ⚠ A DECLARED KEY SPELLED `kickoff_prompt` WINS, AND THAT IS A DECISION.
      // `launchInputFields` already strips the reserved keys, so the collision cannot
      // actually arise from this form — but the ordering is written this way rather than
      // the other because if it ever did, the AUTHOR's declared field is the one a person
      // filled in on purpose. It costs nothing either way for the run itself:
      // `_NON_ACTION_RUN_INPUTS = frozenset({"kickoff_prompt"})` excludes that key from
      // action inputs BY NAME, so a step could never have read it as an argument anyway.
      const inputs: Record<string, string> = kickoff.trim()
        ? { kickoff_prompt: kickoff.trim() }
        : {}
      for (const f of launchFields) inputs[f.key] = inputValues[f.key] ?? ""
      try {
        await createWorkflowSchedule(workflow.id, {
          name: name.trim(),
          // ⚠ EXACTLY ONE cadence goes on the wire. Sending both is a 422 by design, and
          // sending the unused one as `null` rather than omitting it keeps that explicit.
          cron_expression: kind === "cron" ? cron.trim() : null,
          interval_seconds: kind === "interval" ? intervalSeconds : null,
          timezone,
          max_tokens_per_run: maxTokens,
          max_duration_seconds: maxDuration,
          inputs,
        })
      } catch (e) {
        // 300-01 (D-14, UI-SPEC S6c): the server still refused a blank required input (the
        // workflow gained one while the dialog was open). Its sentence goes in the SAME home
        // as the client pre-check, under the inputs, never in the bottom error line.
        if (isMissingRequired(e)) {
          setRequiredRefusal(e.message)
          return
        }
        throw e
      }
      setName("")
      setKickoff("")
      setInputValues({})
      await refresh()
    })
  }

  /** 300-01 (D-16): set or clear ONE row's result line, leaving every other row's alone. */
  const setRowResult = (id: string, result: RunNowResult | null) =>
    setRunResults((prev) => {
      const next = { ...prev }
      if (result) next[id] = result
      else delete next[id]
      return next
    })

  const onToggle = (s: WorkflowSchedule) =>
    withBusy(async () => {
      setRowResult(s.id, null)
      try {
        await updateSchedule(s.id, { is_active: !s.is_active })
      } catch (e) {
        // 300-01 (D-14, UI-SPEC S6c): a Resume refused for a blank required input is a ROW
        // action's answer, so it reads on that row, in the warning tone.
        if (isMissingRequired(e)) {
          setRowResult(s.id, { scheduleId: s.id, tone: "warning", text: e.message })
          return
        }
        throw e
      }
      await refresh()
    })

  const onRemove = (s: WorkflowSchedule) =>
    withBusy(async () => {
      await deleteSchedule(s.id)
      await refresh()
    })

  // 300-01 (D-16): Run now no longer takes the global busy guard. Only the pressed row is busy
  // (its Run now, Pause and Delete); every other row, the Add form and the close button stay
  // usable, and the refresh after it keeps the list in place.
  const onRunNow = async (s: WorkflowSchedule) => {
    if (runningIds.has(s.id)) return
    setRowResult(s.id, null)
    setRunningIds((prev) => new Set(prev).add(s.id))
    try {
      const result = await triggerSchedule(s.id)
      // ⚠ `launched: false` is a real answer with a reason, not an error. Saying "failed"
      // would hide the one fact that tells the person what to do next. 296-04: the line
      // sits on the pressed row, toned by `outcome`.
      setRowResult(s.id, runNowResult(s.id, result))
    } catch (e) {
      // The server's own sentence, on the row that was pressed.
      setRowResult(s.id, {
        scheduleId: s.id,
        tone: "error",
        text: e instanceof Error ? e.message : "It did not start.",
      })
    } finally {
      setRunningIds((prev) => {
        const next = new Set(prev)
        next.delete(s.id)
        return next
      })
    }
    await refresh()
  }

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
              <ul
                className="flex flex-col gap-2"
                data-testid="schedule-list"
                aria-busy={refetching ? "true" : undefined}
              >
                {schedules.map((s) => {
                  const next = whenText(s.next_run_at)
                  const last = whenText(s.last_run_at)
                  const outcome = scheduleOutcomeLine(s.last_status)
                  const runResult = runResults[s.id]
                  const starting = runningIds.has(s.id)
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
                          <p className="truncate text-[12px] text-muted-foreground">Last ran: {last}</p>
                        ) : null}
                        {/* 300-01 (D-15 / D-26, UI-SPEC S6a): the last outcome as ONE sentence,
                            on its own line. It WRAPS, never truncates: a clipped refusal hides
                            the input name, the one fact the author needs. The raw value never
                            reaches the screen. */}
                        {/* 302-03 (D-24, 300 G4-5 F-1): while this row shows its own Run now result, that line is
                            the newer word on the same press — showing both said the refusal twice. */}
                        {outcome && !runResult ? (
                          <p
                            data-testid="schedule-last-outcome"
                            className={`mt-1 text-[12px] break-words ${OUTCOME_TONE[outcome.tone]}`}
                          >
                            {outcome.text}
                          </p>
                        ) : null}
                        {!s.is_active ? (
                          <p className="text-[12px] text-muted-foreground">Paused — it will not run.</p>
                        ) : null}
                        {/* 296-04 (BUG-261025-01): the Run now result, on THIS row, under Last ran.
                            Polite for a start or a refusal; an alert only for a genuine error. */}
                        {runResult ? (
                          <p
                            data-testid="schedule-run-result"
                            role={runResult.tone === "error" ? "alert" : "status"}
                            className={`mt-1 text-[12px] ${RUN_NOW_TONE[runResult.tone]}`}
                          >
                            {runResult.tone === "success" ? <span aria-hidden="true" className="mr-1">✓</span> : null}
                            {runResult.text}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          data-testid="schedule-run-now"
                          disabled={busy || starting}
                          aria-busy={starting ? true : undefined}
                          onClick={() => void onRunNow(s)}
                          title="Run now (this does not change the cadence)"
                          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                        >
                          {starting ? (
                            <>
                              <Loader2
                                className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none"
                                aria-hidden="true"
                              />
                              <span className="sr-only">Starting…</span>
                            </>
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5" aria-hidden="true" />
                              <span className="sr-only">Run now</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          data-testid="schedule-toggle"
                          disabled={busy || starting}
                          onClick={() => void onToggle(s)}
                          className="rounded-md border border-border px-2 py-1 text-[12px] text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                        >
                          {s.is_active ? "Pause" : "Resume"}
                        </button>
                        <button
                          type="button"
                          data-testid="schedule-delete"
                          disabled={busy || starting}
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

            {/* ── 214-09 (STEP-02 / D-214-04): the workflow's DECLARED entry inputs ──────
                ABOVE the cadence controls, because they say WHAT this schedule will run
                with; the cadence says WHEN. A value entered once here is sent on every
                unattended run — which is exactly why it is one named field per DECLARED key.

                ⛔ NO EDITOR FOR AN ARBITRARY DICT IS BUILT HERE, and CONTEXT.md's deferral
                on that half stands. A control that let a person invent their own key on a
                scheduling surface is the JSON escape hatch SC#1 forbids one screen over.

                ⚠ THE REFUSAL IS DELIBERATELY NOT SPELLED IN THE WORDS ITS FENCE MATCHES.
                The plan's acceptance criterion is a raw `grep -ciE` over THIS FILE, and prose
                describing the absence would be counted as evidence of the presence — the
                187-24 trap. The fence that actually guards this is in the suite, anchored on
                comment-stripped CODE and carrying a positive control.

                ⚠ TWO ARMS, NEVER THREE — the same rule the library Run modal renders. An
                AUTHORED label is prose a human wrote → body face. A key with no label keeps
                the mono face. Absence renders the KEY, never a fabricated friendly name. */}
            {launchFields.length > 0 && (
              <div data-testid="schedule-inputs" className="flex flex-col gap-3">
                {launchFields.map((f) => (
                  <label key={f.key} className="flex flex-col gap-1">
                    {f.label ? (
                      <span className="text-[12px] text-muted-foreground">{f.label}</span>
                    ) : (
                      <span className="font-mono text-[12px] text-muted-foreground">{f.key}</span>
                    )}
                    <input
                      type="text"
                      data-testid={`schedule-input-${f.key}`}
                      value={inputValues[f.key] ?? ""}
                      onChange={(e) => {
                        setRequiredRefusal(null)
                        setInputValues((prev) => ({ ...prev, [f.key]: e.target.value }))
                      }}
                      className="rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground"
                    />
                  </label>
                ))}
              </div>
            )}
            {requiredRefusal ? (
              <p data-testid="schedule-required-refusal" role="alert" className="text-[12px] text-destructive">
                {requiredRefusal}
              </p>
            ) : null}

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
                  {/* ── BUG-260829-01 — THE COMMON CASE NEEDS NO CRON ────────────────────
                      The five presets above have HARDCODED times, so every time that is not
                      03:00 / 08:00 / 06:00 / on-the-hour fell through to the raw box below.
                      The operator wanted 04:18 and had to hand-write `18 4 * * *`. This control
                      composes it: pick a time, the expression is written for you. It REFLECTS
                      an expression already in the field (via `timeOfDailyCron`) rather than
                      resetting, so choosing a preset and then nudging the time both work. */}
                  <label className="flex items-center gap-2">
                    <span className="shrink-0 text-[12px] text-muted-foreground">
                      {DAILY_TIME_LABEL}
                    </span>
                    <input
                      type="time"
                      data-testid="schedule-daily-time"
                      value={timeOfDailyCron(cron) ?? ""}
                      onChange={(e) => {
                        const next = dailyCron(e.target.value)
                        if (next) setCron(next)
                      }}
                      className="rounded-md border border-border bg-background px-2 py-1.5 text-[13px] text-foreground"
                    />
                  </label>
                  <input
                    data-testid="schedule-cron"
                    value={cron}
                    onChange={(e) => setCron(e.target.value)}
                    spellCheck={false}
                    className="rounded-md border border-border bg-background px-2 py-1.5 font-mono text-[13px] text-foreground"
                  />
                  {/* ── BUG-260829-01 — SAY IT BACK, SO A TYPO IS VISIBLE BEFORE IT SAVES ──
                      `18 4` and `4 19` are equally plausible to anyone who does not already
                      know the field order, and a schedule that fires at the wrong hour reports
                      NOTHING — you find out the next morning, or you never do. The echo reads
                      the expression back; when it cannot, it says so and claims nothing about
                      validity, because the SERVER owns that verdict and plenty of legal cron
                      (a star-slash-number step, `1,15`, `MON`) is simply unphraseable here. */}
                  <p
                    data-testid="schedule-cron-means"
                    className="text-[12px] leading-relaxed text-muted-foreground"
                  >
                    {describeCron(cron, timezone)
                      ? `${CRON_MEANS_PREFIX} ${describeCron(cron, timezone)}`
                      : CRON_UNREADABLE}
                    <span className="ml-1 font-mono text-[11px] opacity-70">
                      {CRON_FIELD_ORDER}
                    </span>
                  </p>
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
