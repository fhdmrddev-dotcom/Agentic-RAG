import { useState, useRef } from "react"
import { Plus, Zap, Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSkills } from "@/hooks/useSkills"
import { useAuth } from "@/hooks/useAuth"
import { SkillCard } from "@/components/skills/SkillCard"
import { SkillFormDialog } from "@/components/skills/SkillFormDialog"
import { exportSkill, importSkillZip } from "@/lib/api"
import { cn } from "@/lib/utils"
import type { Skill, SkillCreate, SkillUpdate } from "@/types"

interface Props {
  onTryInChat?: (skillName: string) => void
}

export function SkillsPage({ onTryInChat }: Props) {
  const { skills, loading, loadSkills, createSkill, updateSkill, deleteSkill, toggleEnabled, toggleGlobal } = useSkills()
  const { user } = useAuth()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importMessage, setImportMessage] = useState<{ text: string; isError: boolean } | null>(null)

  const handleCreate = () => {
    setEditingSkill(null)
    setDialogOpen(true)
  }

  const handleEdit = (skill: Skill) => {
    setEditingSkill(skill)
    setDialogOpen(true)
  }

  const handleSave = async (body: SkillCreate | SkillUpdate) => {
    if (editingSkill) {
      await updateSkill(editingSkill.id, body as SkillUpdate)
    } else {
      await createSkill(body as SkillCreate)
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
    <div className="flex flex-col h-full overflow-y-auto p-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
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
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Skill
          </Button>
        </div>
      </div>
      <input ref={fileInputRef} type="file" accept=".zip" className="hidden" onChange={handleImport} />
      {importMessage && (
        <p className={cn("text-sm mb-4", importMessage.isError ? "text-destructive" : "text-muted-foreground")}>
          {importMessage.text}
        </p>
      )}

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl bg-muted animate-pulse h-40" />
          ))}
        </div>
      ) : skills.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <Zap className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <h2 className="text-lg font-headline font-semibold text-foreground">No skills yet</h2>
          <p className="text-sm text-muted-foreground mt-1.5 mb-4 max-w-sm">
            Create your first skill to give the agent reusable behaviors.
          </p>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            New Skill
          </Button>
        </div>
      ) : (
        /* Skills grid */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              currentUserId={user?.id ?? ""}
              onEdit={handleEdit}
              onDelete={deleteSkill}
              onToggleEnabled={toggleEnabled}
              onToggleGlobal={toggleGlobal}
              onTryInChat={onTryInChat ?? (() => {})}
              onExport={exportSkill}
            />
          ))}
        </div>
      )}

      {/* Create/Edit dialog */}
      <SkillFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        skill={editingSkill}
        onSave={handleSave}
        currentUserId={user?.id}
      />
    </div>
  )
}
