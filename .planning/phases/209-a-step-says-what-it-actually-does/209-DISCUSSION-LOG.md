# Phase 209: A step says what it actually does - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-26
**Phase:** 209-a-step-says-what-it-actually-does
**Areas discussed:** Node Face Identity & Title, Read vs Write Effect Banner Mechanism, Settings -> Connections Filter Structure

---

## Node Face Identity & Title

| Option | Description | Selected |
|--------|-------------|----------|
| 1. (Recommended) Connection Name · tool_name | e.g. "DeepWiki · read_wiki_structure" as card title, wearing the connection's real service mark from `connectionMark.tsx` | ✓ |
| 2. tool_name as card title with Connection Name as subtitle | Splits the identifier across title and subtitle lines | |
| 3. Action phrase | e.g. "Read wiki structure via DeepWiki" derived from tool and connection | |

**User's choice:** Option 1: Connection Name · `tool_name` (e.g. "DeepWiki · read_wiki_structure") as card title, wearing the connection's real service mark from `connectionMark.tsx`.
**Notes:** Replaces generic "Reach outside" on the canvas node face with the specific service and tool identity.

---

## Read vs Write Effect Banner Mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| 1. (Recommended) Tool-name verb inspection + readOnlyHint fallback | Inspect tool name prefixes (`read_*`, `get_*`, `list_*`, `search_*`, `fetch_*`, `query_*`, `describe_*`, `find_*`) and check `readOnlyHint === true` when present -> `ONLY READS` (dim tone); mutating/default -> `CHANGES SOMETHING OUTSIDE` (warning tone) | ✓ |
| 2. Conservative direction | Explicit read patterns render `ONLY READS` in dim tone; any unclassified or mutating external tool renders `CHANGES SOMETHING OUTSIDE` in warning tone | |
| 3. Three-state | `ONLY READS` for confirmed reads, `CHANGES SOMETHING OUTSIDE` for confirmed writes, and omit banner when direction is indeterminate | |

**User's choice:** Option 1: Tool-name verb inspection (`read_*`, `get_*`, `list_*`, `search_*`, `fetch_*`, `query_*`, `describe_*`, `find_*`) + `readOnlyHint` fallback -> `ONLY READS` (dim tone); mutating/default -> `CHANGES SOMETHING OUTSIDE` (warning tone).
**Notes:** `readOnlyHint` is absent on DeepWiki live, so verb prefix heuristics provide the primary signal while hint serves as an optimization when present. The Phase 185 governance banner is never softened.

---

## Settings -> Connections Filter Structure

| Option | Description | Selected |
|--------|-------------|----------|
| 1. (Recommended) State-based filter chips following Claude.ai reference | `All` \| `Connected` (`Ready`) \| `Not connected` (`Unchecked` / `Disabled` / `Failed`), plus search by name/URL/destination | ✓ |
| 2. Four granular state chips | `All` \| `Ready` \| `Not checked` \| `Disabled / Failed`, plus text search | |
| 3. Status binary | `All` \| `Active` \| `Inactive / Issues` | |

**User's choice:** Option 1: State-based filter chips following Claude.ai reference: `All` | `Connected` (`Ready`) | `Not connected` (`Unchecked` / `Disabled` / `Failed`), plus search by name/URL/destination.
**Notes:** Removes the three hardcoded capability chips that made MCP connections vanish on click.

---

## Claude's Discretion

- Token styling and visual polish: `ONLY READS` uses 9px bold wide-tracked geometry in `text-muted-foreground` to mirror `CHANGES SOMETHING OUTSIDE` in `text-warning`.
- Exact derivation helper signatures in `nodeEffectBanner.ts` and `phaseVocabulary.ts` ensuring backwards compatibility with existing callers.

## Deferred Ideas

- Connections & Open Platform milestone: App directory / catalog, OAuth integrations, chat tool approval flow.
- Graph edge branch annotations (`On Success`, `On Error`).
