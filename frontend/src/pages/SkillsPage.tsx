import { useState } from "react"
import { Plus, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useSkills } from "@/hooks/useSkills"
import { useAuth } from "@/hooks/useAuth"
import { SkillCard } from "@/components/skills/SkillCard"
import { SkillFormDialog } from "@/components/skills/SkillFormDialog"
import type { Skill, SkillCreate, SkillUpdate } from "@/types"

interface Props {
  onTryInChat?: (skillName: string) => void
}

export function SkillsPage({ onTryInChat }: Props) {
  const { skills, loading, createSkill, updateSkill, deleteSkill, toggleEnabled, toggleGlobal } = useSkills()
  const { user } = useAuth()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null)

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
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          New Skill
        </Button>
      </div>

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
      />
    </div>
  )
}
