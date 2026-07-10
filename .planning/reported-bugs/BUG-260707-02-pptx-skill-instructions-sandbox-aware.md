# PPTX Skill

## Quick Reference

 | Task | Guide |
 |------|-------|
 | Read / analyze content | Read in-memory with `python-pptx` (see [Reading Content](#reading-content)) |
 | Edit or create from template | Read [editing.md](editing.md) |
 | Create from scratch | Read [python-pptx-guide.md](python-pptx-guide.md) |

> **Sandbox note:** this environment has **python-pptx** only — no `markitdown`,
> no LibreOffice (`soffice`), no Poppler (`pdftoppm`). Read and QA presentations
> **in-memory with python-pptx**; do NOT shell out to those tools or to
> `scripts/office/*` — they are absent and calling them loops on FileNotFoundError.
> Save and read files by relative path in the working directory; the execute_code
> tool reports each saved file's location.

---

## Reading Content

Read slide text in-memory with python-pptx:

```python
from pptx import Presentation
prs = Presentation("presentation.pptx")
for i, slide in enumerate(prs.slides, 1):
    print(f"===== SLIDE {i} =====")
    for shape in slide.shapes:
        if shape.has_text_frame:
            for para in shape.text_frame.paragraphs:
                text = "".join(run.text for run in para.runs)
                if text.strip():
                    print(" •", text)
```

---

## Editing Workflow

**Read [editing.md](editing.md) for full details.** Work in-memory with
python-pptx (open -> manipulate slides -> edit content -> save). Skip any
LibreOffice/soffice thumbnail or unpack steps that guide may mention — they are
not available here.

---

## Creating from Scratch

**Read [python-pptx-guide.md](python-pptx-guide.md) for full details.**

Use when no template or reference presentation is available. This guide covers the python-pptx library, which is the standard tool for programmatically creating and editing PPTX files in Python.

---

## Design Ideas

**Don't create boring slides.** Plain bullets on a white background won't impress anyone. Consider ideas from this list for each slide.

### Before Starting

- **Pick a bold, content-informed color palette**: The palette should feel designed for THIS topic. If swapping your colors into a completely different presentation would still "work," you haven't made specific enough choices.
- **Dominance over equality**: One color should dominate (60-70% visual weight), with 1-2 supporting tones and one sharp accent. Never give all colors equal weight.
- **Dark/light contrast**: Dark backgrounds for title + conclusion slides, light for content ("sandwich" structure). Or commit to dark throughout for a premium feel.
- **Commit to a visual motif**: Pick ONE distinctive element and repeat it — rounded image frames, icons in colored circles, thick single-side borders. Carry it across every slide.

### Color Palettes

Choose colors that match your topic — don't default to generic blue. Use these palettes as inspiration:

| Theme | Primary | Secondary | Accent |
|-------|---------|-----------|--------|
| **Midnight Executive** | `1E2761` (navy) | `CADCFC` (ice blue) | `FFFFFF` (white) |
| **Forest & Moss** | `2C5F2D` (forest) | `97BC62` (moss) | `F5F5F5` (cream) |
| **Coral Energy** | `F96167` (coral) | `F9E795` (gold) | `2F3C7E` (navy) |
| **Warm Terracotta** | `B85042` (terracotta) | `E7E8D1` (sand) | `A7BEAE` (sage) |
| **Ocean Gradient** | `065A82` (deep blue) | `1C7293` (teal) | `21295C` (midnight) |
| **Charcoal Minimal** | `36454F` (charcoal) | `F2F2F2` (off-white) | `212121` (black) |
| **Teal Trust** | `028090` (teal) | `00A896` (seafoam) | `02C39A` (mint) |
| **Berry & Cream** | `6D2E46` (berry) | `A26769` (dusty rose) | `ECE2D0` (cream) |
| **Sage Calm** | `84B59F` (sage) | `69A297` (eucalyptus) | `50808E` (slate) |
| **Cherry Bold** | `990011` (cherry) | `FCF6F5` (off-white) | `2F3C7E` (navy) |

### For Each Slide

**Every slide needs a visual element** — image, chart, icon, or shape. Text-only slides are forgettable.

**Layout options:**
- Two-column (text left, illustration on right)
- Icon + text rows (icon in colored circle, bold header, description below)
- 2x2 or 2x3 grid (image on one side, grid of content blocks on other)
- Half-bleed image (full left or right side) with content overlay

**Data display:**
- Large stat callouts (big numbers 60-72pt with small labels below)
- Comparison columns (before/after, pros/cons, side-by-side options)
- Timeline or process flow (numbered steps, arrows)
- Native charts (using python-pptx chart API for embedded, editable charts)

**Visual polish:**
- Icons in small colored circles next to section headers
- Italic accent text for key stats or taglines

### Typography

**Choose an interesting font pairing** — don't default to Arial. Pick a header font with personality and pair it with a clean body font.

| Header Font | Body Font |
|-------------|-----------|
| Georgia | Calibri |
| Arial Black | Arial |
| Calibri | Calibri Light |
| Cambria | Calibri |
| Trebuchet MS | Calibri |
| Impact | Arial |
| Palatino | Garamond |
| Consolas | Calibri |

| Element | Size |
|---------|------|
| Slide title | 36-44pt bold |
| Section header | 20-24pt bold |
| Body text | 14-16pt |
| Captions | 10-12pt muted |

### Spacing

- 0.5" minimum margins
- 0.3-0.5" between content blocks
- Leave breathing room—don't fill every inch

### Avoid (Common Mistakes)

- **Don't repeat the same layout** — vary columns, cards, and callouts across slides
- **Don't center body text** — left-align paragraphs and lists; center only titles
- **Don't skimp on size contrast** — titles need 36pt+ to stand out from 14-16pt body
- **Don't default to blue** — pick colors that reflect the specific topic
- **Don't mix spacing randomly** — choose 0.3" or 0.5" gaps and use consistently
- **Don't style one slide and leave the rest plain** — commit fully or keep it simple throughout
- **Don't create text-only slides** — add images, icons, charts, or visual elements; avoid plain title + bullets
- **Don't forget text box padding** — when aligning lines or shapes with text edges, set `margin: 0` on the text box or offset the shape to account for padding
- **Don't use low-contrast elements** — icons AND text need strong contrast against the background; avoid light text on light backgrounds or dark text on dark backgrounds
- **NEVER use accent lines under titles** — these are a hallmark of AI-generated slides; use whitespace or background color instead

---

## QA (Required)

**Assume there are problems. Your job is to find them.**

Your first render is almost never correct. Approach QA as a bug hunt, not a confirmation step. If you found zero issues on first inspection, you weren't looking hard enough.

All QA here is **in-memory with python-pptx** — there is no image rendering in this sandbox.

### Content QA

Dump every slide's text in-memory (see [Reading Content](#reading-content)) and check for missing content, typos, and wrong order.

**Check for leftover placeholder text** by scanning the extracted text in Python:

```python
import re
from pptx import Presentation
bad = re.compile(r"xxxx|lorem|ipsum|this.*(page|slide).*layout", re.I)
prs = Presentation("output.pptx")
for i, slide in enumerate(prs.slides, 1):
    for shape in slide.shapes:
        if shape.has_text_frame and bad.search(shape.text_frame.text):
            print(f"slide {i}: PLACEHOLDER -> {shape.text_frame.text!r}")
```

Fix any hits before declaring success.

### Visual QA (programmatic — no image rendering available)

You CANNOT rasterize slides to images here (no LibreOffice/Poppler). Do a programmatic layout audit with python-pptx instead — it catches the mechanical issues (out-of-bounds shapes, overflow past slide edges, tiny margins):

```python
from pptx import Presentation
prs = Presentation("output.pptx")
W, H = prs.slide_width, prs.slide_height
issues = 0
for i, slide in enumerate(prs.slides, 1):
    for shape in slide.shapes:
        l, t = shape.left or 0, shape.top or 0
        w, h = shape.width or 0, shape.height or 0
        if l < 0 or t < 0 or l + w > W or t + h > H:
            issues += 1
            print(f"slide {i}: OUT OF BOUNDS -> {shape.name}")
print("Out-of-bounds issues:", issues, "| Total slides:", len(prs.slides._sldIdLst))
```

Extend with overlap / margin / alignment checks as needed. Fix whatever the audit flags.

### Verification Loop

1. Generate slides -> run the programmatic Content QA + layout audit above
2. **List issues found** (if none found, tighten the checks and look again)
3. Fix issues
4. **Re-run the audit on the rebuilt file** — one fix often creates another problem
5. Repeat until a full pass reveals no new issues

**Do not declare success until you've completed at least one fix-and-verify cycle.**

---

## Converting to Images

**Not available in this sandbox.** LibreOffice (`soffice`) and Poppler (`pdftoppm`) are not installed, so PPTX -> PDF -> image rendering fails with FileNotFoundError. Use the programmatic **Visual QA** audit above instead. Do NOT call `scripts/office/soffice.py`, `soffice`, `pdftoppm`, or `markitdown`.

---

## Dependencies (this sandbox)

**Available:** `python-pptx` — create, edit, read, and QA presentations. This is the only tool you need here.

**NOT available (do not call — they fail):** `markitdown`, LibreOffice (`soffice`), Poppler (`pdftoppm`), and the `scripts/office/*` helpers. All reading and QA must be done in-memory with python-pptx.
