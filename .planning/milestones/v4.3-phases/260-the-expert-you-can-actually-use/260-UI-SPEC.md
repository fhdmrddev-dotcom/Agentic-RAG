# Phase 260: The Expert You Can Actually Use — UI Design Contract (UI-SPEC)

**Date:** 2026-09-20  
**Phase:** 260 (The Expert You Can Actually Use)  
**Status:** Locked  
**Design Reference:** G-2 Component Sketch 260 (`.planning/sketches/260-the-expert-you-can-actually-use/index.html`) — Option 1: Action Tiles  
**Tokens:** Aether Intelligence Design System (`frontend/src/index.css` / Deep Midnight palette)

---

## 1. Visual Hierarchy & Design Lineage

### 1.1 Acceptance Bar
The design bar is established and frozen by **Sketch 260 (Option 1: Action Tiles)**, ratified by the operator on 2026-09-20:
- *"Less text, more visuals, simplicity, accuracy, and best user experience."*
- **Zero lecturing prose**: No didactic paragraphs explaining chat history retention vs retrieval boundaries. Scope is self-evident via visual tags (`[📁 SEC Filings]`, `[🧰 ratio_calculator]`, `[Restricted]`).
- **Hero visual spotlight card**: Rendered in the chat stream upon invitation with glowing icon gem and clean identity tags.
- **3 Large, visual Action Tiles**: Prominently rendered (`📈 Q3 Revenue Growth YoY`, `⚖️ Gross Margin Comparison`, `💵 Operating Cash Flow`) with immediate 1-click execution (`PACK-03`).
- **Ambient composer state awareness**: Composer frame gains a subtle violet/indigo ambient glow when an Expert is active.
- **Zero new top-level composer controls**: Invite trigger lives inside existing `+` dropdown menu; active consultant renders in existing `Using:` chips row container (`data-testid="active-connector-chips"`).

---

## 2. Component Specifications & Layout Structure

### 2.1 Composer Invitation Door (`frontend/src/components/chat/MessageInput.tsx`)
1. **Entry Point**: Inside the existing `+` dropdown menu (`DropdownMenuContent`):
   - Located in the attach group or as a dedicated item immediately above connectors:
     ```tsx
     <DropdownMenuItem onSelect={() => setInviteExpertOpen(true)} className="text-xs cursor-pointer gap-2 py-1.5">
       <Sparkles className="h-4 w-4 text-violet-400" />
       <span>Invite Expert...</span>
     </DropdownMenuItem>
     ```
2. **Invite Expert Dialog (`InviteExpertDialog.tsx`)**:
   - Clean modal dialog displaying available expert bundles retrieved from `GET /experts`.
   - Each card displays:
     - Avatar / Icon gem (e.g. `📊` for Financial Analyzer).
     - Name and domain description.
     - Scope badges (`Restricted`, member count).
     - One-click `"Invite to Thread"` button.

### 2.2 Active Consultant Composer State (`frontend/src/components/chat/MessageInput.tsx`)
1. **Composer Frame Glow**:
   - When an Expert is active on the thread (`activeExpert != null`):
     - The outer composer wrapper applies an ambient violet glow:
       `ring-1 ring-violet-500/30 border-violet-500/40 shadow-[0_0_20px_rgba(139,92,246,0.12)]`
2. **Active Expert Chip (`ActiveExpertChip.tsx`)**:
   - Mounted inside the existing chips container (`data-testid="active-connector-chips"`):
     - Sibling to file attachment chips and `ActiveConnectorChips`.
     - Displays:
       `[ ✨ Financial Analyzer · Restricted ✕ ]`
     - Styling:
       `bg-violet-500/15 border border-violet-500/35 text-violet-200 text-xs font-medium rounded-md px-2.5 py-1 flex items-center gap-1.5`
     - Dismiss Button (`✕`):
       Clicking calls `onDismissExpert()`, which immediately removes the consultant from thread state, updates `threads.active_expert_id = NULL`, and restores the composer to neutral styling.

### 2.3 Hero Spotlight Card (`ExpertSpotlightCard.tsx` in `ChatArea.tsx`)
Rendered in the message stream upon expert invitation or at thread start when an expert is bound:
1. **Container**:
   - `bg-gradient-to-br from-violet-950/40 to-slate-900/60 border border-violet-500/25 rounded-2xl p-5 shadow-xl shadow-black/40`
2. **Header & Identity Row**:
   - **Icon Gem**: `w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/30 to-violet-500/30 border border-violet-400/40 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(168,85,247,0.3)]`
   - **Name**: `text-base font-bold text-foreground` (e.g. "Financial Analyzer")
   - **Scope Tags**:
     - `[📁 SEC Filings & Reports]` (`bg-white/5 border border-white/10 text-muted-foreground text-[11px] rounded-full px-2 py-0.5`)
     - `[🧰 ratio_calculator]` (`bg-white/5 border border-white/10 text-muted-foreground text-[11px] rounded-full px-2 py-0.5`)
     - `[Restricted]` (`bg-rose-500/10 border border-rose-500/30 text-rose-300 text-[11px] rounded-full px-2 py-0.5 font-semibold`)
   - **Dismiss Action**: Top-right subtle close icon button (`hover:bg-white/10 text-muted-foreground rounded-full p-1.5`).

### 2.4 Action Tiles Grid (`PACK-03`)
Positioned inside the spotlight card beneath the identity row:
1. **Grid Layout**:
   - 3-column responsive grid: `grid grid-cols-1 md:grid-cols-3 gap-2.5 mt-3`
2. **Action Tile Items**:
   - **Tile 1**:
     - Icon: `📈`
     - Prompt: *"Compare Q3 revenue growth and YoY trajectory"*
   - **Tile 2**:
     - Icon: `⚖️`
     - Prompt: *"Calculate gross margin and EBITDA breakdown"*
   - **Tile 3**:
     - Icon: `💵`
     - Prompt: *"Analyze operating cash flow changes and liquidity"*
3. **Tile Styling & Hover**:
   - Base: `bg-white/[0.03] hover:bg-violet-500/10 border border-white/[0.08] hover:border-violet-400/40 rounded-xl p-3 cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg`
   - Action Prompt Label: `text-xs font-medium text-slate-200 line-clamp-2`
   - Bottom row: `text-[11px] text-violet-300/80 flex items-center justify-between mt-2` ("Ask now →")
4. **Interaction**:
   - **1-Click Execution**: Tapping any tile triggers `onSelectPrompt(tile.prompt)`, instantly dispatching the message into the thread and initiating the agent run without requiring extra clicks.

---

## 3. Design System & CSS Tokens

| Element | Class / Token | Purpose |
|---|---|---|
| Spotlight Card Surface | `from-violet-950/40 to-slate-900/60` | Rich dark glassmorphic card |
| Accent Border | `border-violet-500/25` | Distinctive consultant theme |
| Icon Gem Background | `from-indigo-500/30 to-violet-500/30` | Luminous badge identity |
| Active Chip | `bg-violet-500/15 border-violet-500/35 text-violet-200` | Legible consultant indicator in composer |
| Action Tile Surface | `bg-white/[0.03] hover:bg-violet-500/10` | High-contrast tappable tiles |
| Action Tile Border | `border-white/[0.08] hover:border-violet-400/40` | Subtle resting border with vivid hover |
| Scope Tag (Restricted) | `bg-rose-500/10 border-rose-500/30 text-rose-300` | High-governance restricted indicator |

---

## 4. Mobile & Responsive Behavior

- **Mobile Viewports (< 640px)**:
  - Action Tiles collapse from 3-column grid to a single vertical column (`grid-cols-1`).
  - Active Expert Chip in composer truncates name cleanly (`max-w-[140px] truncate`).
  - Spotlight card padding reduces from `p-5` to `p-3.5`.

---

## 5. State Transition Flow

1. **Summon**: User opens `+` menu -> clicks `✨ Invite Expert...` -> selects "Financial Analyzer" in modal.
2. **State Transition**:
   - `threads.active_expert_id` is updated.
   - `ExpertSpotlightCard` animates into the message stream (`cardEntrance` animation: 300ms fade + slide up).
   - Composer gains violet glow and mounts `ActiveExpertChip`.
3. **Prompt Tap**:
   - User clicks `[📈 Q3 Revenue Growth YoY]`.
   - Prompt immediately dispatches as user message.
   - Agent loop answers strictly with citations from seeded 10-K document (`PACK-05`).
4. **Dismiss**:
   - User clicks `✕` on `ActiveExpertChip` or in the spotlight card.
   - `threads.active_expert_id` is set to NULL.
   - Composer fades back to neutral styling.
   - Thread scope returns to general.
