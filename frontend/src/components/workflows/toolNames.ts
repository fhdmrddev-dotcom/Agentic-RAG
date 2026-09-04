/**
 * Phase 224-05 — MOVED. The canonical map now lives at `@/lib/toolNames`.
 *
 * ⚠ WHY THE MOVE, AND WHY THIS FILE STILL EXISTS. Phase 224-01 shared this vocabulary with
 * chat by adding a re-export in `lib/` that pointed UP into `components/workflows/` — so the
 * low layer depended on a feature folder, which is backwards. `connectionMark` had the same
 * shape until 214-08, and the ledger's verdict on that is the precedent followed here:
 * **"the move IS the seam, and it was TAKEN."**
 *
 * This file is now the compatibility shim in the direction that is safe: a feature folder
 * re-exporting from `lib/`. Existing `@/components/workflows/toolNames` imports keep working
 * and nothing in this repo needs a mass rename.
 *
 * ⚠ NEW CALLERS SHOULD IMPORT `@/lib/toolNames`. There is still exactly ONE map and ONE
 * `own()`-guarded accessor — a second copy is how two surfaces drift, which is the whole
 * reason this vocabulary exists.
 */
export { toolName, TOOL_PHRASES } from "@/lib/toolNames"
