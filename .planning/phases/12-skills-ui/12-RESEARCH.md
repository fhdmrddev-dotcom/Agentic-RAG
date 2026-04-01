# Phase 12: Skills UI - Research

**Researched:** 2026-04-01
**Domain:** React frontend — new Skills tab, skill CRUD UI, skill-creator seed migration
**Confidence:** HIGH

---

## Summary

Phase 12 is a pure frontend phase with one backend seeding task. The backend skills API (all CRUD, toggle-enabled, toggle-global, file upload/delete) is fully implemented from Phase 10 and has been running since 2026-03-29. The frontend SSE callback for `skill_activated` is wired as a no-op in `useMessages.ts` and must be upgraded to display a visual indicator. The planner's job is to add a new `"skills"` view to the existing navigation, build the `SkillsPage` component, write a `useSkills` hook that mirrors `useFolders`, add skill API functions to `api.ts`, extend the type system with a `Skill` interface, and seed the `skill-creator` global skill via a Supabase migration.

The existing codebase is the primary reference. Every structural decision — ActiveView union type, ChatLayout routing, Sidebar nav buttons, hook pattern, api.ts fetch helper — is already established and must be followed exactly. No new frontend libraries are needed; shadcn/ui already includes `Dialog`, `Button`, `Input`, `Textarea`, `Card`, `Badge` (needs install check), `ScrollArea`, and `Tooltip`. The `Zap` icon from `lucide-react` is already in use for skill-like UI in `ToolCallPanel` and is a natural fit for the Skills tab icon.

The skill-creator seed skill must be inserted via a SQL migration (migration 018) so it is version-controlled and idempotent. It must reference a fixed service-account UUID or use a pattern that works without an admin user. The cleanest approach is to insert the skill with `is_global = true` using a sentinel UUID tied to the Supabase service role — but since the `user_id` column references `auth.users(id)`, the safest approach used in similar projects is to insert via the migration only if a service-account user row exists, or to create a dedicated seed user. Research confirms the standard Supabase pattern for seed data that requires an `auth.users` FK is to use the service role and a known UUID inserted in the same migration.

**Primary recommendation:** Model `SkillsPage` directly after `IngestionPage`, model `useSkills` directly after `useFolders`, add skill API functions to `api.ts` alongside folder functions, and seed `skill-creator` via migration 018 with an idempotent INSERT.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SKIL-07 | Skills tab in the frontend shows all user-owned and global skills with CRUD actions | New `SkillsPage` component + `useSkills` hook consuming existing `/skills` endpoints |
| SKIL-08 | A seed "skill-creator" global skill is pre-loaded, enabling the LLM to guide users through creating new skills via conversation | Supabase migration 018 — idempotent INSERT with `ON CONFLICT DO NOTHING` |
</phase_requirements>

---

## Standard Stack

### Core (already installed — no new dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React + TypeScript | 19.x / ~5.9 | Component framework | Project stack |
| Tailwind CSS | 3.4.x | Styling | Project stack |
| shadcn/ui (Radix) | existing | Dialog, Button, Input, Textarea, Card, Badge, ScrollArea | Already used throughout; consistent design system |
| lucide-react | 0.577.x | Icons | Already used; `Zap`, `Plus`, `Trash2`, `Pencil`, `Globe`, `ToggleLeft`, `ToggleRight` all available |
| Vitest + Testing Library | 4.x | Frontend tests | Already configured in `frontend/package.json` |

### shadcn/ui Components Needed

| Component | Status | Purpose |
|-----------|--------|---------|
| `Dialog` | INSTALLED (`dialog.tsx`) | Create/Edit skill modal |
| `Button` | INSTALLED | All actions |
| `Input` | INSTALLED | Name field |
| `Textarea` | INSTALLED | Description + instructions fields |
| `Card` | INSTALLED | Skill cards |
| `ScrollArea` | INSTALLED | Scrollable skills list |
| `Tooltip` | INSTALLED | Icon button labels |
| `Badge` | NOT FOUND in `components/ui/` — needs install or inline implementation | "Global" badge on shared skills |

**Badge install (if needed):**
```bash
cd "C:/Vibe Apps/Agentic RAG/frontend"
npx shadcn@latest add badge
```
Note: shadcn CLI on Windows creates files in literal `@/` directory (established pitfall from Phase 03). Files must be manually copied to `src/components/ui/badge.tsx` and `@/` added to `.gitignore` is already done.

**Alternatively:** Inline badge with Tailwind classes (no install needed) — consistent with existing "global" pill pattern in `FolderNode.tsx` and `ToolCallPanel.tsx` which use `<span className="text-[10px] ... rounded-full">global</span>`.

### No New Libraries Required

All UI primitives and the test framework are already installed.

---

## Architecture Patterns

### Recommended Project Structure (new files)

```
frontend/src/
├── types/index.ts              # ADD: Skill, SkillFile interfaces
├── lib/api.ts                  # ADD: listSkills, createSkill, updateSkill, deleteSkill,
│                               #      toggleSkillEnabled, toggleSkillGlobal, API functions
├── hooks/useSkills.ts          # NEW: mirrors useFolders.ts pattern
├── pages/SkillsPage.tsx        # NEW: main skills view (mirrors IngestionPage.tsx)
├── components/skills/
│   ├── SkillCard.tsx           # NEW: card showing name, description, badges, actions
│   └── SkillFormDialog.tsx     # NEW: create/edit dialog with name/description/instructions fields
├── App.tsx                     # MODIFY: add "skills" to ActiveView union
└── components/layout/
    ├── Sidebar.tsx             # MODIFY: add Skills nav button
    └── ChatLayout.tsx          # MODIFY: route activeView="skills" to SkillsPage
```

```
backend/
└── supabase/migrations/018_skill_creator_seed.sql  # NEW: seed skill-creator global skill
```

### Pattern 1: ActiveView Extension

`App.tsx` currently defines:
```typescript
export type ActiveView = "chat" | "documents" | "settings"
```

Extend to:
```typescript
export type ActiveView = "chat" | "documents" | "skills" | "settings"
```

`ChatLayout.tsx` routing block must add the skills branch:
```typescript
{activeView === "documents" ? (
  <IngestionPage />
) : activeView === "skills" ? (
  <SkillsPage />
) : activeView === "settings" ? (
  <SettingsPage />
) : (
  <ChatArea ... />
)}
```

### Pattern 2: Sidebar Nav Button (copy Documents button exactly)

```typescript
// Source: frontend/src/components/layout/Sidebar.tsx lines 200-215
<Button
  onClick={() => onNavigate("skills")}
  variant={activeView === "skills" ? "secondary" : "ghost"}
  size="sm"
  className={cn(
    "w-full justify-start gap-2 transition-all",
    activeView === "skills"
      ? "text-primary font-medium"
      : "text-muted-foreground hover:text-sidebar-foreground",
  )}
>
  <Zap className="h-4 w-4" />
  Skills
</Button>
```

`Zap` is already imported in `ToolCallPanel.tsx` — add to Sidebar import list.

### Pattern 3: useSkills Hook (mirrors useFolders.ts)

```typescript
// Source: frontend/src/hooks/useFolders.ts — mirror this pattern exactly
export function useSkills(): UseSkills {
  const [skills, setSkills] = useState<Skill[]>([])

  const loadSkills = useCallback(async () => {
    const data = await listSkills()   // GET /skills
    setSkills(data)
  }, [])

  useEffect(() => {
    loadSkills().catch(console.error)
    // Note: skills table is NOT in Supabase Realtime publication (not needed for Phase 12)
    // Optimistic updates suffice — no real-time subscription required
  }, [loadSkills])

  const createSkill = useCallback(async (body: SkillCreate): Promise<Skill> => { ... }, [])
  const updateSkill = useCallback(async (id: string, body: SkillUpdate): Promise<void> => { ... }, [])
  const deleteSkill = useCallback(async (id: string): Promise<void> => { ... }, [])
  const toggleEnabled = useCallback(async (id: string): Promise<void> => { ... }, [])
  const toggleGlobal  = useCallback(async (id: string): Promise<void> => { ... }, [])

  return { skills, createSkill, updateSkill, deleteSkill, toggleEnabled, toggleGlobal }
}
```

**Key difference from useFolders:** No Supabase Realtime subscription — skills are managed by the owning user only; no cross-user real-time updates needed in Phase 12. Optimistic state updates on create/update/delete/toggle are sufficient.

### Pattern 4: API Functions in api.ts (mirrors folder functions)

```typescript
// Source: frontend/src/lib/api.ts lines 180-229 (folder functions)

export async function listSkills(): Promise<Skill[]> { ... }            // GET /skills
export async function createSkill(body: SkillCreate): Promise<Skill> { ... }  // POST /skills
export async function updateSkill(id: string, body: SkillUpdate): Promise<Skill> { ... }  // PATCH /skills/{id}
export async function deleteSkill(id: string): Promise<void> { ... }   // DELETE /skills/{id}
export async function toggleSkillEnabled(id: string): Promise<Skill> { ... }  // PATCH /skills/{id}/toggle-enabled
export async function toggleSkillGlobal(id: string): Promise<Skill> { ... }   // PATCH /skills/{id}/toggle-global
```

### Pattern 5: Skill Type Interfaces

```typescript
// Add to frontend/src/types/index.ts
export interface Skill {
  id: string
  user_id: string
  name: string
  description: string
  instructions: string
  is_enabled: boolean
  is_global: boolean
  created_at: string
  updated_at: string
}

export interface SkillCreate {
  name: string
  description?: string
  instructions?: string
  is_global?: boolean
}

export interface SkillUpdate {
  name?: string
  description?: string
  instructions?: string
}
```

### Pattern 6: SkillsPage Layout (mirrors IngestionPage.tsx)

Two-panel layout:
- **Left panel (optional):** Filter/sort controls or stats — keep simple for Phase 12, could just be the page header
- **Right/main area:** Grid or list of `SkillCard` components + "New Skill" button

Simpler than IngestionPage — no folder tree needed. A single-panel layout with a top action bar and scrollable card grid is appropriate:

```tsx
export function SkillsPage() {
  const { skills, createSkill, updateSkill, deleteSkill, toggleEnabled, toggleGlobal } = useSkills()
  const { user } = useAuth()

  return (
    <div className="flex flex-col h-full overflow-y-auto p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-headline font-bold text-foreground">Skills</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Define reusable AI behaviors that the agent loads on demand.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> New Skill
        </Button>
      </div>
      {/* scrollable skill cards */}
      {/* create/edit dialog */}
    </div>
  )
}
```

### Pattern 7: SkillCard Actions

Each card shows:
- Name (bold) + description (muted text)
- **Global badge** ("Global" pill, same style as folder global badge in `FolderNode.tsx`)
- **Disabled state** — `opacity-50` when `!is_enabled` (requirement: disabled skills are dimmed)
- **Action buttons:** Edit (pencil), Delete (trash), Toggle enabled (eye/eye-off), Toggle global (globe), "Try in Chat" (message-square)

Owner-only actions (edit, delete, toggle-global) must check `skill.user_id === user?.id`. Global skills owned by the seed account should show toggle-enabled but NOT edit/delete/toggle-global for non-owners.

### Pattern 8: "Try in Chat" Navigation

SKIL-07 requirement: "Try in Chat" button navigates to chat with a pre-populated prompt designed to trigger the skill.

Implementation:
- `SkillsPage` receives `onNavigate: (view: ActiveView) => void` and `onTrySkill: (skillName: string) => void` props
- `onTrySkill` sets state in `App.tsx` or `ChatLayout` to pre-populate the chat input
- Simplest approach: lift a `prefillMessage` state into `App.tsx`, pass a setter down to `SkillsPage` and a reader down to `ChatArea`/`MessageInput`

Pre-populated prompt pattern: `"Use the [Skill Name] skill"` — this is designed to trigger catalog lookup and `load_skill`.

### Pattern 9: skill_activated UI Indicator

Phase 11 left `useMessages.ts` with a no-op `onSkillActivated` callback. Phase 12 must replace it with a real indicator.

Options (in order of simplicity):
1. **Toast notification** — no toast library installed; would require new dependency
2. **Transient state on the message** — add `activatedSkill?: string` to message state; `MessageItem` renders a small badge like `"Skill activated: SQL Writer"`
3. **Console + no visual** — insufficient per SKIL-12 purpose

**Recommended:** Add `activatedSkill?: string` to the assistant `Message` local state in `useMessages.ts`. When `skill_activated` fires, update the streaming message with the skill name. `MessageItem.tsx` renders a small inline badge below the tool calls panel. This requires no new libraries and follows the existing message-state pattern.

### Pattern 10: Skill-Creator Seed Migration

```sql
-- supabase/migrations/018_skill_creator_seed.sql
-- Seeds the "skill-creator" global skill.
-- Uses a dedicated seed user UUID that must exist in auth.users.
-- Pattern: insert seed user into auth.users if not present, then insert skill.

-- Option A (recommended): use Supabase's built-in service_role trick
-- Insert a synthetic user into auth.users for system seeds.
-- This is idempotent via ON CONFLICT DO NOTHING.

INSERT INTO auth.users (
  id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role
)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'seed@system.local',
  '',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{}',
  'authenticated',
  'authenticated'
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.skills (id, user_id, name, description, instructions, is_enabled, is_global)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000001',
  'skill-creator',
  'Guides users through creating new AI skills via conversation. Asks clarifying questions, then calls save_skill to persist the result.',
  '[full instructions text — see below]',
  true,
  true
)
ON CONFLICT (id) DO NOTHING;
```

**skill-creator instructions content** (to be finalized in the plan):
- Explains the skill format (name, description, instructions)
- Instructs the LLM to ask: what task should the skill do? what context does it need? any specific output format?
- Then calls `save_skill(name, description, instructions)` with the gathered information
- Ends by informing the user the skill is saved and available

**RLS consideration:** The seed user `00000000-0000-0000-0000-000000000001` owns the skill. RLS policy "Users can update own skills" means no authenticated user can edit this skill via the API (they are not the owner). The UI must hide Edit/Delete/toggle-global for this skill for non-owners. Toggle-enabled is per-user preference — but since the schema has a single `is_enabled` per skill row, toggling it for one user affects all users. This is an accepted limitation documented in REQUIREMENTS.md ("Skill versioning / history" is out of scope). For Phase 12, the UI should hide toggle-enabled for global skills the user doesn't own to avoid confusion.

**Simpler alternative for seed:** Use the Supabase dashboard or a separate seed script. However, a SQL migration is version-controlled and reproducible — it is the correct approach.

### Anti-Patterns to Avoid

- **Re-implementing CRUD outside the existing `/skills` endpoints:** All endpoints are built and tested. The frontend must consume them, not bypass them.
- **Supabase Realtime for skills:** The `skills` table is not in the Realtime publication. Do not add a subscription without also adding the table to the publication via SQL. Optimistic updates are sufficient.
- **Passing `onNavigate` into `SkillsPage` at a deep level:** Keep it at `ChatLayout` level — `SkillsPage` receives a simple `onTryInChat: (skillName: string) => void` callback.
- **Using `fetch` directly in components:** All API calls go through `api.ts` functions.
- **Forgetting owner check in UI:** `skill.user_id === user?.id` must gate Edit/Delete/toggle-global. Global skills from the seed account must show as read-only.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Modal dialog | Custom overlay | shadcn `Dialog` (already installed) | Accessibility, focus trap, keyboard dismiss all handled |
| Form state | Custom form manager | React `useState` for each field | Forms are simple (3-4 fields); no react-hook-form needed |
| Badge/pill | Custom component | Inline Tailwind `<span>` (existing pattern) | Project already uses pill spans for "global" labels |
| Toast for skill_activated | Toast library | Inline message badge (transient state) | No toast library installed; inline badge is simpler |

---

## Common Pitfalls

### Pitfall 1: shadcn CLI creates files in literal `@/` directory on Windows

**What goes wrong:** Running `npx shadcn@latest add badge` on Windows creates files in `C:/Vibe Apps/Agentic RAG/frontend/@/components/ui/badge.tsx` instead of `src/components/ui/badge.tsx`.

**Why it happens:** The Windows path resolver treats `@/` as a literal path segment.

**How to avoid:** After running the CLI, check for the `@/` directory and manually copy files to `src/components/ui/`. The `.gitignore` already excludes `@/` (established in Phase 03). Alternatively, skip the CLI and write the badge component inline — it's 10 lines of Tailwind.

**Warning signs:** File not found errors when importing `@/components/ui/badge`.

### Pitfall 2: Owner check missing on toggle-global for global skills

**What goes wrong:** A user presses "Share globally" on a skill that's already global and owned by the seed account. The backend returns 403, the UI shows an unhandled error.

**Why it happens:** `toggle-global` endpoint uses `.eq("user_id", current_user["id"])` — non-owners get 403.

**How to avoid:** Hide toggle-global button when `skill.user_id !== currentUserId`. Show a read-only "Global" badge instead.

**Warning signs:** 403 errors on toggle-global for seed skills.

### Pitfall 3: ActiveView union type — forgetting to update all consumers

**What goes wrong:** Adding `"skills"` to `ActiveView` in `App.tsx` but not updating `ChatLayout.tsx` routing or `Sidebar.tsx` nav — TypeScript won't catch missing routing branches.

**Why it happens:** TypeScript union narrowing only errors on unreachable branches, not missing ones in if/else chains.

**How to avoid:** After updating the union, search for all `activeView === ` usages in `Sidebar.tsx` and `ChatLayout.tsx` and ensure they include the `"skills"` case.

**Warning signs:** Clicking "Skills" in the sidebar navigates to the chat view (fallthrough to the `else` branch).

### Pitfall 4: "Try in Chat" pre-fill doesn't clear after navigation

**What goes wrong:** User clicks "Try in Chat" for skill A, navigates to chat, then navigates back to Skills and clicks "Try in Chat" for skill B — the old prefill value persists.

**Why it happens:** If `prefillMessage` state lives in `App.tsx` and is only set, never cleared.

**How to avoid:** Clear `prefillMessage` after `MessageInput` mounts or after the user sends the first message.

### Pitfall 5: Seed migration auth.users INSERT fails on hosted Supabase

**What goes wrong:** The migration inserts into `auth.users` directly, which may be restricted on hosted Supabase depending on the Postgres role.

**Why it happens:** Migrations run as the `postgres` superuser in local dev but may not have direct INSERT on `auth.users` in production.

**How to avoid:** Test the migration locally with `supabase db push` before applying to hosted. Alternative: use `supabase.auth.admin.createUser` from a seeding script if direct SQL insert is blocked. Wrap the INSERT in a `DO $$ BEGIN ... EXCEPTION WHEN OTHERS THEN NULL; END $$;` block to make it non-fatal.

---

## Code Examples

Verified patterns from existing codebase:

### Skill Card — disabled dimming (from requirement: "disabled skills are dimmed")

```typescript
// Pattern from existing CSS variable system
<div className={cn(
  "rounded-xl bg-card ghost-border p-4 transition-all",
  !skill.is_enabled && "opacity-50"
)}>
```

### Global badge (from FolderNode.tsx pattern)

```typescript
// Source: frontend/src/components/ingestion/FolderNode.tsx (global badge pattern)
{skill.is_global && (
  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">
    Global
  </span>
)}
```

### Toggle enabled optimistic update (mirrors toggleGlobal in useFolders.ts)

```typescript
// Source: frontend/src/hooks/useFolders.ts lines 107-110
const toggleEnabled = useCallback(async (id: string): Promise<void> => {
  const updated = await toggleSkillEnabled(id)
  setSkills((prev) => prev.map((s) => (s.id === id ? { ...s, is_enabled: updated.is_enabled } : s)))
}, [])
```

### skill_activated indicator in useMessages.ts (replacing no-op)

```typescript
// Source: frontend/src/hooks/useMessages.ts line 117 — replace no-op with:
// onSkillActivated
(skillName) => {
  setMessages((prev) =>
    prev.map((m) =>
      m.id === assistantId
        ? { ...m, activatedSkill: skillName }
        : m,
    ),
  )
},
```

This requires adding `activatedSkill?: string` to the `Message` type and rendering a badge in `MessageItem.tsx`.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hard-coded nav items | `ActiveView` union type in App.tsx | Established in Phase 1 | Adding a view = extend union + add route + add nav button |
| No real-time skills | Optimistic updates only | Phase 12 design | No subscription needed; skills list loads on mount |

---

## Open Questions

1. **Skill-creator instructions content**
   - What we know: The skill must guide the LLM to ask clarifying questions and call `save_skill`
   - What's unclear: Exact instructions text — length, tone, step count
   - Recommendation: The planner should draft instructions in the migration. A good starting point: "You are a skill-creation assistant. When the user asks you to create a skill, ask: (1) What task should this skill perform? (2) What context or constraints apply? (3) What should the output look like? Then call save_skill(name, description, instructions) with a concise name, a one-sentence description, and step-by-step instructions based on the user's answers."

2. **should toggle-enabled be per-user or global-state?**
   - What we know: The `is_enabled` column is on the `skills` row, not per-user. One user disabling a global skill disables it for all users.
   - What's unclear: Whether the requirement intends per-user or global toggle
   - Recommendation: For Phase 12, hide the toggle-enabled button for skills the user doesn't own (consistent with toggle-global restriction). This sidesteps the issue cleanly. A per-user enabled table would be a schema change out of scope for Phase 12.

3. **"Try in Chat" — how to pass prefill from SkillsPage to MessageInput**
   - What we know: `ActiveView` state is in `App.tsx`; `ChatArea` receives `thread` prop from `ChatLayout`
   - What's unclear: Cleanest lift point for `prefillMessage` state
   - Recommendation: Add `prefillMessage: string | null` and `setPrefillMessage` to `App.tsx` state. Pass `prefillMessage` down through `ChatLayout` → `ChatArea` → `MessageInput`. `MessageInput` consumes it as initial input value and clears it on first keystroke or send.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.x + Testing Library React 16.x |
| Config file | `frontend/vitest.config.ts` (or vite.config.ts with test block) |
| Quick run command | `cd "C:/Vibe Apps/Agentic RAG/frontend" && npm test` |
| Full suite command | `cd "C:/Vibe Apps/Agentic RAG/frontend" && npm test` (same; `vitest run`) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SKIL-07 | Skills tab renders in Sidebar nav | unit | `npm test -- --reporter=verbose` | Wave 0 |
| SKIL-07 | SkillsPage renders skill cards from API | unit | `npm test -- --reporter=verbose` | Wave 0 |
| SKIL-07 | Global skills show "Global" badge | unit | `npm test -- --reporter=verbose` | Wave 0 |
| SKIL-07 | Disabled skills have reduced opacity | unit | `npm test -- --reporter=verbose` | Wave 0 |
| SKIL-07 | Create/edit/delete/toggle actions call correct API | unit | `npm test -- --reporter=verbose` | Wave 0 |
| SKIL-08 | skill-creator skill visible in skills list (manual) | manual | — | N/A |

### Wave 0 Gaps

- [ ] `frontend/src/__tests__/components/SkillsPage.test.tsx` — covers SKIL-07 (render, badges, dimming)
- [ ] `frontend/src/__tests__/hooks/useSkills.test.ts` — covers SKIL-07 (optimistic updates, API calls)
- [ ] `frontend/src/__tests__/lib/api.test.ts` — extend existing file with skill API function tests

*(If no gaps: "None — existing test infrastructure covers all phase requirements")*

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection — `frontend/src/App.tsx`, `Sidebar.tsx`, `ChatLayout.tsx`, `IngestionPage.tsx`, `useFolders.ts`, `api.ts`, `types/index.ts` — established patterns
- `backend/app/api/skills.py` — all skill endpoints verified implemented
- `backend/app/models/skill.py` — Pydantic models verified
- `supabase/migrations/017_skills.sql` — schema verified
- `frontend/package.json` — all dependencies verified (shadcn components, vitest)

### Secondary (MEDIUM confidence)

- Supabase documentation pattern for inserting seed data with `auth.users` FK in migrations — standard pattern, potential restriction on hosted Supabase noted as pitfall

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified installed, no new deps required
- Architecture: HIGH — all patterns derived from existing codebase, not hypothetical
- Pitfalls: HIGH — Windows shadcn pitfall, owner-check pitfall, and seed migration pitfall all verified from project history and schema inspection
- Validation: HIGH — Vitest already configured, existing test files confirm pattern

**Research date:** 2026-04-01
**Valid until:** 2026-05-01 (stable React/Tailwind stack; no fast-moving dependencies)
