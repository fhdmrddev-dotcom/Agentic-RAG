/**
 * Phase 275 plan 04 (S2 / D-02 / D-20 / D-22 / D-23 / T-275-32) — the policy editor (2B: a plain
 * form; Save is locked until Preview).
 *
 * THE GATE (D-02): `2 · Save policy` is `aria-disabled` — with its reason ON SCREEN, never only in a
 * tooltip — until a Preview has run AND nothing was edited since. Any edit after a Preview marks it
 * stale and re-locks Save. The server is the wall (it requires a recorded preview of the identical
 * draft); this is the friendly half, and a server 409 `Preview again before saving.` is rendered,
 * never swallowed.
 *
 * D-22: `Counted from` offers exactly two clocks. D-20: a second stage (`Then queue it for
 * deletion`) exists only when Then = archive it. 275-03 deviation 4: a stored policy covers ONE
 * folder OR ONE document type, so picking one disables the other with the server's own sentence.
 *
 * Replaces the sub-tab body in place (not a modal); two columns at ≥ 1024px.
 */
import { useEffect, useId, useMemo, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useFolders } from "@/hooks/useFolders"
import { folderPathOf } from "@/components/chat/scopeCopy"
import { cn } from "@/lib/utils"
import { ApiRefusal } from "@/lib/api/refusal"
import {
  createPolicy,
  listDocumentTypes,
  previewPolicy,
  removePolicy,
  updatePolicy,
  type DocumentTypeCount,
  type PolicyDraft,
  type PolicyPreview,
  type RetentionAction,
  type RetentionClock,
  type RetentionPolicy,
  type RetentionUnit,
} from "@/lib/api/retention"
import { AMBER_TEXT_CLASS } from "./RetentionChip"
import { RetentionPreview } from "./RetentionPreview"
import { RETENTION_COPY, fillCopy } from "./retentionCopy"

const C = RETENTION_COPY

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-muted px-3 py-1 text-base md:text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"

const UNITS: Array<{ value: RetentionUnit; label: string }> = [
  { value: "days", label: C.contract.unitDays },
  { value: "months", label: C.contract.unitMonths },
  { value: "years", label: C.contract.unitYears },
]

// D-22: exactly two clocks, no fallback.
const CLOCKS: Array<{ value: RetentionClock; label: string }> = [
  { value: "document_date", label: C.ported.clockDocumentDate },
  { value: "date_added", label: C.ported.clockDateAdded },
]

const ACTIONS: Array<{ value: RetentionAction; label: string }> = [
  { value: "archive", label: C.ported.actionArchive },
  { value: "delete", label: C.ported.actionDelete },
  { value: "review", label: C.ported.actionReview },
]

const ACTION_NOTE: Record<RetentionAction, string> = {
  archive: C.ported.noteArchive,
  delete: C.ported.noteDelete,
  review: C.ported.noteReview,
}

/** Approximate length in days, only to catch an obviously-wrong second stage before the server does. */
const APPROX_DAYS: Record<RetentionUnit, number> = { days: 1, months: 30.44, years: 365.25 }

/** The server's own range for a stage value (`models/retention.py`: `ge=1, le=10000`). */
const MAX_STAGE_VALUE = 10000

/**
 * 275-REVIEW F-WR-09: a stage value is a WHOLE number typed as digits — never coerced. `""`, `0`,
 * `-3`, `1.5` and `1e2` (which `type=number` accepts) are refused with a visible message instead of
 * quietly becoming 1 while the field still shows what was typed. An invalid value maps to 0, which
 * `validate` refuses, so it can never reach Preview or Save.
 */
function wholeNumber(raw: string): number {
  const t = raw.trim()
  if (!/^\d+$/.test(t)) return 0
  const n = Number(t)
  return n >= 1 && n <= MAX_STAGE_VALUE ? n : 0
}

interface FormState {
  name: string
  type: string
  folder: string
  subfolders: boolean
  value: string
  unit: RetentionUnit
  clock: RetentionClock
  action: RetentionAction
  later: boolean
  laterValue: string
  laterUnit: RetentionUnit
}

function initialForm(p: RetentionPolicy | null): FormState {
  return {
    name: p?.name ?? "",
    type: p?.document_type_norm ?? "",
    folder: p?.folder_id ?? "",
    subfolders: p?.include_subfolders ?? true,
    value: String(p?.stage1_value ?? 1),
    unit: p?.stage1_unit ?? "years",
    clock: p?.clock ?? "document_date",
    action: p?.stage1_action ?? "archive",
    later: p?.stage2_value != null,
    laterValue: String(p?.stage2_value ?? 1),
    laterUnit: p?.stage2_unit ?? "years",
  }
}

function draftOf(f: FormState): PolicyDraft {
  const later = f.action === "archive" && f.later
  return {
    name: f.name.trim(),
    document_type_norm: f.type || null,
    folder_id: f.folder || null,
    include_subfolders: f.subfolders,
    clock: f.clock,
    stage1_value: wholeNumber(f.value),
    stage1_unit: f.unit,
    stage1_action: f.action,
    stage2_value: later ? wholeNumber(f.laterValue) : null,
    stage2_unit: later ? f.laterUnit : null,
  }
}

interface Errors {
  name?: string
  scope?: string
  value?: string
  laterValue?: string
  later?: string
}

function validate(d: PolicyDraft): Errors {
  const e: Errors = {}
  if (!d.name) e.name = C.contract.nameRequired
  if (!d.folder_id && !d.document_type_norm) e.scope = C.contract.scopeRequired
  if (d.stage1_value < 1) e.value = C.contract.wholeNumber
  if (d.stage2_value != null && d.stage2_value < 1) e.laterValue = C.contract.wholeNumber
  if (!e.value && !e.laterValue && d.stage2_value != null && d.stage2_unit) {
    const one = d.stage1_value * APPROX_DAYS[d.stage1_unit]
    const two = d.stage2_value * APPROX_DAYS[d.stage2_unit]
    if (two <= one) e.later = C.contract.stage2After
  }
  return e
}

const typeName = (v: string) => `${v.charAt(0).toUpperCase()}${v.slice(1)}`
const typeLabel = (t: DocumentTypeCount) => `${typeName(t.value)} (${t.count})`

export function RetentionPolicyEditor({
  policy,
  onBack,
  onSaved,
  onGone,
}: {
  /** null → a new policy. */
  policy: RetentionPolicy | null
  onBack: () => void
  /** A write landed (save or remove): return to the list and pulse the band. */
  onSaved: () => void
  /** 275-REVIEW F-CR-02: the policy is already gone — return to a RE-READ list, recording nothing. */
  onGone?: () => void
}) {
  const [form, setForm] = useState<FormState>(() => initialForm(policy))
  const [errors, setErrors] = useState<Errors>({})
  const [types, setTypes] = useState<DocumentTypeCount[]>([])
  const [preview, setPreview] = useState<{ key: string; result: PolicyPreview } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [previewFailed, setPreviewFailed] = useState<{ message: string | null } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [removeFailed, setRemoveFailed] = useState(false)
  const [removeRefused, setRemoveRefused] = useState<string | null>(null)
  const nameRef = useRef<HTMLInputElement>(null)
  const alive = useRef(true)
  const reasonId = useId()
  const { folders } = useFolders()

  useEffect(() => {
    alive.current = true
    nameRef.current?.focus() // opening the editor focuses Name
    listDocumentTypes()
      .then((t) => {
        if (alive.current) setTypes(t)
      })
      .catch(() => {
        /* the type list stays empty; a folder policy still works */
      })
    return () => {
      alive.current = false
    }
  }, [])

  const draft = useMemo(() => draftOf(form), [form])
  const draftKey = useMemo(() => JSON.stringify(draft), [draft])
  const stale = preview !== null && preview.key !== draftKey
  const canSave = preview !== null && !stale && !saving

  const folderOptions = useMemo(
    () =>
      (folders ?? [])
        .map((f) => ({ id: f.id, path: `/${folderPathOf(f.id, folders ?? []) ?? f.name}` }))
        .sort((a, b) => a.path.localeCompare(b.path)),
    [folders],
  )

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setSaveError(null)
  }

  async function runPreview() {
    const e = validate(draft)
    setErrors(e)
    if (Object.values(e).some(Boolean)) return
    setPreviewing(true)
    setPreviewFailed(null)
    const key = draftKey
    try {
      const result = await previewPolicy(draft, policy?.id ?? null)
      if (!alive.current) return
      setPreview({ key, result })
    } catch (err) {
      if (!alive.current) return
      setPreview(null) // Save stays locked
      const message = err instanceof ApiRefusal && (err.status === 409 || err.status === 422) ? err.message : null
      setPreviewFailed({ message })
    } finally {
      if (alive.current) setPreviewing(false)
    }
  }

  async function save() {
    if (!canSave) return
    setSaving(true)
    setSaveError(null)
    try {
      if (policy) await updatePolicy(policy.id, draft)
      else await createPolicy(draft)
      if (!alive.current) return
      onSaved()
    } catch (err) {
      if (!alive.current) return
      if (err instanceof ApiRefusal && err.status === 409) {
        // The server's wall: render its sentence and re-lock Save until a fresh preview.
        setSaveError(err.message)
        setPreview(null)
      } else {
        setSaveError(C.contract.saveFailed) // the preview stays, Save stays unlocked
      }
    } finally {
      if (alive.current) setSaving(false)
    }
  }

  async function remove() {
    if (!policy) return
    setRemoveFailed(false)
    setRemoveRefused(null)
    try {
      await removePolicy(policy.id)
      if (!alive.current) return
      setRemoveOpen(false)
      onSaved()
    } catch (err) {
      if (!alive.current) return
      // 275-REVIEW F-CR-02: a 404 means it is ALREADY gone — never "It is still active.". Any other
      // 4xx is the server's own sentence. Only a failure where the server said nothing keeps the
      // contract's "still active".
      if (err instanceof ApiRefusal && err.status === 404) setRemoveRefused(C.contract.policyAlreadyRemoved)
      else if (err instanceof ApiRefusal && err.status >= 400 && err.status < 500) setRemoveRefused(err.message)
      else setRemoveFailed(true)
    }
  }

  const typeDisabled = form.folder !== ""
  const folderDisabled = form.type !== ""
  // 275-REVIEW F-WR-08: a stored value with no option in the live list (still loading, a failed
  // load, a type outside the top 50 or with no current documents, a folder this list lacks) is
  // still the policy's scope. It renders as its own option, so the select can never DISPLAY
  // "Any type" / "Any folder" while Preview and Save carry the hidden value.
  const storedTypeMissing = form.type !== "" && !types.some((t) => t.value === form.type)
  const storedFolderMissing = form.folder !== "" && !folderOptions.some((f) => f.id === form.folder)
  const storedFolderLabel =
    policy && policy.folder_id === form.folder && policy.folder_path ? policy.folder_path : form.folder

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{C.ported.policiesCrumb}</span>
        <h3 className="font-headline text-base font-semibold">
          {policy ? fillCopy(C.sketchTemplates.editTitle, { name: policy.name }) : C.ported.newPolicyTitle}
        </h3>
        <span className="flex-1" />
        <Button type="button" variant="ghost" size="sm" className="h-7 text-xs font-semibold" onClick={onBack}>
          {C.contract.backToPolicies}
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="grid content-start gap-4 rounded-[10px] border border-border bg-card p-4">
          <div className="grid gap-x-4 gap-y-4 md:grid-cols-[150px_minmax(0,1fr)] md:items-center">
            <Label htmlFor="rp-name" className="text-sm font-normal">
              {C.ported.colName}
            </Label>
            <div className="grid gap-1">
              <Input id="rp-name" ref={nameRef} value={form.name} onChange={(e) => set("name", e.target.value)} />
              {errors.name && <p className={cn("text-xs", AMBER_TEXT_CLASS)}>{errors.name}</p>}
            </div>

            <Label htmlFor="rp-type" className="text-sm font-normal">
              {C.ported.labelDocumentType}
            </Label>
            <select
              id="rp-type"
              className={SELECT_CLASS}
              value={form.type}
              disabled={typeDisabled}
              onChange={(e) => set("type", e.target.value)}
            >
              <option value="">{C.ported.anyType}</option>
              {storedTypeMissing && <option value={form.type}>{typeName(form.type)}</option>}
              {types.map((t) => (
                <option key={t.value} value={t.value}>
                  {typeLabel(t)}
                </option>
              ))}
            </select>

            <Label htmlFor="rp-folder" className="text-sm font-normal">
              {C.ported.colFolder}
            </Label>
            <div className="grid gap-1">
              <div className="flex items-center gap-2">
                <select
                  id="rp-folder"
                  className={SELECT_CLASS}
                  value={form.folder}
                  disabled={folderDisabled}
                  onChange={(e) => set("folder", e.target.value)}
                >
                  <option value="">{C.ported.anyFolder}</option>
                  {storedFolderMissing && <option value={form.folder}>{storedFolderLabel}</option>}
                  {folderOptions.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.path}
                    </option>
                  ))}
                </select>
                <label className="flex min-h-8 items-center gap-1 whitespace-nowrap text-sm">
                  <input
                    type="checkbox"
                    className="accent-[hsl(var(--primary))]"
                    checked={form.subfolders}
                    disabled={folderDisabled}
                    onChange={(e) => set("subfolders", e.target.checked)}
                  />
                  {C.ported.subfolders}
                </label>
              </div>
              {(typeDisabled || folderDisabled) && (
                <p className="text-xs text-muted-foreground">{C.serverModels.scopeOneOnly}</p>
              )}
              {errors.scope && <p className={cn("text-xs", AMBER_TEXT_CLASS)}>{errors.scope}</p>}
            </div>

            <Label htmlFor="rp-value" className="text-sm font-normal">
              {C.ported.labelKeepFor}
            </Label>
            <div className="grid gap-1">
              <div className="flex items-center gap-2">
                <Input
                  id="rp-value"
                  type="number"
                  min={1}
                  step={1}
                  className="w-24"
                  value={form.value}
                  onChange={(e) => set("value", e.target.value)}
                />
                <select
                  aria-label={C.ported.labelKeepFor}
                  className={cn(SELECT_CLASS, "w-32")}
                  value={form.unit}
                  onChange={(e) => set("unit", e.target.value as RetentionUnit)}
                >
                  {UNITS.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
              {errors.value && <p className={cn("text-xs", AMBER_TEXT_CLASS)}>{errors.value}</p>}
            </div>

            <Label htmlFor="rp-clock" className="text-sm font-normal">
              {C.ported.labelCountedFrom}
            </Label>
            <select
              id="rp-clock"
              className={SELECT_CLASS}
              value={form.clock}
              onChange={(e) => set("clock", e.target.value as RetentionClock)}
            >
              {CLOCKS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>

            <Label htmlFor="rp-action" className="text-sm font-normal">
              {C.ported.colThen}
            </Label>
            <select
              id="rp-action"
              className={SELECT_CLASS}
              value={form.action}
              onChange={(e) => set("action", e.target.value as RetentionAction)}
            >
              {ACTIONS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>

            {form.action === "archive" && (
              <>
                <span className="text-sm">{C.contract.later}</span>
                <div className="grid gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="flex min-h-8 items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        className="accent-[hsl(var(--primary))]"
                        checked={form.later}
                        onChange={(e) => set("later", e.target.checked)}
                      />
                      {C.contract.thenQueue}
                    </label>
                    {form.later && (
                      <>
                        <Input
                          type="number"
                          min={1}
                          step={1}
                          aria-label={C.contract.thenQueue}
                          className="w-24"
                          value={form.laterValue}
                          onChange={(e) => set("laterValue", e.target.value)}
                        />
                        <select
                          aria-label={`${C.contract.thenQueue} ${C.contract.after}`}
                          className={cn(SELECT_CLASS, "w-32")}
                          value={form.laterUnit}
                          onChange={(e) => set("laterUnit", e.target.value as RetentionUnit)}
                        >
                          {UNITS.map((u) => (
                            <option key={u.value} value={u.value}>
                              {u.label}
                            </option>
                          ))}
                        </select>
                        <span className="text-sm">{C.contract.after}</span>
                      </>
                    )}
                  </div>
                  {form.later && <p className="text-xs text-muted-foreground">{C.contract.stage2Helper}</p>}
                  {form.later && errors.laterValue && (
                    <p className={cn("text-xs", AMBER_TEXT_CLASS)}>{errors.laterValue}</p>
                  )}
                  {errors.later && <p className={cn("text-xs", AMBER_TEXT_CLASS)}>{errors.later}</p>}
                </div>
              </>
            )}
          </div>

          <p className={cn("text-xs", form.action === "delete" ? AMBER_TEXT_CLASS : "text-muted-foreground")}>
            {ACTION_NOTE[form.action]}
          </p>

          {saveError && (
            <p role="alert" className={cn("text-sm", AMBER_TEXT_CLASS)}>
              {saveError}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
            {policy && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs font-semibold"
                onClick={() => {
                  setRemoveFailed(false)
                  setRemoveRefused(null)
                  setRemoveOpen(true)
                }}
              >
                {C.contract.removePolicyEllipsis}
              </Button>
            )}
            <span className="flex-1" />
            <Button type="button" variant="ghost" className="font-semibold" onClick={runPreview} disabled={previewing}>
              {C.ported.previewButton}
            </Button>
            <Button
              type="button"
              className="font-semibold"
              aria-disabled={!canSave}
              aria-describedby={!canSave ? reasonId : undefined}
              onClick={save}
            >
              {C.ported.saveButton}
            </Button>
            {!canSave && (
              <span id={reasonId} className="basis-full text-right text-xs text-muted-foreground">
                {C.contract.previewFirst}
              </span>
            )}
          </div>
        </div>

        <RetentionPreview
          preview={preview?.result ?? null}
          loading={previewing}
          failed={previewFailed !== null}
          serverMessage={previewFailed?.message ?? null}
          stale={stale}
          onRetry={runPreview}
        />
      </div>

      <AlertDialog open={removeOpen} onOpenChange={(o) => setRemoveOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline text-base">
              {fillCopy(C.specTemplates.removeTitle, { name: policy?.name ?? "" })}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm">{C.contract.removeBody}</AlertDialogDescription>
          </AlertDialogHeader>
          {(removeFailed || removeRefused !== null) && (
            <p role="alert" className={cn("text-sm", AMBER_TEXT_CLASS)}>
              {removeRefused ?? C.contract.removeFailed}
            </p>
          )}
          <AlertDialogFooter>
            {removeRefused !== null ? (
              // Nothing is left to remove: the one way out re-reads the list (no band pulse).
              <Button
                type="button"
                variant="outline"
                className="font-semibold"
                onClick={() => {
                  setRemoveOpen(false)
                  ;(onGone ?? onBack)()
                }}
              >
                {C.contract.backToPolicies}
              </Button>
            ) : (
              <>
                <AlertDialogCancel className="font-semibold">{C.contract.keepPolicy}</AlertDialogCancel>
                <Button type="button" variant="outline" className="border-border bg-transparent font-semibold" onClick={remove}>
                  {C.contract.removePolicy}
                </Button>
              </>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
