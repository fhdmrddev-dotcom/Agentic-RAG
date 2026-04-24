# Phase 43: UI Redesign — Collapsible Nav, Settings Tabs & Mobile Responsiveness — Pattern Map

**Mapped:** 2026-04-19
**Files analyzed:** 5 (1 new, 4 modified)
**Analogs found:** 5 / 5

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `frontend/src/components/layout/NavPanel.tsx` | component (layout) | event-driven (click → state) | `AppDock.tsx` + `Sidebar.tsx` | exact merge — both sources |
| `frontend/src/components/layout/ChatLayout.tsx` | component (layout) | request-response (prop wiring) | self — minimal restructure | role-match |
| `frontend/src/pages/SettingsPage.tsx` | page component | request-response (API CRUD) | self — tab layer added | role-match |
| `frontend/src/components/layout/AppDock.tsx` | component (layout) | event-driven | self → merge into NavPanel | source to be consumed |
| `frontend/src/components/layout/Sidebar.tsx` | component (layout) | event-driven | self → merge into NavPanel | source to be consumed |

---

## Pattern Assignments

### `frontend/src/components/layout/NavPanel.tsx` (new, component, event-driven)

**Primary analog:** `frontend/src/components/layout/AppDock.tsx` (icon rail, nav items, tooltip pattern)
**Secondary analog:** `frontend/src/components/layout/Sidebar.tsx` (logo block, thread list, footer)

---

**Imports pattern — copy from AppDock.tsx (lines 1–4) + Sidebar.tsx (lines 1–6), merged:**
```typescript
import { useState, useEffect, useRef } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  MessageSquare, FileText, Activity, Zap, Settings,
  LogOut, Plus, Sparkles, Pencil, Trash2, MoreHorizontal,
  Moon, Sun, ChevronLeft, ChevronRight,
} from "lucide-react"
import type { ActiveView } from "@/App"
import type { Thread, Folder } from "@/types"
```

---

**Props interface — combine both component interfaces:**
```typescript
interface Props {
  // From AppDock
  activeView: ActiveView
  onNavigate: (view: ActiveView) => void
  onSignOut: () => void
  // From Sidebar
  threads: Thread[]
  selectedThread: Thread | null
  onSelectThread: (thread: Thread) => void
  onNewThread: () => void
  loadThreads: () => Promise<void>
  onDeleteThread: (id: string) => Promise<void>
  onRenameThread: (id: string, title: string) => Promise<void>
  theme: "light" | "dark"
  onToggleTheme: () => void
}
```

---

**localStorage collapse state — new pattern (no existing analog; use this spec):**
```typescript
const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
  return localStorage.getItem("nav_panel_collapsed") === "true"
})

function handleToggle() {
  setIsCollapsed((prev) => {
    const next = !prev
    localStorage.setItem("nav_panel_collapsed", String(next))
    return next
  })
}
```

---

**NAV_ITEMS array — copy from AppDock.tsx (lines 12–18) verbatim:**
```typescript
const NAV_ITEMS = [
  { view: "chat" as ActiveView,           icon: MessageSquare, label: "Chat" },
  { view: "documents" as ActiveView,      icon: FileText,      label: "Documents" },
  { view: "library-health" as ActiveView, icon: Activity,      label: "Library Health" },
  { view: "skills" as ActiveView,         icon: Zap,           label: "Skills" },
  { view: "settings" as ActiveView,       icon: Settings,      label: "Settings" },
] as const
```

---

**Active nav icon pill pattern — copy from AppDock.tsx (lines 28–51):**
```typescript
<Tooltip key={view}>
  <TooltipTrigger asChild>
    <button
      className={cn(
        "flex items-center justify-center w-10 h-10 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
        !isActive && "text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40",
      )}
      aria-label={label}
      aria-current={isActive ? "page" : undefined}
      onClick={() => onNavigate(view)}
    >
      {isActive ? (
        <div className="flex items-center justify-center w-10 h-10 rounded-xl gradient-primary shadow-sm shadow-primary/20">
          <Icon className="w-4 h-4 text-white" />
        </div>
      ) : (
        <Icon className="w-4 h-4" />
      )}
    </button>
  </TooltipTrigger>
  {/* Only show tooltip in collapsed state — disabled in expanded */}
  {isCollapsed && <TooltipContent side="right">{label}</TooltipContent>}
</Tooltip>
```

---

**Tooltip pattern for sign-out — copy from AppDock.tsx (lines 55–68):**
```typescript
<Tooltip>
  <TooltipTrigger asChild>
    <button
      className="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground hover:text-destructive hover:bg-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      aria-label="Sign out"
      onClick={onSignOut}
    >
      <LogOut className="w-4 h-4" />
    </button>
  </TooltipTrigger>
  {isCollapsed && <TooltipContent side="right">Sign out</TooltipContent>}
</Tooltip>
```

---

**Logo block (expanded state) — copy from Sidebar.tsx (lines 64–72):**
```typescript
<div className="flex items-center gap-2.5 px-4 py-4">
  <div className="flex items-center justify-center w-9 h-9 rounded-xl gradient-primary shadow-sm shadow-primary/20">
    <Sparkles className="w-4.5 h-4.5 text-white" />
  </div>
  <div className="flex flex-col leading-none">
    <span className="font-headline font-semibold text-sm tracking-tight text-sidebar-foreground">Agentic RAG</span>
    <span className="text-[10px] text-muted-foreground mt-0.5">Powered by AI</span>
  </div>
</div>
```

**Logo block (collapsed state) — stripped to icon only:**
```typescript
<div className="flex items-center justify-center py-4">
  <div className="flex items-center justify-center w-9 h-9 rounded-xl gradient-primary shadow-sm shadow-primary/20">
    <Sparkles className="w-4.5 h-4.5 text-white" />
  </div>
</div>
```

---

**New Chat button — copy from Sidebar.tsx (lines 81–89):**
```typescript
<Button
  onClick={() => onNewThread()}
  className="w-full justify-center gap-2 gradient-primary text-white shadow-md shadow-primary/20 hover:opacity-90 transition-all border-none font-semibold"
  size="sm"
>
  <Plus className="h-4 w-4" />
  New Chat
</Button>
```

---

**Thread list rendering — copy from Sidebar.tsx (lines 96–189) verbatim:**

Key patterns to preserve:
- hover/menu state: `menuOpenId`, `hoveredId`, `editingId` local state (lines 32–36)
- selected thread row: `bg-primary/10 text-primary` + `w-0.5 rounded-full bg-primary` left indicator bar (lines 124–135)
- rename inline input: `focus:ring-2 focus:ring-primary/30` pattern (lines 110–122)
- dropdown menu: `ghost-border bg-popover shadow-lg shadow-black/20` (lines 165–185)
- Rename/Delete button: `hover:bg-destructive/10 text-destructive` for Delete (lines 177–181)

---

**Thread list empty state — copy from Sidebar.tsx (lines 93–95):**
```typescript
{threads.length === 0 && (
  <p className="text-[10px] text-muted-foreground/50 text-center py-4 italic">No recent chats</p>
)}
```

---

**Footer theme toggle — copy from Sidebar.tsx (lines 193–204):**
```typescript
<div className="border-t border-border/10 px-2 py-2">
  <Button
    onClick={onToggleTheme}
    variant="ghost"
    size="sm"
    className="w-full justify-start gap-2 text-muted-foreground hover:text-sidebar-foreground transition-all py-2"
  >
    {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    {theme === "dark" ? "Light Mode" : "Dark Mode"}
  </Button>
</div>
```

---

**NavPanel container shell — new structural pattern per UI-SPEC:**
```typescript
<div
  className={cn(
    "flex flex-col h-full bg-sidebar border-r border-border/20 shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out",
    isCollapsed ? "w-14" : "w-64",
  )}
>
  {isCollapsed ? (
    /* collapsed: icon rail only */
    <div className="flex flex-col h-full w-14 items-center">
      {/* logo icon, toggle, nav icons, spacer, sign out */}
    </div>
  ) : (
    /* expanded: icon sub-column + thread list sub-column */
    <div className="flex h-full">
      {/* Left: w-14 icon rail */}
      <div className="flex flex-col w-14 items-center border-r border-border/10 shrink-0">
        {/* nav icons, sign out */}
      </div>
      {/* Right: flex-1 thread list */}
      <div className="flex flex-col flex-1 overflow-hidden">
        {/* logo block, toggle, new chat, thread list, footer */}
      </div>
    </div>
  )}
</div>
```

---

**Toggle button spec — new pattern per UI-SPEC Interaction Contracts:**
```typescript
<button
  onClick={handleToggle}
  className="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
  aria-label={isCollapsed ? "Expand navigation" : "Collapse navigation"}
>
  {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
</button>
```

---

### `frontend/src/components/layout/ChatLayout.tsx` (modified, layout component, request-response)

**Analog:** self (`frontend/src/components/layout/ChatLayout.tsx`)

**Current import block to update (lines 1–12) — replace AppDock + Sidebar imports with NavPanel:**
```typescript
// BEFORE:
import { Sidebar } from "./Sidebar"
import { AppDock } from "./AppDock"

// AFTER:
import { NavPanel } from "./NavPanel"
```

**Current layout shell (lines 57–85) — replace AppDock + Sidebar with NavPanel:**
```typescript
// BEFORE:
<div className="flex h-screen bg-background">
  <AppDock activeView={activeView} onNavigate={onNavigate} onSignOut={onSignOut} />
  <Sidebar
    threads={threads}
    selectedThread={selectedThread}
    onSelectThread={selectThread}
    onNewThread={newThread}
    loadThreads={loadThreads}
    onDeleteThread={deleteThread}
    onRenameThread={renameThread}
    folders={folders}
    theme={theme}
    onToggleTheme={toggleTheme}
  />
  <main className="flex-1 overflow-hidden">

// AFTER:
<div className="flex h-screen bg-background">
  <NavPanel
    activeView={activeView}
    onNavigate={onNavigate}
    onSignOut={onSignOut}
    threads={threads}
    selectedThread={selectedThread}
    onSelectThread={selectThread}
    onNewThread={newThread}
    loadThreads={loadThreads}
    onDeleteThread={deleteThread}
    onRenameThread={renameThread}
    theme={theme}
    onToggleTheme={toggleTheme}
  />
  <main className="flex-1 overflow-hidden">
```

**Note:** `folders` prop from `useFolders()` is still fetched in ChatLayout but is no longer passed to Sidebar/NavPanel (Sidebar.tsx accepts it as `_folders` — unused). Keep the hook for ChatArea's `folders` prop.

---

### `frontend/src/pages/SettingsPage.tsx` (modified, page component, request-response CRUD)

**Analog:** self — tab layer is a structural addition; all subcomponents and state stay unchanged.

---

**Install shadcn Tabs before modifying (confirmed absent from `frontend/src/components/ui/`):**
```bash
cd frontend && npx shadcn add tabs
```

**New import to add at top of SettingsPage.tsx:**
```typescript
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
```

---

**localStorage tab persistence — new pattern, mirrors collapse state approach:**
```typescript
const [activeTab, setActiveTab] = useState<string>(() => {
  return localStorage.getItem("settings_active_tab") ?? "0"
})

function handleTabChange(value: string) {
  setActiveTab(value)
  localStorage.setItem("settings_active_tab", value)
}
```

---

**Per-tab save state pattern — multiply existing saving/saved state (lines 418–420) per tab:**
```typescript
// One set per editable tab: AI Model, Search & Retrieval, Integrations
const [savingAI, setSavingAI] = useState(false)
const [savedAI, setSavedAI] = useState(false)
const [savingSearch, setSavingSearch] = useState(false)
const [savedSearch, setSavedSearch] = useState(false)
const [savingIntegrations, setSavingIntegrations] = useState(false)
const [savedIntegrations, setSavedIntegrations] = useState(false)
```

---

**Save button pattern — copy from SettingsPage.tsx (lines 579–582), adapted per tab:**
```typescript
// Existing pattern (single save):
<Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 gradient-primary">
  {saved ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
  {saved ? "Saved!" : saving ? "Saving…" : "Save"}
</Button>

// Per-tab Save button (e.g., AI Model tab) — spec from UI-SPEC:
<Button
  size="sm"
  onClick={handleSaveAIModel}
  disabled={savingAI}
  className="gap-1.5 gradient-primary text-white shadow-md shadow-primary/20 hover:opacity-90 transition-all border-none font-semibold"
>
  {savingAI ? <Loader2 className="h-4 w-4 animate-spin" /> : savedAI ? <Check className="h-4 w-4" /> : <Save className="h-3.5 w-3.5" />}
  {savedAI ? "Saved!" : savingAI ? "Saving…" : "Save AI Model"}
</Button>
```

**Success reset pattern — copy from SettingsPage.tsx (lines 531–532):**
```typescript
setSavedAI(true)
setTimeout(() => setSavedAI(false), 2500)
```

---

**Per-tab save scope — split from monolithic handleSave (lines 496–538):**

- `handleSaveAIModel` — posts: `active_provider`, `llm_model`, `providers` array
- `handleSaveSearch` — posts: `embedding_*`, `rerank_*`, `retrieval_*`, `hybrid_*`, `vector_*`, `keyword_*`, `rrf_k`
- `handleSaveIntegrations` — posts: `tavily_api_key`, `web_search_max_results`, `sandbox_enabled`

Each calls `updateSettings(body)` then `hydrate(updated)` — copy the try/catch/finally structure from lines 498–538 verbatim.

---

**Audit log export error fix (WR-03) — update handleExport in AuditLogSection (lines 307–316):**
```typescript
// BEFORE (silent fail):
} catch {
  // Silently fail — export is best-effort
}

// AFTER (inline error display):
const [exportError, setExportError] = useState<string | null>(null)

const handleExport = async () => {
  setExporting(true)
  setExportError(null)
  try {
    await exportAuditLogs(since, actionType)
  } catch {
    setExportError("Export failed. Please try again.")
  } finally {
    setExporting(false)
  }
}

// Render below export button:
{exportError && (
  <p className="text-xs text-destructive mt-1">{exportError}</p>
)}
```

---

**Tab strip wrapper — new structural pattern using shadcn Tabs:**
```typescript
<Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
  <TabsList className="mb-6">
    <TabsTrigger value="0">AI Model</TabsTrigger>
    <TabsTrigger value="1">Search & Retrieval</TabsTrigger>
    <TabsTrigger value="2">Integrations</TabsTrigger>
    <TabsTrigger value="3">Memory</TabsTrigger>
    <TabsTrigger value="4">Audit Log</TabsTrigger>
  </TabsList>

  <TabsContent value="0">
    <div className="bg-card/50 ghost-border rounded-xl p-6 space-y-6">
      {/* LLM Providers SectionCard + Active Model SectionCard */}
      {/* Save AI Model button — bottom-right */}
    </div>
  </TabsContent>

  <TabsContent value="1">
    <div className="bg-card/50 ghost-border rounded-xl p-6 space-y-6">
      {/* Embedding + Reranking + Retrieval SectionCards */}
      {/* Save Search Settings button — bottom-right */}
    </div>
  </TabsContent>

  <TabsContent value="2">
    <div className="bg-card/50 ghost-border rounded-xl p-6 space-y-6">
      {/* Web Search + Code Execution SectionCards */}
      {/* Save Integrations button — bottom-right */}
    </div>
  </TabsContent>

  <TabsContent value="3">
    <div className="bg-card/50 ghost-border rounded-xl p-6">
      <MemorySection />
    </div>
  </TabsContent>

  <TabsContent value="4">
    <div className="bg-card/50 ghost-border rounded-xl p-6">
      <AuditLogSection />
    </div>
  </TabsContent>
</Tabs>
```

**Tab content panel tonal pattern — from HealthPanel.tsx (line 51) and SettingsPage.tsx existing cards:**
```typescript
// HealthPanel uses: ghost-border bg-card/50 shadow-sm
// SettingsPage SectionCard uses: ghost-border bg-card/60 shadow-sm
// Tab content wrapper uses: bg-card/50 ghost-border rounded-xl p-6
```

---

## Shared Patterns

### gradient-primary (active accent)
**Source:** `frontend/src/index.css` (lines 95–97)
**Apply to:** NavPanel logo container, active nav icon pill, New Chat button, per-tab Save buttons
```css
.gradient-primary {
  background: linear-gradient(135deg, hsl(239 84% 67%), hsl(258 90% 66%));
}
```

### ghost-border (tonal panel border)
**Source:** `frontend/src/index.css` (line 93)
**Apply to:** NavPanel container alternative if needed, Settings tab content panels, dropdown menus in thread list
```css
.ghost-border {
  border: 1px solid hsl(var(--border) / 0.3);
}
```

### Nav icon button base style
**Source:** `frontend/src/components/layout/AppDock.tsx` (lines 31–34)
**Apply to:** All icon buttons in NavPanel (nav items, toggle, sign out)
```typescript
"flex items-center justify-center w-10 h-10 rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
// Inactive: "text-muted-foreground hover:text-sidebar-foreground hover:bg-accent/40"
// Active: gradient-primary pill wraps the icon
```

### Tooltip side="right" pattern
**Source:** `frontend/src/components/layout/AppDock.tsx` (line 48)
**Apply to:** All nav icon buttons in NavPanel collapsed state; omit in expanded state
```typescript
<TooltipContent side="right">{label}</TooltipContent>
```

### Saving/Saved state pattern
**Source:** `frontend/src/pages/SettingsPage.tsx` (lines 496–538)
**Apply to:** Each per-tab save handler in SettingsPage — `handleSaveAIModel`, `handleSaveSearch`, `handleSaveIntegrations`
```typescript
setSaving(true)
setError(null)
try {
  const updated = await updateSettings(body)
  hydrate(updated)
  setSaved(true)
  setTimeout(() => setSaved(false), 2500)
} catch (e: unknown) {
  setError(e instanceof Error ? e.message : "Failed to save settings")
} finally {
  setSaving(false)
}
```

### Thread list interaction state
**Source:** `frontend/src/components/layout/Sidebar.tsx` (lines 32–36, 49–58)
**Apply to:** NavPanel thread list section — copy `menuOpenId`, `hoveredId`, `editingId`, `editValue`, `editInputRef` state and `startRename`/`commitRename` helpers verbatim
```typescript
const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
const [hoveredId, setHoveredId] = useState<string | null>(null)
const [editingId, setEditingId] = useState<string | null>(null)
const [editValue, setEditValue] = useState("")
const editInputRef = useRef<HTMLInputElement>(null)
```

### Active thread row styling
**Source:** `frontend/src/components/layout/Sidebar.tsx` (lines 124–135)
**Apply to:** NavPanel thread list rows (Wave 1/2 use existing values; Wave 3 upgrades to `bg-primary/15` + gradient bar)
```typescript
// Wave 1/2 (copy as-is):
isSelected ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent/40 hover:text-sidebar-foreground"
// Active indicator:
<div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-primary" />

// Wave 3 upgrade:
isSelected ? "bg-primary/15 text-primary" : ...
<div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-full bg-gradient-to-b from-indigo-500 to-cyan-500" />
```

### bg-sidebar container pattern
**Source:** `frontend/src/components/layout/Sidebar.tsx` (line 62) and `AppDock.tsx` (line 22)
**Apply to:** NavPanel outer container
```typescript
// Sidebar: "flex flex-col h-full w-64 bg-sidebar overflow-hidden border-r border-border/20"
// AppDock:  "flex flex-col h-full w-14 bg-sidebar border-r border-border/20 shrink-0"
// NavPanel: "flex flex-col h-full bg-sidebar border-r border-border/20 shrink-0 overflow-hidden transition-[width] duration-200 ease-in-out"
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `shadcn Tabs component` | ui primitive | N/A | Confirmed absent from `frontend/src/components/ui/` — must install via `npx shadcn add tabs` before SettingsPage work |
| Mobile drawer (Wave 3) | component | event-driven | No slide-in overlay drawer exists yet in the codebase |

---

## Metadata

**Analog search scope:** `frontend/src/components/layout/`, `frontend/src/pages/`, `frontend/src/components/ui/`, `frontend/src/components/health/`, `frontend/src/index.css`
**Files scanned:** 8
**Pattern extraction date:** 2026-04-19
