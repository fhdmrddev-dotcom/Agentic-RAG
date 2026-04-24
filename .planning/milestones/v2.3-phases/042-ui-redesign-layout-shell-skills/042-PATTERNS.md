# Phase 42: UI Redesign — Layout Shell & Skills - Pattern Map

**Mapped:** 2026-04-19
**Files analyzed:** 7 (1 create, 6 modify)
**Analogs found:** 7 / 7

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/src/components/layout/AppDock.tsx` | component (nav rail) | event-driven | `frontend/src/components/layout/Sidebar.tsx` | role-match (nav behavior, active state, icon pattern) |
| `frontend/src/components/layout/ChatLayout.tsx` | layout shell | request-response | `frontend/src/components/layout/ChatLayout.tsx` | self (structural flex layout modification) |
| `frontend/src/components/layout/Sidebar.tsx` | component (thread list) | event-driven | `frontend/src/components/layout/Sidebar.tsx` | self (nav button removal surgery) |
| `frontend/src/pages/SkillsPage.tsx` | page (3-pane) | CRUD | `frontend/src/pages/SkillsPage.tsx` + `frontend/src/pages/SettingsPage.tsx` | self + tonal analog |
| `frontend/src/components/skills/SkillCard.tsx` | component (card) | event-driven | `frontend/src/components/skills/SkillCard.tsx` + `frontend/src/pages/SettingsPage.tsx` `Toggle` | self + toggle analog |
| `frontend/src/components/skills/SkillFormDialog.tsx` | component (form panel) | CRUD | `frontend/src/components/skills/SkillFormDialog.tsx` | self (modal → inline panel extraction) |
| `frontend/src/pages/SettingsPage.tsx` | page (settings) | CRUD | `frontend/src/pages/SettingsPage.tsx` + `frontend/src/components/health/HealthPanel.tsx` | self + tonal analog |

---

## Pattern Assignments

### `frontend/src/components/layout/AppDock.tsx` (CREATE — nav rail component)

**Primary analog:** `frontend/src/components/layout/Sidebar.tsx`

**Imports pattern** — copy from `Sidebar.tsx` lines 1–6, adapt icon set:
```tsx
import { cn } from "@/lib/utils"
import { MessageSquare, FileText, Activity, Zap, Settings, LogOut } from "lucide-react"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { ActiveView } from "@/App"
```

**Props interface** — derive from `Sidebar.tsx` lines 8–22, reduce to nav-only:
```tsx
interface Props {
  activeView: ActiveView
  onNavigate: (view: ActiveView) => void
  onSignOut: () => void
}
```

**Shell container** — copy `Sidebar.tsx` line 69 structural pattern, change width/bg:
```tsx
// Sidebar.tsx line 69 (reference):
// <div className="flex flex-col h-full w-64 bg-sidebar overflow-hidden border-r border-border/20">
// AppDock adaptation:
<div className="flex flex-col h-full w-14 bg-sidebar border-r border-border/20 shrink-0">
  {/* top icon cluster */}
  {/* bottom: sign out */}
</div>
```

**Active icon pill** — extend the `gradient-primary shadow-sm shadow-primary/20` pattern from `Sidebar.tsx` lines 72–74 (logo block uses the identical pill shape):
```tsx
// Sidebar.tsx lines 72-74 (logo pill — identical shape/gradient to use for active nav):
<div className="flex items-center justify-center w-9 h-9 rounded-xl gradient-primary shadow-sm shadow-primary/20">
  <Sparkles className="w-4.5 h-4.5 text-white" />
</div>

// AppDock active icon pill (w-10 h-10 per UI-SPEC):
<div className="flex items-center justify-center w-10 h-10 rounded-xl gradient-primary shadow-sm shadow-primary/20">
  <Icon className="w-4 h-4 text-white" />
</div>
```

**Inactive icon button + hover state** — copy `Sidebar.tsx` lines 210–221 inactive nav button className pattern, strip text label:
```tsx
// Sidebar.tsx lines 213-218 (inactive nav button pattern):
className={cn(
  "w-full justify-start gap-2 transition-all py-2",
  activeView === "documents"
    ? "bg-primary/10 text-primary font-medium"
    : "text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40",
)}

// AppDock inactive button (icon-only, square touch target):
<button
  className="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
  aria-label="Skills"
  aria-current={activeView === "skills" ? "page" : undefined}
  onClick={() => onNavigate("skills")}
>
  <Zap className="w-4 h-4" />
</button>
```

**Tooltip wrapping** — copy `SkillCard.tsx` lines 145–164 `<Tooltip><TooltipTrigger asChild>` pattern (already in the project, `TooltipProvider` wraps the whole app in `App.tsx` line 28):
```tsx
// SkillCard.tsx lines 145-163 (Tooltip pattern to replicate for AppDock icons):
<Tooltip>
  <TooltipTrigger asChild>
    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleToggleEnabled}>
      {localEnabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
    </Button>
  </TooltipTrigger>
  <TooltipContent>
    {localEnabled ? "Disable skill" : "Enable skill"}
  </TooltipContent>
</Tooltip>

// AppDock adaptation — add side="right":
<Tooltip>
  <TooltipTrigger asChild>
    <button aria-label="Skills" ...>
      <Zap className="w-4 h-4" />
    </button>
  </TooltipTrigger>
  <TooltipContent side="right">Skills</TooltipContent>
</Tooltip>
```

**Sign Out button** — copy `Sidebar.tsx` lines 279–286:
```tsx
// Sidebar.tsx lines 279-286:
<Button
  onClick={onSignOut}
  variant="ghost"
  size="sm"
  className="w-full justify-start gap-2 text-muted-foreground hover:text-destructive transition-all py-2"
>
  <LogOut className="h-4 w-4" />
  Sign Out
</Button>
// AppDock: icon-only, wrap in Tooltip with side="right", aria-label="Sign out"
```

**Nav items array** — define statically to drive the icon loop:
```tsx
const NAV_ITEMS = [
  { view: "chat" as ActiveView,           icon: MessageSquare, label: "Chat" },
  { view: "documents" as ActiveView,      icon: FileText,      label: "Documents" },
  { view: "library-health" as ActiveView, icon: Activity,      label: "Library Health" },
  { view: "skills" as ActiveView,         icon: Zap,           label: "Skills" },
  { view: "settings" as ActiveView,       icon: Settings,      label: "Settings" },
] as const
```

---

### `frontend/src/components/layout/ChatLayout.tsx` (MODIFY — add AppDock column)

**Analog:** `frontend/src/components/layout/ChatLayout.tsx` (self)

**Current shell** (lines 56–86) — the `flex h-screen bg-background` div contains only `<Sidebar>` and `<main>`. Change is purely structural: prepend `<AppDock>` and pass the same props already flowing to `<Sidebar>`.

**Current outer div** (line 56):
```tsx
// ChatLayout.tsx line 56 — current:
<div className="flex h-screen bg-background">
  <Sidebar ... />
  <main className="flex-1 overflow-hidden">...</main>
</div>

// After modification:
<div className="flex h-screen bg-background">
  <AppDock activeView={activeView} onNavigate={onNavigate} onSignOut={onSignOut} />
  <Sidebar ... />
  <main className="flex-1 overflow-hidden">...</main>
</div>
```

**Props already available in scope** (lines 21–22, 57–71):
- `activeView` — already a prop, pass directly to `<AppDock>`
- `onNavigate` — already a prop, pass directly to `<AppDock>`
- `onSignOut` — already a prop, pass directly to `<AppDock>`

**Import to add:**
```tsx
import { AppDock } from "./AppDock"
```

**Sidebar props to remove after Sidebar surgery:** `onSignOut`, `activeView`, `onNavigate` — these will no longer be needed by `<Sidebar>` once nav buttons are removed. Update the `<Sidebar>` JSX call at lines 57–71 to drop those three props.

---

### `frontend/src/components/layout/Sidebar.tsx` (MODIFY — remove nav buttons, retain thread list)

**Analog:** `frontend/src/components/layout/Sidebar.tsx` (self — surgical deletion)

**Remove from Props interface** (lines 8–22): `activeView`, `onNavigate`, `onSignOut`.

**Remove from destructured params** (lines 24–38): `onSignOut`, `activeView`, `onNavigate`.

**Delete the entire fixed footer section** (lines 200–290): the `{/* Fixed Area — Knowledge Base + Footer */}` block including `Knowledge Base` nav buttons and `Sign Out` button. Retain only the theme toggle button (lines 270–278) relocated into the footer area.

**Retain these blocks intact:**
- Logo block (lines 70–79)
- Scrollable thread list (lines 81–198)
- New Chat button (lines 87–95)
- Theme toggle (lines 270–278) — keep in a minimal footer after nav removal

**Active thread state pattern to keep** (lines 131–141):
```tsx
// Sidebar.tsx lines 131-141 — retain as-is (thread active state, not nav active state):
className={cn(
  "relative rounded-lg cursor-pointer transition-all duration-150 py-1.5",
  isSelected
    ? "bg-primary/10 text-primary"
    : "text-muted-foreground hover:bg-accent/40 hover:text-sidebar-foreground",
)}
// Active indicator bar:
{isSelected && (
  <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-primary" />
)}
```

---

### `frontend/src/pages/SkillsPage.tsx` (MODIFY — 3-pane layout + inline detail)

**Analog:** `frontend/src/pages/SkillsPage.tsx` (self) + `frontend/src/pages/SettingsPage.tsx` (tonal pane depth)

**State additions** — add to existing state block (lines 19–23):
```tsx
// Add alongside existing dialogOpen, editingSkill:
const [selectedSkill, setSelectedSkill] = useState<Skill | null>(null)
// dialogOpen can be retired for the primary flow; SkillFormDialog modal kept as fallback
```

**Outer shell change** (line 71) — change `flex-col overflow-y-auto p-8` to 3-pane flex:
```tsx
// Current (line 71):
<div className="flex flex-col h-full overflow-y-auto p-8">

// After:
<div className="flex h-full overflow-hidden">
  {/* Pane 1: Decorative left */}
  <div className="w-16 shrink-0 bg-sidebar" />

  {/* Pane 2: Center — skill list */}
  <div className="flex flex-col flex-1 min-w-0 overflow-hidden border-r border-border/10">
    {/* Header (lines 73-94 content, relocated here) */}
    <div className="px-8 pt-8 pb-6 flex items-center justify-between shrink-0">...</div>
    {/* Scrollable list */}
    <div className="flex-1 overflow-y-auto px-8 pb-8">...</div>
  </div>

  {/* Pane 3: Right — inline detail panel */}
  <div className="w-96 shrink-0 border-l border-border/10 overflow-y-auto bg-card/30"
       role="region" aria-label="Skill details" aria-live="polite">
    {selectedSkill ? <SkillDetailPanel ... /> : <EmptyDetailState />}
  </div>
</div>
```

**Skill list layout change** (line 124) — change 3-col grid to single-column list:
```tsx
// Current (line 124):
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

// After (single column list in constrained center pane):
<div className="space-y-3">
```

**SkillCard onSelect prop** — add `onSelect` to the `<SkillCard>` call alongside `onEdit`:
```tsx
// SkillsPage.tsx lines 126-136 — add onSelect:
<SkillCard
  key={skill.id}
  skill={skill}
  currentUserId={user?.id ?? ""}
  onEdit={handleEdit}
  onSelect={(skill) => setSelectedSkill(skill)}   // NEW
  onDelete={deleteSkill}
  onToggleEnabled={toggleEnabled}
  onToggleGlobal={toggleGlobal}
  onTryInChat={onTryInChat ?? (() => {})}
  onExport={exportSkill}
/>
```

**Right pane empty state** — copy `SkillsPage.tsx` lines 110–121 empty state pattern, scale down icon:
```tsx
// Reference (SkillsPage.tsx lines 110-121 — full-page empty state):
<div className="flex flex-col items-center justify-center flex-1 text-center">
  <Zap className="h-12 w-12 text-muted-foreground/30 mb-4" />
  <h2 className="text-lg font-headline font-semibold text-foreground">No skills yet</h2>
</div>

// Right pane empty state (smaller icon, no CTA):
<div className="flex flex-col items-center justify-center h-full text-center px-6">
  <Zap className="h-10 w-10 text-muted-foreground/30 mb-3" />
  <p className="text-sm font-medium text-muted-foreground">Select a skill to view details</p>
</div>
```

**Right pane selected — panel header:**
```tsx
<div className="px-6 pt-6 pb-4 border-b border-border/10 shrink-0">
  <p className="text-base font-headline font-bold text-foreground">{selectedSkill.name}</p>
  <p className="text-xs text-muted-foreground mt-0.5">{selectedSkill ? "Edit Skill" : "New Skill"}</p>
</div>
```

**Right pane footer** — copy `SkillFormDialog.tsx` lines 184–196 footer pattern, adapt to inline:
```tsx
// SkillFormDialog.tsx lines 184-196 (footer reference):
<DialogFooter className="flex-col items-stretch gap-2 shrink-0">
  {error && <p className="text-sm text-destructive">{error}</p>}
  <div className="flex justify-end gap-2">
    <Button variant="ghost" onClick={() => onOpenChange(false)}>Discard Changes</Button>
    <Button onClick={handleSave} disabled={!name.trim() || saving}>
      {isEdit ? "Update Skill" : "Save Skill"}
    </Button>
  </div>
</DialogFooter>

// Inline panel footer (replace DialogFooter with plain div):
<div className="px-6 pt-4 pb-6 border-t border-border/10 flex justify-end gap-2 shrink-0">
  <Button variant="ghost" onClick={() => setSelectedSkill(null)}>Discard Changes</Button>
  <Button onClick={handleSave} disabled={!name.trim() || saving}>
    {selectedSkill ? "Update Skill" : "Save Skill"}
  </Button>
</div>
```

---

### `frontend/src/components/skills/SkillCard.tsx` (MODIFY — gradient toggle + onSelect prop)

**Analog:** `frontend/src/components/skills/SkillCard.tsx` (self) + `frontend/src/pages/SettingsPage.tsx` `Toggle` component (lines 63–85)

**Add `onSelect` prop** to the Props interface (lines 8–17):
```tsx
// Add after onTryInChat:
onSelect: (skill: Skill) => void
```

**Toggle track gradient** — reference `SettingsPage.tsx` lines 63–85 for the current `bg-primary` track pattern, then apply inline style upgrade:
```tsx
// SettingsPage.tsx lines 73-76 (current toggle track — copy structure, upgrade bg):
<div className={cn(
  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors",
  checked ? "bg-primary" : "bg-muted",
)}>

// SkillCard toggle track (upgrade — gradient via inline style when enabled):
<div
  className={cn(
    "relative inline-flex h-5 w-9 items-center rounded-full transition-all duration-200",
    !localEnabled && "bg-muted",
  )}
  style={localEnabled ? {
    backgroundImage: "linear-gradient(135deg, hsl(239 84% 67%), hsl(258 90% 66%))"
  } : undefined}
>
  <span className={cn(
    "inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform",
    localEnabled ? "translate-x-4" : "translate-x-1",
  )} />
</div>
```

Note: `gradient-primary` in `index.css` line 96 uses `background: linear-gradient(135deg, hsl(239 84% 67%), hsl(258 90% 66%))` — the inline style replicates this exactly without introducing new CSS.

**Card click to select** — add `onClick` to the card root div (line 79), alongside existing `cn()` classes:
```tsx
// SkillCard.tsx line 78-83 (current root div — add onClick):
<div
  className={cn(
    "rounded-xl bg-card ghost-border p-4 transition-all animate-fadeSlideUp cursor-pointer",
    !localEnabled && "opacity-50",
  )}
  onClick={() => onSelect(skill)}
>
```

The Pencil/edit button (lines 188–198) should also call `onSelect(skill)` instead of (or in addition to) `onEdit(skill)`.

---

### `frontend/src/components/skills/SkillFormDialog.tsx` (MODIFY — extract form content as `SkillForm`)

**Analog:** `frontend/src/components/skills/SkillFormDialog.tsx` (self)

**Refactor strategy:** Extract the inner form content (lines 112–182) into a separate `SkillForm` component that both `SkillFormDialog` (modal) and `SkillDetailPanel` (inline) can render.

**New `SkillForm` inner component** — wrap lines 112–182 in a named component:
```tsx
// SkillFormDialog.tsx lines 112-182 — current inner form markup:
<div className="flex flex-col gap-4 py-2 overflow-y-auto flex-1 min-h-0 pr-1">
  {/* Name, Description, Instructions, Attached Files */}
</div>

// Extract as:
interface SkillFormProps {
  name: string; setName: (v: string) => void
  description: string; setDescription: (v: string) => void
  instructions: string; setInstructions: (v: string) => void
  isEdit: boolean; isOwner: boolean; skill?: Skill | null
  files: SkillFile[]; uploading: boolean; fileError: string | null
  onAttach: (e: React.ChangeEvent<HTMLInputElement>) => void
  onDeleteFile: (id: string) => void
  fileInputRef: React.RefObject<HTMLInputElement>
}

function SkillForm({ ... }: SkillFormProps) {
  return (
    <div className="flex flex-col gap-4">
      {/* Name */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium text-foreground">Name</label>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. SQL Writer" />
      </div>
      {/* Description, Instructions, Attached Files — verbatim from lines 124-181 */}
    </div>
  )
}
```

**New `SkillDetailPanel` export** — inline panel wrapper that uses `SkillForm` without `<Dialog>`:
```tsx
interface SkillDetailPanelProps {
  skill: Skill | null
  onSave: (body: SkillCreate | SkillUpdate) => Promise<void>
  onDiscard: () => void
  currentUserId?: string
}

export function SkillDetailPanel({ skill, onSave, onDiscard, currentUserId }: SkillDetailPanelProps) {
  // Same state setup as SkillFormDialog lines 28-36, same useEffect lines 39-54
  // Renders <SkillForm> + plain div footer (not <DialogFooter>)
}
```

**Retain `SkillFormDialog`** unchanged as the modal fallback — it just delegates inner content to `<SkillForm>`:
```tsx
// SkillFormDialog lines 105-199 (Dialog wrapper) — retain, replace inner div content with <SkillForm />:
return (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-lg flex flex-col max-h-[90vh]">
      <DialogHeader className="shrink-0">
        <DialogTitle>{isEdit ? "Edit Skill" : "New Skill"}</DialogTitle>
      </DialogHeader>
      <SkillForm ... />    {/* replaces the inlined div */}
      <DialogFooter ...>  {/* unchanged lines 184-196 */}
        ...
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
```

**Env/API key input styling** — `SkillFormDialog.tsx` has no env-specific inputs currently. For any future env fields added to `SkillForm`, use the `SettingsPage.tsx` `ApiKeyInput` component pattern (lines 87–112) with the D-11 override:
```tsx
// SettingsPage.tsx lines 99 (existing pattern):
className="h-8 text-sm font-mono bg-muted/30 ghost-border pr-8"

// D-11 upgrade for SkillForm env inputs:
className="h-8 text-sm font-mono bg-card/50 ghost-border rounded-lg pr-8"
```

**Required/ReadOnly badge placement** — wrap input + badge in a flex row:
```tsx
// Field row with Required badge (D-10):
<div className="flex items-center gap-2">
  <Input className="flex-1 ..." />
  <span className="bg-rose-500/10 text-rose-400 text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0">
    Required
  </span>
</div>

// Field row with Read Only badge:
<div className="flex items-center gap-2">
  <Input className="flex-1 ..." readOnly />
  <span className="bg-muted text-muted-foreground text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0">
    Read Only
  </span>
</div>
```

---

### `frontend/src/pages/SettingsPage.tsx` (MODIFY — tonal card treatment)

**Analog:** `frontend/src/pages/SettingsPage.tsx` (self) + `frontend/src/components/health/HealthPanel.tsx` (tonal card reference)

**`SectionCard` component** (lines 114–128) — single change, `/50` → `/60`:
```tsx
// SettingsPage.tsx lines 114-128 — current SectionCard:
function SectionCard({ title, description, children }: {
  title: string; description: string; children: React.ReactNode
}) {
  return (
    <Card className="ghost-border bg-card/50 shadow-sm">   {/* CHANGE /50 → /60 */}
      <CardHeader>
        <CardTitle className="text-base font-headline font-bold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="divide-y divide-border/30">{children}</div>  {/* CHANGE: see below */}
      </CardContent>
    </Card>
  )
}

// After (D-12/D-13):
<Card className="ghost-border bg-card/60 shadow-sm">
  ...
  <CardContent>
    <div className="space-y-1">{children}</div>  {/* divide-y → space-y-1 when sub-sections get tonal bg */}
  </CardContent>
```

**Nested sub-section groups** (any `<FieldRow>` group that was previously separated by `divide-y`) — wrap in tonal container:
```tsx
// Before (implicit separator from divide-y on parent):
<FieldRow label="Enabled">...</FieldRow>
<FieldRow label="Provider">...</FieldRow>

// After (D-13 — tonal bg replaces border separator):
<div className="bg-card/40 rounded-md px-3 py-2">
  <FieldRow label="Enabled">...</FieldRow>
  <FieldRow label="Provider">...</FieldRow>
</div>
```

**`ProviderCard` component** (lines 139–211) — already uses `ghost-border` and `bg-primary/5` / `bg-muted/20`. No change needed to this component's Card border since it uses `rounded-lg p-4 ghost-border` (line 157) — already ghost-bordered.

**`AuditLogSection`** (lines 275–411) — Card at line 319 uses `ghost-border bg-card/50`. Upgrade to `bg-card/60` to match `SectionCard` treatment.

**Hard border removal** — verify `<Card>` components are not receiving a `border` prop or className containing a bare `border` (without `/opacity`). The `ghost-border` utility (`border: 1px solid hsl(var(--border) / 0.3)`) is already set on `SectionCard` line 118 — no additional changes needed for borders beyond the opacity upgrade.

---

## Shared Patterns

### Gradient Primary Active Pill
**Source:** `frontend/src/components/layout/Sidebar.tsx` lines 72–74, `frontend/src/index.css` lines 95–97
**Apply to:** `AppDock.tsx` active icon, `SkillCard.tsx` toggle track
```tsx
// CSS utility (index.css line 96):
.gradient-primary {
  background: linear-gradient(135deg, hsl(239 84% 67%), hsl(258 90% 66%));
}
// Used as className="gradient-primary" for the logo pill in Sidebar.tsx line 72
// For toggle track: use equivalent inline style (backgroundImage) because Tailwind cannot
// apply arbitrary gradient + opacity together via className
```

### Ghost Border + Tonal Surface Depth
**Source:** `frontend/src/index.css` lines 92–94; `frontend/src/pages/SettingsPage.tsx` lines 118, 157; `frontend/src/components/health/HealthPanel.tsx` line 51
**Apply to:** All Card wrappers in `SettingsPage.tsx`, `SkillFormDialog.tsx` env inputs, `SkillDetailPanel` container
```tsx
// index.css line 93:
.ghost-border { border: 1px solid hsl(var(--border) / 0.3); }

// Depth stack (use consistently):
// Outermost Card:   bg-card/60 ghost-border
// Nested section:   bg-card/40 rounded-md px-3 py-2
// Input fields:     bg-card/50 ghost-border rounded-lg   (D-11)
// Muted inputs:     bg-muted/30 ghost-border             (existing SettingsPage TextInput)
```

### Tooltip Pattern
**Source:** `frontend/src/components/skills/SkillCard.tsx` lines 145–164
**Apply to:** `AppDock.tsx` all icon buttons (add `side="right"`)
```tsx
// TooltipProvider is already mounted in App.tsx line 28 — no additional setup needed
<Tooltip>
  <TooltipTrigger asChild>
    {/* button element */}
  </TooltipTrigger>
  <TooltipContent side="right">{label}</TooltipContent>
</Tooltip>
```

### Active State: `bg-primary/10 text-primary` (thread/nav items)
**Source:** `frontend/src/components/layout/Sidebar.tsx` lines 131–141
**Apply to:** `Sidebar.tsx` retains this for thread items; `AppDock.tsx` uses `gradient-primary` pill instead (D-04 — not `bg-primary/10`)

### Icon + Transition Conventions
**Source:** `frontend/src/components/layout/Sidebar.tsx` lines 208–264; `frontend/src/components/skills/SkillCard.tsx`
- Icon size in nav context: `h-4 w-4`
- Hover transition: `transition-colors` (Tailwind default 150ms)
- Active state transition: `transition-all duration-200` for gradient swap (toggle track)
- Card entry animation: `animate-fadeSlideUp` (keyframe in `index.css` lines 110–118)

### `ActiveView` Type
**Source:** `frontend/src/App.tsx` line 8
```tsx
export type ActiveView = "chat" | "documents" | "skills" | "settings" | "library-health"
// Import as: import type { ActiveView } from "@/App"
// Already used in Sidebar.tsx line 6 — same import path for AppDock.tsx
```

---

## No Analog Found

All 7 files have strong analogs or are self-modifications. No files without a match.

---

## Metadata

**Analog search scope:** `frontend/src/components/layout/`, `frontend/src/components/skills/`, `frontend/src/components/health/`, `frontend/src/pages/`, `frontend/src/`, `frontend/src/index.css`
**Files read:** 9 source files (Sidebar.tsx, ChatLayout.tsx, SkillsPage.tsx, SkillCard.tsx, SkillFormDialog.tsx, SettingsPage.tsx, HealthPanel.tsx, index.css, App.tsx)
**Pattern extraction date:** 2026-04-19
