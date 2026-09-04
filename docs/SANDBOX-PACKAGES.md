# Sandbox packages — what `execute_code` can import

Canonical reference for the Python packages preinstalled in the agent's code-execution
sandbox (the `execute_code` tool). **This is the human-readable single source of truth.**
The machine truth is the `pip install` line in
[`backend/Dockerfile.sandbox`](../backend/Dockerfile.sandbox); this doc must be kept in
sync with it (see "Keeping this in sync" below).

> Why this doc exists: on 2026-07-08 a skill authored by skill-creator instructed the
> agent to use `fpdf2` for a PDF — a library that is **not** installed and whose default
> fonts crash on Unicode — when `reportlab` (installed, Unicode-safe) was the right tool.
> Root cause: nothing told the skill-authoring path what is actually installed. This doc,
> plus migration `093` (skill-creator awareness) and the `execute_code` tool description,
> close that gap. The longer-term goal is one source that feeds all of them — see
> [SEED-043](../.planning/seeds/SEED-043-sandbox-package-management.md).

## Environment

- **Base image:** `python:3.11-slim`
- **Built image tag:** `agentic-rag-sandbox:101.1` (set as `SANDBOX_IMAGE` in
  `backend/.env`; when unset, `llm_sandbox`'s bare-Python image is used and every new
  chat pays a ~10–15 s pip warm-up). See CLAUDE.md "Sandbox image" for build/tag rules.
- **Approx image size:** ~700 MB. Measure live with
  `docker images agentic-rag-sandbox --format '{{.Size}}'`.
- **Language:** Python only. The sandbox does **not** run JavaScript/shell/other
  runtimes (skill helper scripts must be Python).
- **Network egress:** **PyPI is reachable** — a runtime `pip install` works (confirmed
  2026-07-08: a missing package was fetched mid-run in ~6.6 s). The
  `Dockerfile.sandbox` "network is sealed" comment is inaccurate for egress and is
  tracked for reconciliation in SEED-043.

## Preinstalled packages

Pinned for supply-chain stability; versions are authoritative in the Dockerfile.

| Package | Version | Use it for | Notes |
|---|---|---|---|
| `reportlab` | 4.2.5 | **Writing PDFs** | Unicode-safe — register a TrueType font (see below). The correct PDF choice. |
| `pypdf` | 5.1.0 | Reading / merging / splitting PDFs | **Read-only — cannot create a PDF.** Use `reportlab` to write. |
| `python-docx` | 1.1.2 | Building `.docx` from scratch | |
| `docxtpl` | 0.20.2 | Filling a `.docx` template via Jinja placeholders | The trusted-path template render engine (Phase 101). |
| `python-pptx` | 1.0.2 | Building/editing `.pptx` | |
| `openpyxl` | 3.1.5 | Reading/writing `.xlsx` | Use this for Excel — **not** `xlsxwriter` (not installed). |
| `matplotlib` | 3.9.2 | Charts → PNG | Ships DejaVu Sans TTF (see font note). |
| `seaborn` | 0.13.2 | Statistical charts | On top of matplotlib. |
| `plotly` | 5.24.1 | Interactive/exportable charts | |
| `pandas` | 2.2.3 | Dataframes / tabular analysis | |
| `numpy` | 2.1.3 | Arrays / numerics | |
| `scipy` | 1.14.1 | Scientific computing | |
| `scikit-learn` | 1.5.2 | Basic ML | |
| `ezdxf` | 1.3.5 | **Reading CAD DXF files** | Entity extraction (blocks, dimensions, specs) for quantity takeoff (Phase 220). |

### PDF + Unicode (the fpdf2 lesson)

Use **`reportlab`** for PDFs. For any non-Latin-1 text (em-dashes, £, accented names),
register a TrueType font — DejaVu Sans ships with matplotlib at:

```
/usr/local/lib/python3.11/site-packages/matplotlib/mpl-data/fonts/ttf/DejaVuSans.ttf
```

Do **not** use `fpdf`/`fpdf2` (not installed; its default fonts raise a latin-1 encode
error on Unicode), `pdfkit`, or `weasyprint`.

## Deliberately NOT installed (and why)

- `fpdf`/`fpdf2`, `pdfkit`, `weasyprint` — `reportlab` covers PDF writing better.
- `xlsxwriter` — `openpyxl` covers Excel.
- `requests`, `beautifulsoup4` — intended for a sealed sandbox; also, the agent is the
  thing that browses/fetches, not sandbox code. (Egress to PyPI does work — see above.)
- `opencv-python` — heavy, rarely needed.
- `transformers`, `torch`, `tensorflow` — gigabytes; the agent *is* the LLM.
- `nltk`, `spacy` — require model downloads.
- `pdfplumber` — `pypdf` covers the 80%.

## Authoring skills against this set

When a skill (or skill-creator) writes `execute_code` that generates a file or chart,
**name a library from the table above.** Never recommend a same-purpose library that
isn't installed — it forces a slow pip install and is often a worse fit. This rule is
encoded in the skill-creator prompt (migration `093`). If a task genuinely needs an
uninstalled package, tell the user it will pip-install on first run (a brief warm-up)
and could fail — don't assume it's present.

## Should we add a package? (size / performance model)

The cost of baking a package in is usually **not** installed size — it's a layered
tradeoff:

| Cost axis | Pure-Python pkg (e.g. fpdf2 ~1–2 MB) | Heavy pkg (torch/transformers, GBs) |
|---|---|---|
| Image size | Negligible (<0.5%) | Dominant — rejected |
| Build time | Seconds | Minutes |
| **Cold cloud-deploy pull** | Negligible | The real pain — every rebuild re-pulls |
| Supply-chain surface | +1 dep to pin/trust | +many transitive deps |
| Perf vs NOT baking | Saves ~5–15 s pip warm-up on first use per new chat | Same, warm-up 30 s+ |

**Rule of thumb:** bake a package in only when (1) no installed peer already covers the
need, AND (2) it's either hot (used most chats) or heavy enough that a runtime warm-up
hurts. Light, rarely-used libs are fine to leave to the runtime `pip install` fallback.

## How to add a package

1. Add it (pinned) to the `pip install` line in `backend/Dockerfile.sandbox`.
2. Update **this doc's table**.
3. Update the skill-creator awareness list (a new migration, following `093`) and the
   `execute_code` tool description in `openai_service.py` — until the SEED-043 single
   source of truth exists, these are hand-synced.
4. Rebuild with a **new** tag and bump `SANDBOX_IMAGE` (tag rules in CLAUDE.md):
   `docker build -f backend/Dockerfile.sandbox -t agentic-rag-sandbox:<new> backend/`
5. New chats pick it up; existing chats keep their cached container until idle eviction.

## Keeping this in sync

Today "what's installed" lives in four places that can drift: the Dockerfile (truth),
this doc, the `execute_code` tool description, and the skill-creator prompt (mig 093).
Unifying these into one source is [SEED-043](../.planning/seeds/SEED-043-sandbox-package-management.md)
half (a); bringing the set up to the official-provider-skill toolchain is
[SEED-106](../.planning/seeds/SEED-106-sandbox-image-parity-with-provider-skill-runtimes.md).
Whenever the Dockerfile changes, update this doc in the same commit.
