---
id: SEED-215
title: Eight catalog services draw the GENERIC MCP plug instead of their own official logo — the icon convention is honoured for providers/models and unhonoured for services
status: shipped
planted: 2026-08-27
planted_by: Claude, 2026-08-27, from the operator's standing direction — "add official logos for all applications, models and anything in the app that has an official icon"
surface: Agentic-RAG
severity: minor
category: design system / icon convention
priority: medium
scope: >
  Small and additive: eight imports and eight map entries in ONE file, plus eight `markKey`
  edits in the catalog. No schema, no API, no new dependency — every slug is already in the
  INSTALLED `@iconify-json/logos` collection.
affected_areas: [frontend/settings, design-system/icons]
relates_to:
  - frontend/src/components/settings/connectionMark.tsx
  - frontend/src/components/settings/servicesCatalog.ts
  - .claude/skills/sketch-findings-agentic-rag/references/icon-convention.md
related_seeds: [SEED-095]
blocked_by: >
  ⚠ Phase 213 was MID-EXECUTION in the working tree when this was measured (uncommitted
  grants.py, migration 128, grantsVocabulary.ts, ConnectionFormPanel.tsx). Neither target file
  is in that diff, but the surface is shared and the count-gate verification needs a quiet box.
re_open_trigger: >
  The moment Phase 213's tree is committed and its gates are green. This is a /gsd:quick-sized
  change (2 source files + 1 test file) and needs no phase of its own.
---

> ✅ **SHIPPED 2026-08-27.** All eight vendors carry their own mark; `intercom` took the
> `fill` ink as predicted. **The prediction that mattered was the one this seed did NOT
> make:** flipping the marks silently broke `shapeForService`, which keyed the connection
> SHAPE off `markKey === "mcp"` — so `github`, `notion` and `google` fell to the `"service"`
> shape whose form is Name and nothing else. That is Phase 212's D-5 defect, reintroduced by
> a logo. The catalog now carries `shape` beside `markKey` so *what a service draws* and
> *what it talks to* are separate facts, and a regression test pins both together.


# SEED-215 — a vendor should show its own mark, and eight of them do not

## The rule this is measured against, which already exists and is already binding

`references/icon-convention.md` §1, Running Design Decision 43, operator 2026-06-27:
*"use the icons everywhere to be consistent, especially providers and models"* — and
`connectionMark.tsx`'s own one-sentence rule:

> **A vendor shows its OWN mark; a vendorless shape is drawn in the interface's own ink.**

## What is measured at HEAD

| surface | state |
|---|---|
| **Providers / models** | ✅ **HONOURED.** `frontend/src/lib/providerLogo.tsx` maps 10 providers + the model families to `@lobehub/icons`, via antd-free deep-leaf imports. |
| **Services** | ⚠ **8 of 12 catalog rows draw the generic MCP plug.** |

`servicesCatalog.ts` carries `markKey` per row. Only **slack**, **jira** and **smtp** resolve to a
real identity; the rest fall to `markKey: "mcp"`:

```
slack       -> slack   ✅        github     -> mcp   ⚠
jira        -> jira    ✅        notion     -> mcp   ⚠
smtp        -> smtp    ✅        google     -> mcp   ⚠
custom_mcp  -> mcp     ✅        figma      -> mcp   ⚠
                                 linear     -> mcp   ⚠
                                 sentry     -> mcp   ⚠
                                 intercom   -> mcp   ⚠
                                 miro       -> mcp   ⚠
```

`SERVICE_MARKS` in `connectionMark.tsx` has **three** entries (plus the two MCP aliases). Eight
well-known vendors with official marks render as an anonymous plug.

⚠ **`custom_mcp -> mcp` is CORRECT and must not be "fixed"** — a custom MCP server has no vendor,
so the MCP mark *is* its identity. Same for `smtp`: `logos` carries no SMTP mark at all
(`smtp` / `email` / `envelope` all return ZERO), and borrowing Gmail's mark for a Fastmail SMTP
connection is the ROADMAP's own named *"a logo is approximated"* failure. **Both are findings,
not gaps** — `connectionMark.tsx`'s header already records the SMTP one.

## The slugs, verified against the INSTALLED package rather than any document

`@iconify-json/logos` — prefix `logos`, **2110 icons, 9 aliases** (all typo-redirects for
unrelated names; none of the slugs below is one). Measured 2026-08-27:

| service | ✅ use | W×H | ratio | fills | ink |
|---|---|---|---|---|---|
| github | `logos:github-icon` | 256×250 | 1.02 | 1 | `self` |
| notion | `logos:notion-icon` | 256×268 | 0.96 | 1 | `self` |
| google | `logos:google-icon` | — | ~1 | — | `self` |
| figma | `logos:figma` | 256×384 | **0.67** | 5 | `self` |
| linear | `logos:linear-icon` | 256×256 | 1.00 | 1 | `self` |
| sentry | `logos:sentry-icon` | 256×227 | 1.13 | 1 | `self` |
| intercom | `logos:intercom-icon` | 256×263 | 0.97 | **0** | ⚠ **`fill`** |
| miro | `logos:miro-icon` | 256×256 | 1.00 | 1 | `self` |

### ⚠ TRAP 1 — the wordmark/icon split is REAL here, and it is most of the list

`connectionMark.tsx` already records it for Slack and MCP (*"`-icon` is not a style preference
here; it is the difference between a mark and a smear"*). The same trap is loaded for **six** of
these eight. In an `h-4 w-4` box `preserveAspectRatio` defaults to `xMidYMid meet`, so a 4:1
wordmark letterboxes to an unreadable ~4px strip:

```
logos:github     512×139   ratio 3.68   ← WORDMARK, never use
logos:notion     512×178   ratio 2.88   ← WORDMARK
logos:google     512×168   ratio 3.05   ← WORDMARK  (⚠ `logos:google-icon` DOES exist — use it)
logos:linear     512×128   ratio 4.00   ← WORDMARK
logos:sentry     512×113   ratio 4.53   ← WORDMARK
logos:intercom   512×130   ratio 3.94   ← WORDMARK
logos:miro       512×188   ratio 2.72   ← WORDMARK
```

⚠ **`figma` is the one that breaks the `-icon` habit**: there is **no** `logos:figma-icon`. Plain
`logos:figma` IS the mark — and it is **portrait**, 256×384 (0.67), so it renders narrower than
the square marks rather than letterboxed. Verify it looks right at `row` size by looking.

### ⚠ TRAP 2 — `intercom-icon` would render INVISIBLE with the default ink

**`logos:intercom-icon` has ZERO `fill=` attributes and contains no `currentColor`.** That is
byte-for-byte the mechanic `connectionMark.tsx`'s ink contract already documents for the MCP mark:

> *"It therefore inherits the SVG default `fill: black`, and on Deep Midnight (`--card: 220 30%
> 7%`) it is effectively INVISIBLE. The slug resolves, the body is 1060 characters, every test is
> green, and the person sees NOTHING."*

So **intercom takes `ink: "fill"`**, not `self`. The seven others carry their own fills and take
`self`. ⚠ **The import fence cannot catch this** — the slug resolves, the build passes, the tests
pass, and the icon is not there. It is caught only by a *resolved-but-INVISIBLE* assertion or by
looking.

## The change, when it is unblocked

1. `connectionMark.tsx` — 8 `~icons/logos/<slug>` imports + 8 `SERVICE_MARKS` entries, intercom
   with `ink: "fill"`. The existing three inks cover every case; no new mechanic.
2. `servicesCatalog.ts` — 8 `markKey` values from `"mcp"` to the service's own key.
3. Tests, in the shape the surface already uses: **resolved-but-EMPTY** (`svg.innerHTML.length > 0`
   per mark), **pairwise distinctness** (so a copy-paste mapping two keys to one import fails), and
   an assertion that **intercom resolves to `ink: "fill"`** — the one a green build cannot see.

⚠ **Do not add a bare-directory entry to the count gate to catch these.** `src/components/settings/`
is pinned FILE-LEVEL by four `TARGETS` entries with no bare-directory entry, deliberately; a new
test file there is invisible to the gate until it is added by hand.

## What is NOT in scope here

- **File-type icons.** `@iconify-json/vscode-icons` is installed and `fileIcon.tsx` /
  `fileTypeMark.tsx` / `fileIcons.tsx` exist. Whether those should move to official
  Office/Adobe marks is a **separate** question and was not measured — do not fold it in
  without measuring it first.
- **`SEED-095`** (the Settings provider/model management surface) — the icon convention names it
  as a future consumer of `providerLogo.tsx`. Unrelated to the service gap, listed so the two are
  not confused.
