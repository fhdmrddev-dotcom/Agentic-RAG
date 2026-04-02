import { useState, useEffect, useCallback } from "react"
import {
  listSkills,
  createSkill as apiCreateSkill,
  updateSkill as apiUpdateSkill,
  deleteSkill as apiDeleteSkill,
  toggleSkillEnabled as apiToggleSkillEnabled,
  toggleSkillGlobal as apiToggleSkillGlobal,
} from "@/lib/api"
import type { Skill, SkillCreate, SkillUpdate } from "@/types"

interface UseSkills {
  skills: Skill[]
  loading: boolean
  loadSkills: () => Promise<void>
  createSkill: (body: SkillCreate) => Promise<Skill>
  updateSkill: (id: string, body: SkillUpdate) => Promise<Skill>
  deleteSkill: (id: string) => Promise<void>
  toggleEnabled: (id: string) => Promise<void>
  toggleGlobal: (id: string) => Promise<void>
}

export function useSkills(): UseSkills {
  const [skills, setSkills] = useState<Skill[]>([])
  const [loading, setLoading] = useState(true)

  const loadSkills = useCallback(async () => {
    setLoading(true)
    try {
      const data = await listSkills()
      setSkills(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSkills().catch(console.error)
  }, [loadSkills])

  const createSkill = useCallback(async (body: SkillCreate): Promise<Skill> => {
    const skill = await apiCreateSkill(body)
    setSkills((prev) => [skill, ...prev])
    return skill
  }, [])

  const updateSkill = useCallback(async (id: string, body: SkillUpdate): Promise<Skill> => {
    const updated = await apiUpdateSkill(id, body)
    setSkills((prev) => prev.map((s) => (s.id === id ? updated : s)))
    return updated
  }, [])

  const deleteSkill = useCallback(async (id: string): Promise<void> => {
    await apiDeleteSkill(id)
    setSkills((prev) => prev.filter((s) => s.id !== id))
  }, [])

  const toggleEnabled = useCallback(async (id: string): Promise<void> => {
    const updated = await apiToggleSkillEnabled(id)
    setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, is_enabled: updated.is_enabled } : s)))
  }, [])

  const toggleGlobal = useCallback(async (id: string): Promise<void> => {
    const updated = await apiToggleSkillGlobal(id)
    setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, is_global: updated.is_global } : s)))
  }, [])

  return { skills, loading, loadSkills, createSkill, updateSkill, deleteSkill, toggleEnabled, toggleGlobal }
}
