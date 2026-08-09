import { useState, useRef } from "react"
import { Plus, Zap, Upload, Loader2, FlaskConical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSkills } from "@/hooks/useSkills"
import { useAuth } from "@/hooks/useAuth"
import { useResizablePanel } from "@/hooks/useResizablePanel"
import { SkillCard } from "@/components/skills/SkillCard"
import { SkillDetailPanel } from "@/components/skills/SkillFormDialog"
import { exportSkill, importSkillZip, type SkillImportResult } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { Skill, SkillCreate, SkillUpdate } from "@/types"

interface Props {
  onTryInChat?: (skillName: string) => void
  // Phase 123-05 (TRIG-01 / sketch 041-A): opens the focused Skill Studio for a skill
  // (entered WITH a skillId). Threaded from ChatLayout → App's handleTuneSkill, which now
  // REDIRECTS to Studio · Triggering (the Trigger Tuner is absorbed as the Triggering
  // tab — no orphan surface). The existing "Tune triggers" button below is unchanged.
  onTuneSkill?: (skillId: string) => void
  // Phase 137-06 (PANEL-01 / sketch 057 MAP): the Studio navigators, accepted here so
  // ChatLayout's pass-through typechecks and Plan 07 can drill them to the slim detail
  // panel that owns the sole studio-entry button. Deliberately NOT destructured or
  // consumed in this plan (no duplicate entry button lives in SkillsPage — Plan 07 owns
  // it); leaving them undestructured avoids a noUnusedLocals error while keeping the
  // interface ready.
  onOpenStudio?: (skillId: string, tab?: "evals" | "triggering" | "versions") => void
  onReviewEvals?: (skillId: string) => void
}

/**
 * Phase 142 (SRH-01 / SC#1 / D-08): build the muted import-result line. Pure — so it can
 * be unit-tested without mounting the whole page. When the result carries non-blocking
 * honesty notes[] (a bundled non-Python script the sandbox can't run), the note text is
 * appended to the SAME muted line — no new component (D-09), stays `isError: false`.
 * Exported for SkillsPage.import.test.tsx; handleImport MUST call it so the test exercises
 * the real render path.
 */
export function buildImportMessage(result: SkillImportResult): { text: string; isError: boolean } {
  const created = result.created.length
  const failed = result.errors.length
  if (created === 0) {
    return { text: "No skills were imported.", isError: true }
  }
  let text =
    failed > 0
      ? `${created} skill${created > 1 ? "s" : ""} imported, ${failed} failed - check your ZIP.`
      : `${created} skill${created > 1 ? "s" : ""} imported.`
  // Append any non-blocking script-honesty notes onto the existing muted line (D-09).
  if (result.notes?.length) {
    text += result.notes.map((n) => ` Note: ${n.note}`).join("")
  }
  return { text, isError: false }
}

export function SkillsPage({ onTryInChat, onTuneSkill, onOpenStudio, onReviewEvals }: Props) {
  const { skills, loading, loadSkills, createSkill, updateSkill, deleteSkill, toggleEnabled, toggleOrgShared } = useSkills()
  const { user } = useAuth()
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<{ text: string; isError: boolean } | null>(null)

  // Sketch 046-C: the detail rail is resizable. It defaults to the standard
  // 384px side-rail width (consistent with every other panel at rest); dragging
  // the left-edge handle widens it for editing long instructions, and the width
  // is remembered. minWidth keeps it from collapsing below the form's needs;
  // maxWidth keeps it from swallowing the skill list.
  const { width: panelWidth, isResizing, separatorProps } = useResizablePanel({
    storageKey: "skills-detail-panel-width",
    defaultWidth: 384,
    minWidth: 340,
    maxWidth: 760,
  })

  const handleSave = async (body: SkillCreate | SkillUpdate): Promise<Skill> => {
    if (selectedSkill) {
      // Panel stays open after edit — user sees updated state + any lint warnings.
      // Return the saved skill so SkillDetailPanel can surface its lint_warnings
      // (Phase 123-06 / TRIG-03 — the inline never-block warning + "Tune this").
      return updateSkill(selectedSkill.id, body as SkillUpdate)
    }
    const created = await createSkill(body as SkillCreate)
    setIsCreatingNew(false) // close after new skill created
    return created
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportMessage(null)
    try {
      const result = await importSkillZip(file)
      setImportMessage(buildImportMessage(result))
      await loadSkills()
    } catch (err) {
      setImportMessage({ text: err instanceof Error ? err.message : "Import failed", isError: true })
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
    // Clear message after 5 seconds
    setTimeout(() => setImportMessage(null), 5000)
  }

  return (
    <div className={cn("flex h-full overflow-hidden", isResizing && "select-none")}>
      {/* Center — page header + scrollable skill list (sits flush against the real NavPanel) */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden border-r border-border/10">
        {/* Page header */}
        <div className="px-8 pt-8 pb-6 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-2xl font-headline font-semibold text-foreground">Skills</h1>
            <p className="text-muted-foreground mt-1.5 text-sm">
              Define reusable AI behaviors that the agent loads on demand.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={importing}>
              {importing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              {importing ? "Importing..." : "Import Skill"}
            </Button>
            <Button onClick={() => { setSelectedSkill(null); setIsCreatingNew(true) }}>
              <Plus className="h-4 w-4 mr-2" />
              New Skill
            </Button>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept=".zip" className="hidden" onChange={handleImport} />

        {/* Scrollable skill list */}
        <div className="flex-1 overflow-y-auto px-8 pb-8">
          {importMessage && (
            <p className={cn("text-sm mb-4", importMessage.isError ? "text-destructive" : "text-muted-foreground")}>
              {importMessage.text}
            </p>
          )}

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="rounded-xl bg-muted animate-pulse h-40" />
              ))}
            </div>
          ) : skills.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Zap className="h-12 w-12 text-muted-foreground/30 mb-4" />
              <h2 className="text-lg font-headline font-semibold text-foreground">No skills yet</h2>
              <p className="text-sm text-muted-foreground mt-1.5 mb-4 max-w-sm">
                Create your first skill to give the agent reusable behaviors.
              </p>
              <Button onClick={() => { setSelectedSkill(null); setIsCreatingNew(true) }}>
                <Plus className="h-4 w-4 mr-2" />
                New Skill
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {skills.map((skill) => (
                <SkillCard
                  key={skill.id}
                  skill={skill}
                  currentUserId={user?.id ?? ""}
                  onSelect={(s) => { setSelectedSkill(s); setIsCreatingNew(false) }}
                  onEdit={(s) => { setSelectedSkill(s); setIsCreatingNew(false) }}
                  onDelete={deleteSkill}
                  onToggleEnabled={toggleEnabled}
                  onToggleOrgShared={toggleOrgShared}
                  onTryInChat={onTryInChat ?? (() => {})}
                  onExport={exportSkill}
                  onReviewEvals={onReviewEvals}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Drag handle — widen the detail rail for editing long instructions (sketch
          046-C). Doubles as the seam between the list and the panel; keyboard users
          can focus it and use ←/→ to resize. */}
      <div
        {...separatorProps}
        aria-label="Resize skill details panel"
        className={cn(
          "w-1.5 shrink-0 cursor-col-resize touch-none bg-border/10 transition-colors",
          "hover:bg-primary/40 focus-visible:bg-primary/60 focus-visible:outline-none",
          isResizing && "bg-primary/60",
        )}
      />

      {/* Pane 3: Right — resizable inline detail/create panel */}
      <div
        className="shrink-0 overflow-y-auto bg-card/30"
        style={{ width: panelWidth }}
        role="region"
        aria-label="Skill details"
        aria-live="polite"
      >
        {selectedSkill || isCreatingNew ? (
          <div className="flex flex-col h-full">
            {/* Phase 123-05 (TRIG-01 / sketch 041-A): the "Tune triggers" entry
                action — opens the focused Trigger Tuner for THIS skill (only on a
                saved skill, never while creating). This is the reachability entry
                point: onTuneSkill(id) → App's tunerSkillId setter +
                onNavigate('skill-tuner'). */}
            {selectedSkill && onOpenStudio && (
              <div className="px-6 pt-4 shrink-0">
                <Button
                  size="sm"
                  className="w-full justify-center gap-2"
                  onClick={() => onOpenStudio(selectedSkill.id, "evals")}
                >
                  <FlaskConical className="h-4 w-4" />
                  Open Studio
                </Button>
              </div>
            )}
            <div className="flex-1 min-h-0">
              <SkillDetailPanel
                skill={selectedSkill}
                onSave={handleSave}
                onDiscard={() => { setSelectedSkill(null); setIsCreatingNew(false) }}
                currentUserId={user?.id}
                onTuneSkill={onTuneSkill}
              />
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <Zap className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              Select a skill to view details
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
