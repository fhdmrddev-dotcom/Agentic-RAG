import { useState, useEffect, useRef } from "react"
import { Paperclip, FileText, Trash2, Loader2, AlertTriangle, Target, Maximize2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { listSkillFiles, uploadSkillFile, deleteSkillFile } from "@/lib/api"
import type { Skill, SkillCreate, SkillUpdate, SkillFile, SkillLintWarning } from "@/types"

// ---------------------------------------------------------------------------
// SkillForm — shared inner form component used by both SkillFormDialog and SkillDetailPanel
// ---------------------------------------------------------------------------

interface SkillFormProps {
  name: string
  setName: (v: string) => void
  description: string
  setDescription: (v: string) => void
  instructions: string
  setInstructions: (v: string) => void
  isEdit: boolean
  isOwner: boolean
  skill?: Skill | null
  files: SkillFile[]
  uploading: boolean
  fileError: string | null
  onAttach: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDeleteFile: (fileId: string) => void
  fileInputRef: React.RefObject<HTMLInputElement>
  /** Phase 123-06 (TRIG-03 / sketch 044-A): the save-time lint warnings returned
   *  by the last save (POST/PATCH /skills `lint_warnings`). Rendered inline under
   *  the Description textarea — warn-never-block (D-09), silent when empty/absent. */
  lintWarnings?: SkillLintWarning[]
  /** Fires the one-click "Tune this" handoff into the Trigger Tuner for this skill
   *  (D-12). Undefined while creating a brand-new skill (no id to tune yet). */
  onTuneThis?: () => void
}

function SkillForm({
  name,
  setName,
  description,
  setDescription,
  instructions,
  setInstructions,
  isEdit,
  isOwner,
  skill,
  files,
  uploading,
  fileError,
  onAttach,
  onDeleteFile,
  fileInputRef,
  lintWarnings,
  onTuneThis,
}: SkillFormProps) {
  // Sketch 046-C: the "Expand" full-size editor for long instructions. Lives in
  // the SHARED form so both the inline SkillDetailPanel and the modal get it.
  const [editorExpanded, setEditorExpanded] = useState(false)

  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="flex flex-col gap-4 overflow-y-auto flex-1 min-h-0">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SQL Writer" />
      </div>

      {/* Description */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">
          Description{" "}
          <span className="text-xs text-muted-foreground font-normal">
            · drives when the agent loads this skill
          </span>
        </label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="One sentence describing what this skill does"
          rows={2}
        />

        {/* Phase 123-06 (TRIG-03 / sketch 044-A): inline weak-description lint.
            Mounted DIRECTLY under the Description textarea (variant A — closest to
            the thing it's about) in the SHARED SkillForm, so it covers BOTH the
            modal SkillFormDialog and the 3-pane SkillDetailPanel from one place.
            Warn-NEVER-block (D-09): the save already succeeded; this is advisory.
            Renders nothing when warnings are empty/absent (silent-when-healthy). */}
        {lintWarnings && lintWarnings.length > 0 && (
          <div
            role="status"
            className="mt-1 flex items-start gap-2.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2.5"
          >
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-400" aria-hidden="true" />
            <div className="flex-1 min-w-0 text-xs leading-relaxed">
              <p className="font-semibold text-amber-400">
                Weak trigger description — the agent may not fire this skill.
              </p>
              <ul className="mt-1 list-disc pl-4 text-muted-foreground space-y-0.5">
                {lintWarnings.map((w) => (
                  <li key={w.code}>{w.message}</li>
                ))}
              </ul>
            </div>
            {onTuneThis && (
              <Button
                type="button"
                size="sm"
                onClick={onTuneThis}
                className="shrink-0 gap-1.5 bg-amber-500 text-amber-950 hover:bg-amber-400 border-none h-7 px-2.5 text-xs font-semibold"
              >
                <Target className="h-3.5 w-3.5" />
                Tune this
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Instructions — taller by default + a soft drag-to-grow handle, and an
          "Expand" button that opens a focused full-size editor for long markdown
          (sketch 046-C). The Expand editor binds the SAME `instructions` value, so
          closing it just returns to the form with edits already applied. */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-foreground">Instructions</label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-6 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
            onClick={() => setEditorExpanded(true)}
          >
            <Maximize2 className="h-3 w-3" />
            Expand
          </Button>
        </div>
        <Textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          placeholder="Step-by-step instructions the agent follows when this skill is loaded..."
          rows={10}
          className="min-h-[12rem] resize-y font-mono text-sm"
        />
      </div>

      {/* Attached Files — edit mode only */}
      {isEdit && skill && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Attached Files</label>
            {isOwner && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs gap-1"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
                {uploading ? "Uploading..." : "Attach File"}
              </Button>
            )}
          </div>
          <input ref={fileInputRef} type="file" className="hidden" onChange={onAttach} />
          {files.length === 0 ? (
            <p className="text-xs text-muted-foreground">No files attached.</p>
          ) : (
            <ul className="flex flex-col gap-1 overflow-y-auto max-h-48">
              {files.map((f) => (
                <li key={f.id} className="flex items-center justify-between text-xs bg-muted rounded px-2 py-1">
                  <span className="flex items-center gap-1 text-foreground truncate">
                    <FileText className="h-3 w-3 shrink-0" />
                    {f.filename}
                    <span className="text-muted-foreground ml-1">({formatBytes(f.file_size)})</span>
                  </span>
                  {isOwner && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 hover:text-destructive shrink-0"
                      onClick={() => onDeleteFile(f.id)}
                      aria-label="Delete file"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {fileError && <p className="text-xs text-destructive">{fileError}</p>}
        </div>
      )}

      {/* ENV VAR INPUTS — insert here when Skill schema gains env_vars field.
          Per D-10/D-11: each Input gets className="bg-card/50 ghost-border rounded-lg",
          wrapped in <div className="flex items-center gap-2">, with a Required or ReadOnly
          <span> badge (bg-rose-500/10 text-rose-400 OR bg-muted text-muted-foreground)
          as a sibling after the Input. */}

      {/* Focused full-size instructions editor (sketch 046-C escape hatch). Edits
          the same `instructions` string; "Done" just closes — Save is unchanged. */}
      <Dialog open={editorExpanded} onOpenChange={setEditorExpanded}>
        <DialogContent className="flex h-[85vh] w-[92vw] max-w-4xl flex-col gap-3">
          <DialogHeader className="shrink-0">
            <DialogTitle>Instructions{name ? ` — ${name}` : ""}</DialogTitle>
          </DialogHeader>
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            placeholder="Step-by-step instructions the agent follows when this skill is loaded..."
            className="min-h-0 flex-1 resize-none font-mono text-sm"
            autoFocus
          />
          <DialogFooter className="shrink-0">
            <Button type="button" onClick={() => setEditorExpanded(false)}>
              Done
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SkillFormDialog — modal variant (unchanged external behavior)
// ---------------------------------------------------------------------------

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  skill?: Skill | null
  /** Resolves to the saved Skill so the form can surface its `lint_warnings`
   *  (POST/PATCH /skills, Plan 01). `void` for callers that don't return it
   *  (the warning simply won't render). */
  onSave: (body: SkillCreate | SkillUpdate) => Promise<Skill | void>
  currentUserId?: string
  /** Phase 123-06 (TRIG-03 / D-12): the verified Plan-05 navigator that opens the
   *  Trigger Tuner for a skill. The inline lint's "Tune this" button reuses THIS
   *  exact seam (App → ChatLayout → "skill-tuner" view), never a parallel path. */
  onTuneSkill?: (skillId: string) => void
}

export function SkillFormDialog({ open, onOpenChange, skill, onSave, currentUserId, onTuneSkill }: Props) {
  const isEdit = !!skill
  const isOwner = !!(skill && currentUserId && skill.user_id === currentUserId)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [instructions, setInstructions] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<SkillFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  // Phase 123-06: the lint warnings from the last save (advisory; warn-never-block).
  const [lintWarnings, setLintWarnings] = useState<SkillLintWarning[]>([])
  const [savedSkillId, setSavedSkillId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset fields whenever dialog opens/closes or skill changes
  useEffect(() => {
    if (open) {
      setName(skill?.name ?? "")
      setDescription(skill?.description ?? "")
      setInstructions(skill?.instructions ?? "")
      setError(null)
      setSaving(false)
      setFiles([])
      setFileError(null)
      setLintWarnings([])
      setSavedSkillId(skill?.id ?? null)
      if (skill) {
        listSkillFiles(skill.id)
          .then(setFiles)
          .catch(() => setFileError("Failed to load files. Close and reopen to retry."))
      }
    }
  }, [open, skill])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !skill) return
    setUploading(true)
    setFileError(null)
    try {
      const newFile = await uploadSkillFile(skill.id, file)
      setFiles((prev) => [...prev, newFile])
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Upload failed. Try again.")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    if (!skill) return
    try {
      await deleteSkillFile(skill.id, fileId)
      setFiles((prev) => prev.filter((f) => f.id !== fileId))
    } catch {
      setFileError("Failed to delete file. Try again.")
    }
  }

  const handleSave = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      const body = isEdit
        ? ({ name: name.trim(), description: description.trim(), instructions: instructions.trim() } as SkillUpdate)
        : ({ name: name.trim(), description: description.trim(), instructions: instructions.trim() } as SkillCreate)
      // The save ALWAYS proceeds — the lint is advisory (D-09). Capture the
      // returned skill's lint_warnings; if any fired, KEEP the dialog open so the
      // inline warning + "Tune this" are visible. Healthy save → close as before.
      const saved = await onSave(body)
      const warnings = (saved && "lint_warnings" in saved && saved.lint_warnings) || []
      if (saved?.id) setSavedSkillId(saved.id)
      setLintWarnings(warnings)
      if (warnings.length === 0) onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save skill.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh]">
        <DialogHeader className="shrink-0">
          <DialogTitle>{isEdit ? "Edit Skill" : "New Skill"}</DialogTitle>
        </DialogHeader>

        <div className="py-2 flex-1 min-h-0 overflow-y-auto pr-1">
          <SkillForm
            name={name}
            setName={setName}
            description={description}
            setDescription={setDescription}
            instructions={instructions}
            setInstructions={setInstructions}
            isEdit={isEdit}
            isOwner={isOwner}
            skill={skill}
            files={files}
            uploading={uploading}
            fileError={fileError}
            onAttach={handleFileUpload}
            onDeleteFile={handleDeleteFile}
            fileInputRef={fileInputRef}
            lintWarnings={lintWarnings}
            onTuneThis={
              onTuneSkill && savedSkillId
                ? () => onTuneSkill(savedSkillId)
                : undefined
            }
          />
        </div>

        <DialogFooter className="flex-col items-stretch gap-2 shrink-0">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Discard Changes
            </Button>
            <Button onClick={handleSave} disabled={!name.trim() || saving}>
              {isEdit ? "Update Skill" : "Save Skill"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// SkillDetailPanel — inline panel variant for 3-pane SkillsPage layout
// ---------------------------------------------------------------------------

interface SkillDetailPanelProps {
  skill: Skill | null
  onSave: (body: SkillCreate | SkillUpdate) => Promise<Skill | void>
  onDiscard: () => void
  currentUserId?: string
  /** Phase 123-06 (TRIG-03 / D-12): the verified Plan-05 navigator (reused, not
   *  forked) that opens the Trigger Tuner for a skill. The inline lint's "Tune
   *  this" button fires it with the saved skill's id. */
  onTuneSkill?: (skillId: string) => void
}

export function SkillDetailPanel({ skill, onSave, onDiscard, currentUserId, onTuneSkill }: SkillDetailPanelProps) {
  const isEdit = !!skill
  const isOwner = !!(skill && currentUserId && skill.user_id === currentUserId)

  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [instructions, setInstructions] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [files, setFiles] = useState<SkillFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  // Phase 123-06: lint warnings from the last save (advisory; warn-never-block).
  const [lintWarnings, setLintWarnings] = useState<SkillLintWarning[]>([])
  const [savedSkillId, setSavedSkillId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Reset when selected skill changes
  useEffect(() => {
    setName(skill?.name ?? "")
    setDescription(skill?.description ?? "")
    setInstructions(skill?.instructions ?? "")
    setError(null)
    setSaving(false)
    setFiles([])
    setFileError(null)
    setLintWarnings([])
    setSavedSkillId(skill?.id ?? null)
    if (skill) {
      listSkillFiles(skill.id)
        .then(setFiles)
        .catch(() => setFileError("Failed to load files."))
    }
  }, [skill])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !skill) return
    setUploading(true)
    setFileError(null)
    try {
      const newFile = await uploadSkillFile(skill.id, file)
      setFiles((prev) => [...prev, newFile])
    } catch (err) {
      setFileError(err instanceof Error ? err.message : "Upload failed.")
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleDeleteFile = async (fileId: string) => {
    if (!skill) return
    try {
      await deleteSkillFile(skill.id, fileId)
      setFiles((prev) => prev.filter((f) => f.id !== fileId))
    } catch {
      setFileError("Failed to delete file.")
    }
  }

  const handleSave = async () => {
    if (!name.trim() || saving) return
    setSaving(true)
    setError(null)
    try {
      const body = isEdit
        ? ({ name: name.trim(), description: description.trim(), instructions: instructions.trim() } as SkillUpdate)
        : ({ name: name.trim(), description: description.trim(), instructions: instructions.trim() } as SkillCreate)
      // The save ALWAYS proceeds (D-09). The panel already stays open after a save,
      // so we just capture the returned lint_warnings to render inline.
      const saved = await onSave(body)
      if (saved?.id) setSavedSkillId(saved.id)
      setLintWarnings((saved && "lint_warnings" in saved && saved.lint_warnings) || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save skill.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Panel header */}
      <div className="px-6 pt-6 pb-4 border-b border-border/10 shrink-0">
        <p className="text-base font-headline font-bold text-foreground">
          {skill?.name ?? "New Skill"}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {isEdit ? "Edit Skill" : "New Skill"}
        </p>
      </div>

      {/* Form body */}
      <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
        <SkillForm
          name={name}
          setName={setName}
          description={description}
          setDescription={setDescription}
          instructions={instructions}
          setInstructions={setInstructions}
          isEdit={isEdit}
          isOwner={isOwner}
          skill={skill}
          files={files}
          uploading={uploading}
          fileError={fileError}
          onAttach={handleFileUpload}
          onDeleteFile={handleDeleteFile}
          fileInputRef={fileInputRef}
          lintWarnings={lintWarnings}
          onTuneThis={
            onTuneSkill && savedSkillId
              ? () => onTuneSkill(savedSkillId)
              : undefined
          }
        />
      </div>

      {/* Footer */}
      <div className="px-6 pt-4 pb-6 border-t border-border/10 shrink-0">
        {error && <p className="text-sm text-destructive mb-2">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onDiscard}>
            Discard Changes
          </Button>
          <Button onClick={handleSave} disabled={!name.trim() || saving}>
            {isEdit ? "Update Skill" : "Save Skill"}
          </Button>
        </div>
      </div>
    </div>
  )
}
