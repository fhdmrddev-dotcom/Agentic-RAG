# Sketch 232 — The Watch Loop and Its Sentence

**Phase:** 234 — The Watch Loop — The Library Reads By Itself  
**Requirements:** `SURF-01`, `LIB-08`, `SRC-06`, `VIS-03..06`, `TRUST-03`  
**Tags:** `phase-234`, `surf-01`, `lib-08`, `watch-loop`, `cadence-sentence`, `g2-sketch-gate`

---

## 1. Design Question

> **How does an autonomous background watch loop present itself to a user — its cadence, its status, its failures, and its boundaries — without ever misleading someone into expecting instant sync, and without destroying knowledge when a remote file disappears?**

---

## 2. Core Decisions & Rules

1. **The Cadence Sentence (`SURF-01`):**
   - Must explicitly say: **"checked every {N} minutes"** (e.g. *"checked every 30 minutes"*).
   - The words **"instantly"** and **"on change"** are **strictly forbidden**. There is no webhook or delta cursor in this system.
2. **Watch Configuration Modal:**
   - Source selection: Connection dropdown + `SourceFolderPicker` browsing remote folders.
   - Destination selection: Library folder picker.
   - Cadence presets: 15m, 30m (default), 1h, 6h, 24h.
   - Plain-language visibility reminder: *"Files inherit {connection.name}'s visibility ({default_ingest_visibility})."*
3. **Lifecycle Honesty & Reversibility (`VIS-03`, `VIS-05`, `D-4`):**
   - When a remote file is deleted, it is **never automatically deleted** from the Library. It is retained and marked *"Missing at source"*.
   - A dedicated **"Purge missing files"** button is provided for users who wish to intentionally prune missing files.
   - When a connection is disconnected, the watch card shows a warning banner:
     **"Connection disconnected · Reconnect {connection_name}"** (by name, with direct reconnect action).
4. **G-1 Pre-emption:**
   - The watch surface lives entirely inside the **Library Ingestion tab** (`LibraryPage.tsx`).
   - `ConnectionFormPanel.tsx` and `ConnectionsTab.tsx` remain **untouched**.
5. **Theme & Styling:**
   - Adheres to the **Calm Deep Midnight** palette (`#0D1117`, `#161B22`, `#21262D`, indigo accent `#A3A5FF`, text muted `#8B949E`, text foreground `#F0F6FC`).

---

## 3. Surface Components Mocked in `index.html`

1. **Library Ingestion Tab — Watched Sources Section:**
   - Active Watch Card: Google Drive `/Quarterly Reports` -> Library `/Finance/Q3` · *"checked every 30 minutes"* · Status: `Active` · Next run in 18m.
   - Paused / Warning Watch Card: Google Drive `/Legal Contracts` -> Library `/Legal` · *"checked every 60 minutes"* · Status: `Disconnected` · Banner: *"Connection disconnected · Reconnect Google Workspace Legal"* · *"Purge missing files"* action.
2. **Create Watch Dialog Modal:**
   - Step 1: Pick Connection (Google Drive).
   - Step 2: Pick Source Folder (Interactive folder tree).
   - Step 3: Pick Target Library Folder.
   - Step 4: Pick Cadence (`15m` | `30m (Default)` | `1h` | `6h` | `24h`).
   - Notice: *"Files deleted at source are retained in your Library until you purge them."*
