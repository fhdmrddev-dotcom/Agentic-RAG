import { useState, useRef } from "react"
import { Plus, Zap, Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSkills } from "@/hooks/useSkills"
import { useAuth } from "@/hooks/useAuth"
import { SkillCard } from "@/components/skills/SkillCard"
import { SkillDetailPanel } from "@/components/skills/SkillFormDialog"
import { exportSkill, importSkillZip } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { Skill, SkillCreate, SkillUpdate } from "@/types"

interface Props {
  onTryInChat?: (skillName: string) => void
}

export function SkillsPage({ onTryInChat }: Props) {
  const { skills, loading, loadSkills, createSkill, updateSkill, deleteSkill, toggleEnabled, toggleGlobal } = useSkills()
  const { user } = useAuth()
  const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<{ text: string; isError: boolean } | null>(null)

  const handleSave = async (body: SkillCreate | SkillUpdate) => {
    if (selectedSkill) {
      await updateSkill(selectedSkill.id, body as SkillUpdate)
      // Panel stays open after edit — user sees updated state
    } else {
      await createSkill(body as SkillCreate)
      setIsCreatingNew(false) // close after new skill created
    }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImporting(true)
    setImportMessage(null)
    try {
      const result = await importSkillZip(file)
      const created = result.created.length
      const failed = result.errors.length
      if (failed > 0 && created > 0) {
        setImportMessage({ text: `${created} skill${created > 1 ? "s" : ""} imported, ${failed} failed - check your ZIP.`, isError: false })
      } else if (created > 0) {
        setImportMessage({ text: `${created} skill${created > 1 ? "s" : ""} imported.`, isError: false })
      } else {
        setImportMessage({ text: "No skills were imported.", isError: true })
      }
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
    <div className="flex h-full overflow-hidden">
      {/* Pane 1: Decorative left — tonal depth anchor */}
      <div className="w-16 shrink-0 bg-sidebar" />

      {/* Pane 2: Center — page header + scrollable skill list */}
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
                  onToggleGlobal={toggleGlobal}
                  onTryInChat={onTryInChat ?? (() => {})}
                  onExport={exportSkill}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Pane 3: Right — inline detail/create panel */}
      <div
        className="w-96 shrink-0 border-l border-border/10 overflow-y-auto bg-card/30"
        role="region"
        aria-label="Skill details"
        aria-live="polite"
      >
        {selectedSkill || isCreatingNew ? (
          <SkillDetailPanel
            skill={selectedSkill}
            onSave={handleSave}
            onDiscard={() => { setSelectedSkill(null); setIsCreatingNew(false) }}
            currentUserId={user?.id}
          />
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
