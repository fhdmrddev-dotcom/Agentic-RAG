---
seed_id: SEED-186
title: We already speak the community skill format and already solved catalog scale — but ONE depth predicate in the ZIP importer makes every public skill repository unimportable, and the frontmatter superset those repos carry (license, compatibility, allowed-tools, version) is silently discarded on the skills that DO import
created: 2026-08-19
planted_during: Phase 200 execution (plans 01-03 merged) — operator asked whether the GitHub open-source community offers anything we can leverage; the audit that followed measured the seam rather than assuming it
status: planted
priority: high
surface: Agentic-RAG
relates_to:
  - SEED-096 — *skill bundle file-tree fidelity + runtime tooling*. ⚠ **DO NOT MERGE THESE TWO.**
    SEED-096 is everything that goes wrong AFTER a skill is found (flattening, injection CWD,
    missing binaries). This seed is UPSTREAM of it: the skill is never found at all, so SEED-096's
    failure modes are not even reached. SEED-096's worked example imported successfully **because
    the operator zipped a single skill directory** (`docx/SKILL.md`, 2 segments). A whole-repo ZIP
    is 3-4 segments and returns `400`. Fixing this seed makes SEED-096's gaps reachable — which is
    an argument for sequencing them together, not for treating them as one concern.
  - SEED-102 — *skill name collision shadows builtin, general case*. ⚠ **This seed makes SEED-102
    acute.** Importing one repo can create 163 rows in one request; today `import_skill` inserts
    every parsed skill with no collision check against builtins or existing rows.
  - SEED-043 (sandbox package management) + SEED-106 (sandbox-image parity with provider skill
    runtimes) — the `compatibility:` frontmatter key this seed shows we discard is *literally the
    field that declares the package wall*. Preserving it is the cheap half of both seeds.
  - SEED-044 — multi-language skill execution; the non-Python half of "will this actually run".
  - SEED-125 / SEED-129 — cross-org service-role skill leaks. Anything imported that lands
    `is_global` / `is_org_shared` is a cross-tenant surface; bulk import raises the blast radius.
  - `docs/SANDBOX-PACKAGES.md` — the installed set an imported skill must author against.
  - `.planning/seeds/SEED-172` / `SEED-173` — the "we do not control the runtime" family.
trigger_when: >
  ALREADY TRUE, and it is a defect plus a capability rather than a wait-for-a-signal seed. Fire it at
  whichever of these comes first:
    (a) the next phase whose `files_modified` names `backend/app/api/skills.py`;
    (b) `/gsd:new-milestone` — as a candidate REQ-ID for a Skills-distribution milestone;
    (c) any operator ask of the shape "why is the Skills page empty" / "where do I get skills".

  ⚠ **SPLIT IT WHEN IT FIRES — the two halves have different sizes and different risk.**
  Half A (the predicate) is G-3 `/gsd:fast` shaped: one function, one file, no schema, no API surface.
  Half B (frontmatter preservation) needs a migration and is NOT a fast task. Shipping A alone is
  legitimate and useful; shipping A *while believing it delivered B* is the failure to avoid.

  Mechanical check, from the repo root — the whole proof is three commands:
    sed -n '84,95p' backend/app/api/skills.py          # the predicate: len(parts) == 2, and only 2
    sed -n '68,81p' backend/app/api/skills.py          # the parser: requires `name`, reads `description`, drops the rest
    grep -n "response\|insert" backend/app/api/skills.py | sed -n '1,20p'   # confirm no other frontmatter key is persisted
trigger_paths:
  - "backend/app/api/skills.py"
---

# We are one predicate away from a stocked shelf, and we are throwing away the label on the tin

## The question this came from

The operator asked whether anything in the GitHub open-source community could enhance a feature or
create a new one, pointing at a Top-100 Claude repository ranking. Roughly seventy of those hundred
are Claude Code *harness* tooling — they improve how this app gets built, not what it does. But one
cluster is a direct product input, and the audit that followed found we are far closer to it than
anyone assumed, and blocked by something far smaller.

## The cluster

The Agent Skills format (`SKILL.md` = YAML frontmatter + markdown body) has become a de-facto open
standard, and the ranking carries roughly 2,300+ ready-made skills in it:

| Repository | Contents |
|---|---|
| `VoltAgent/awesome-agent-skills` | 1,000+ skills |
| `mukul975/Anthropic-Cybersecurity-Skills` | 817, mapped to 6 frameworks |
| `alirezarezvani/claude-skills` | 345 skills, 30+ agents, 70+ commands |
| `K-Dense-AI/scientific-agent-skills` | 163 validated |
| `ComposioHQ/awesome-claude-skills`, `coreyhaines31/marketingskills`, `kepano/obsidian-skills` | curated + domain packs |

**Our core value proposition is "an agent that can be taught new behaviors that persist."** Today
that means the user writes a skill from a blank page. It could mean the user picks one off a shelf.

## What we already have — this is the surprising half

None of the following needs building. All of it is shipped.

1. **We already parse the exact format.** `_parse_skill_md` (`backend/app/api/skills.py:68-81`)
   reads YAML frontmatter + body. `import_skill` (`:262`) accepts a ZIP; its own docstring says
   *"Import skill(s) from a ZIP file in **agentskills.io format**"* — the community format is the
   declared target, not an accident.
2. **We already export in it.** `:844-845` emits `{slug}/SKILL.md` with `---`-fenced frontmatter.
3. **Multi-skill import already works.** The endpoint parses every entry before any DB write
   (OPEN-05 atomicity) and inserts one row per parsed skill. It is a loop, not a single-skill path.
4. **ZIP handling is already hardened.** `_sanitize_zip_name` (`:60-65`) rejects traversal (OPEN-06);
   there is a 10 MB cap (`:271`) and an is-it-really-a-zip check (`:275`).
5. **Catalog scale is already solved.** This is the objection everyone raises first — *"2,300 skills
   would blow the system prompt"* — and Phase 140 already answered it.
   `backend/app/services/skill_catalog_filter.py` owns an admin-tunable token budget for the
   `## Available Skills` block, a semantic pre-filter (`skill_embedding_service.py` + the
   `match_skills` RPC), an always-keep pin set derived from recent `load_skill` calls, and an honest
   `_CATALOG_TRIM_MARKER` when it trims. It is documented as fail-open and never-crashes.
6. **Portability was already anticipated.** `skill_lint.py` carries a kebab-case name warning whose
   own comment says a non-kebab name *"just travels less cleanly on **import/export**."* Someone was
   already thinking about skills arriving from elsewhere.

## What actually blocks it — measured, one line

`_find_skill_entries` (`backend/app/api/skills.py:84-95`) finds a skill only at the repository root
or **exactly one directory down**:

```python
if "SKILL.md" in names:
    entries.append(("", zf.read("SKILL.md")))
else:
    for n in sorted(names):
        parts = n.split("/")
        if len(parts) == 2 and parts[1] == "SKILL.md":   # ← line 93. Two. Only ever two.
            entries.append((parts[0] + "/", zf.read(n)))
```

Every real community repository is deeper than that. Measured against
`K-Dense-AI/scientific-agent-skills` via the GitHub trees API on 2026-08-19, all 163 skills live at:

```
skills/<skill-name>/SKILL.md          → 3 segments
```

and a ZIP downloaded from GitHub's own "Download ZIP" button wraps everything in a version directory:

```
scientific-agent-skills-main/skills/<skill-name>/SKILL.md    → 4 segments
```

**Neither is 2.** So the importer falls through to `raise HTTPException(400, "No SKILL.md found in
ZIP")` at `:296` — for an archive containing 163 perfectly valid skills. The error message is
truthful about what the code looked for and completely misleading about what was in the file.

⚠ **This is why SEED-096 never hit it.** That seed's worked example imported Anthropic's `docx`
skill successfully, because the operator zipped the single skill directory — `docx/SKILL.md`, two
segments, the one shape that works. The single-skill path is fine. The *repository* path, which is
the only way anyone acquires skills in bulk, has never worked.

## The second, quieter defect — we discard the label on the tin

Real community frontmatter is a **superset** of what we read. Verbatim from
`K-Dense-AI/scientific-agent-skills/skills/biopython/SKILL.md`:

```yaml
name: biopython
description: Comprehensive molecular biology toolkit. Use for sequence manipulation, file parsing…
allowed-tools: Read Write Edit Bash
compatibility: Requires Python 3.10+, NumPy, and Biopython. Entrez and web BLAST examples require
  network access; local BLAST/MUSCLE examples require those command-line tools installed separately.
license: Biopython License Agreement
metadata:
  version: "1.2"
  skill-author: K-Dense Inc.
  openclaw:
    envVars: [ { name: NCBI_EMAIL, … }, { name: NCBI_API_KEY, … } ]
```

`_parse_skill_md` requires only `name`; the insert at `:322-330` persists `name`, `description`,
`instructions`, `is_org_shared`. **Everything else is parsed into a dict and dropped on the floor.**
Four of those losses matter, and they are not equally bad:

| Dropped key | Why it matters |
|---|---|
| `compatibility` | ⚠ **The worst one.** This is *literally the field that declares the package wall* — the thing SEED-043 and SEED-106 exist to manage. The skill tells us it needs Biopython and BLAST binaries, and we delete the sentence, then discover at runtime. Preserving it is the cheap half of both those seeds. |
| `license` | A B2B product ingesting third-party content with no provenance record. "Biopython License Agreement" is not a detail we get to lose. |
| `allowed-tools` | A **security-relevant declaration** by the skill author about what the skill expects to touch. We discard a capability assertion. |
| `metadata.version` | We have a whole `skill_versions` table (migration 079) and an immutable version UI. An imported skill arrives version-blind. |

Vendor blocks (`metadata.openclaw`) can be ignored by design — but ignoring should be a decision the
code records, not a side effect of never looking.

## What this does NOT fix, stated plainly so nobody claims it does

- **The skill still may not RUN.** That is SEED-096 in full: the tree is flattened on import,
  injection writes to `/sandbox/{basename}` while user code runs in `/sandbox/output`, and the image
  is Python-only with no system binaries. Fixing discovery makes 2,300 skills *arrive*; SEED-096
  governs how many of them *work*.
- **The scientific pack is the worst case for us, not the best.** `biopython`, `astropy`, `anndata`,
  `arboreto` need packages `docs/SANDBOX-PACKAGES.md` does not ship. The packs that would actually
  run today are the document/marketing/writing ones, which sit inside our installed set
  (matplotlib, pandas, python-docx, python-pptx, openpyxl, reportlab, docxtpl). **Pick the pack by
  what the sandbox can execute, not by star count.**
- **The 10 MB ZIP cap is unmeasured against a real repo archive** and may itself bound this.
- **Bulk import has no collision handling** — see SEED-102. 163 inserts, no name check.

## Scope fences that are NOT negotiable

- ⚠ **No live egress.** "Browse GitHub from the Skills page" crosses the Phase 190 STRETCH fence and
  `test_189_no_egress.py`, which fails on any MCP identifier under `backend/app`. **The valuable
  version needs none of it:** the user downloads a repo ZIP and uploads it, exactly as today, or an
  operator vets a pack and ships it as seed data. Discovery-by-fetch is a separate, later decision.
- ⚠ **Nothing imported may default to global.** `is_global` / `is_org_shared` is the cross-tenant
  door (SEED-125, SEED-129). The current code correctly hardcodes `is_org_shared: False` on import.
  **Keep it. Bulk import is exactly the change that would make someone want a "share all" toggle.**

## Why this is worth a phase rather than a note

It converts the Skills feature from a blank page into a stocked shelf, using a format we already
parse, an importer we already hardened, and a catalog filter we already built for exactly this scale
— and the thing standing in the way is a `== 2` that nobody has had reason to look at since the
importer was written for hand-zipped single skills.
