# Phase 212: The Catalog and Its Doors — UI Design Contract (UI-SPEC)

**Date:** 2026-08-27
**Phase:** 212 (The Catalog and Its Doors)
**Status:** Locked
**Design Reference:** Claude.ai Connectors & Plugins Directory (`screenshots/Screenshot 2026-08-24 202011.png`, `202036.png`, `202044.png`)
**Tokens:** Aether Intelligence Design System (`frontend/src/index.css`)

---

## 1. Visual Hierarchy & Information Architecture

### 1.1 Acceptance Bar & Lineage
The design bar is the **Claude.ai Connectors catalog IA and Custom MCP badge** (`screenshots/Screenshot 2026-08-24 202011.png`), interpreted strictly through the project's shipped **Aether Intelligence tokens** in `frontend/src/index.css` (Dark theme / Deep Midnight palette `--card: 220 30% 7%`, `--background: 220 35% 4%`).

### 1.2 Layout Structure
In `Settings → Connections` (`ConnectionsTab.tsx`):
1. **Platform Status Banner (when `live_connectors` is off):**
   - Warning tone border (`border-warning/30`), background (`bg-warning/10`), clear explanation, and direct action: `"Configure in Control Room →"` for org admins.
2. **Curated "Popular Services" Section (Top Grid/Carousel):**
   - Section heading: `text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3`
   - Responsive card grid: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3`
   - Cards: Rounded bordered container (`rounded-xl border border-border/60 bg-card/60 hover:bg-card/90 hover:border-border transition-all duration-150 p-4 flex flex-col justify-between`)
   - Each card displays:
     - Top row: Service brand mark (`ConnectionMarkGlyph`, 20x20px), Display Name (`text-sm font-medium text-foreground`), Category tag.
     - Middle: Tagline / one-line purpose (`text-xs text-muted-foreground leading-relaxed line-clamp-2 mt-1.5 mb-3`).
     - Bottom: Connection status badge (`Connected` green badge / `Not connected` muted badge) + Quick Action button (`Connect` or `Manage` / `Add`).
3. **Filter & Search Bar:**
   - Search input: Lucide `Search` icon, placeholder `"Search services or tools..."` (`h-9 text-xs rounded-lg border-border/60 bg-background/50`).
   - State Filter Chips: `All` | `Connected` | `Not connected` (`h-7 px-2.5 text-xs font-medium rounded-full`).
   - Live Count badge: `"6 services · 2 connected"`.
4. **Services Directory List / Table:**
   - Container: Rounded bordered box (`divide-y divide-border/60 rounded-xl border border-border/60 bg-card/40 overflow-hidden`).
   - Rows: Service mark, Name, Tagline, Active Instance count ("2 instances"), Available Tools badge ("3 tools"), Status indicator, Contextual menu / Open drawer button.

---

## 2. Interactive Discovery Preview Panel (`ConnectionFormPanel.tsx`)

### 2.1 Panel Placement & Dimensions
- Desktop: 400px push/split panel (`minmax(0, 1fr) 400px`) retaining visible catalog list.
- Mobile (<768px): Bottom sheet drawer with focus trap.

### 2.2 Pre-Save MCP Discovery Section
- URL input field: Full-width URL input with prefix validation.
- "Discover Tools" button: Lucide `Sparkles` or `RefreshCw`, secondary button style with live loading spinner during probe.
- Discovery Preview Container:
  - Header: `"Discovered Tools ({count})"` (`text-xs font-semibold text-foreground flex items-center gap-1.5`).
  - Tool cards list: Accordion or scrollable list of discovered tool items.
  - Tool item:
    - Tool name (`font-mono text-xs font-medium text-primary`).
    - Tool title & description (`text-xs text-muted-foreground mt-0.5`).
    - Collapsible JSON Schema properties view (`bg-background/80 rounded border border-border/40 p-2 font-mono text-[11px] text-muted-foreground mt-1`).

---

## 3. Typography & Color Specifications

| Element | Class / Token | Purpose |
|---|---|---|
| Section Header | `text-xs font-semibold uppercase tracking-wider text-muted-foreground` | Category / Popular demarcation |
| Card Title | `text-sm font-medium text-foreground` | Service name |
| Tagline | `text-xs leading-relaxed text-muted-foreground` | One-line service description |
| Status Badge (Connected) | `bg-success/10 text-success border border-success/30 text-[11px] font-medium px-2 py-0.5 rounded-full` | Active service instance |
| Status Badge (Not Connected) | `bg-muted/30 text-muted-foreground text-[11px] font-medium px-2 py-0.5 rounded-full` | Unconnected service |
| Primary Action | `bg-primary text-primary-foreground hover:bg-primary/90 h-8 text-xs font-medium rounded-lg` | Connect / Save |
| Secondary Action | `border border-border/60 bg-background/50 hover:bg-background h-8 text-xs font-medium rounded-lg` | Discover / Cancel |

---

## 4. Copywriting & Interaction Contracts

### 4.1 Filter Chips (`CAT-03`)
- `All` — Show every service in catalog.
- `Connected` — Show services with >= 1 active connection.
- `Not connected` — Show services with 0 active connections.
- ⚠ **Zero verb chips**: No `Send email`, `Create issue`, `Post message`, or capability filter words.

### 4.2 Empty States
- Zero Search Results: `"No services match '{query}'"` with clear button `"Clear search"`.
- Zero Connected Services (in `Connected` filter): `"No services connected yet"` with CTA `"Browse Popular Services"`.

### 4.3 Deletion Confirmation Sheet (`CONN-07`)
- Title: `"Delete Connection: {name}"`
- Body:
  - If `usageCounts > 0`: `"This connection is currently referenced by {count} published workflow step(s). Deleting it will cause these steps to fail at execution."`
  - If `usageCounts == 0`: `"Are you sure you want to delete {name}? This will permanently remove credentials and saved settings."`
- Buttons: Destructive button `"Delete Connection"` (`bg-destructive text-destructive-foreground`) vs `"Cancel"`.
