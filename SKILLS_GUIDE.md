# Agent Skills — Complete Guide

Skills are reusable AI behaviors you define once and the agent loads on demand. Think of them as saved playbooks: the agent sees the skill name and description in every chat, and when your request matches, it automatically loads the full instructions and follows them.

---

## How Skills Work (Under the Hood)

Every time you start a chat in **General mode**, the agent receives a catalog of your enabled skills injected into its system prompt:

```
## Available Skills
- **Weekly Report**: Generates a structured weekly report from uploaded files
- **SQL Analyst**: Writes optimized SQL queries for your data
```

When you ask something that matches a skill description, the agent calls `load_skill("Weekly Report")`, which returns the full instructions and any attached files. It then follows those instructions precisely. A ⚡ Zap indicator appears in the chat when a skill activates.

Skills do **not** activate in Explorer mode — only in General mode.

---

## Where to Find Pre-Made Skills

### agentskills.io
The open standard this app uses for skill import/export is compatible with **agentskills.io**. Skills are distributed as `.zip` files containing a `SKILL.md` with YAML frontmatter and instructions.

> Note: agentskills.io is the emerging community hub for the format. If the site is not live yet, the ZIP format is fully documented below so you can create and share skills manually.

### GitHub / Community
Search GitHub for repositories with `agentskills` or `SKILL.md` in the name. The format is open — anyone can publish skills as ZIP files.

### The Built-In Skill Creator
Your app ships with a pre-loaded global skill called **"Skill Creator"** (visible to all users). Ask the agent in chat:

> *"Help me create a skill that does X"*

The agent will guide you through writing the name, description, and instructions, then save it automatically using `save_skill`.

---

## The Skills Tab — UI Reference

Navigate to the **Skills** tab (third tab in the sidebar).

| Button | What it does |
|--------|-------------|
| **New Skill** | Opens a form to create a skill from scratch |
| **Import Skill** | Opens a file picker — select a `.zip` file to import |
| Each skill card → **Edit** (pencil) | Edit name, description, instructions, and attached files |
| Each skill card → **Enable toggle** | Toggle whether the skill appears in the agent's catalog |
| Each skill card → **Share toggle** | Make the skill visible to all users (global) or keep it private |
| Each skill card → **Try in Chat** | Opens a new chat pre-loaded with a prompt to trigger the skill |
| Each skill card → **Export** (download icon) | Downloads the skill as a `.zip` file |
| Each skill card → **Delete** (trash icon) | Permanently deletes the skill |

### Skill Form Fields

| Field | Purpose |
|-------|---------|
| **Name** | Unique identifier — the agent uses this to load the skill (e.g. `Weekly Report`) |
| **Description** | One sentence the agent reads to decide when to use this skill — be specific |
| **Instructions** | Step-by-step instructions the agent follows when the skill is loaded |
| **Attached Files** *(edit mode)* | Reference files the agent can read via `read_skill_file` |

---

## Importing a Skill

1. Go to the **Skills** tab
2. Click **Import Skill** (top right)
3. Select a `.zip` file
4. The app parses `SKILL.md` from inside the ZIP and creates the skill(s)
5. A confirmation message shows: *"X skill(s) imported."*

The imported skill starts **disabled** and **private** — enable it by toggling the switch on its card before it appears in the agent's catalog.

**ZIP format rules:**
- Must contain a `SKILL.md` file inside a root folder named after the skill slug (e.g. `weekly-report/SKILL.md`)
- `SKILL.md` must start with YAML frontmatter (`---`) containing at least `name:` (lowercase slug format)
- Max ZIP size: **10 MB**
- Path traversal filenames are rejected for security

---

## Exporting a Skill

1. Open the **Skills** tab
2. Find the skill and click the **download icon** on its card
3. A `.zip` file is downloaded to your computer
4. Share it with teammates or import it into another instance of the app

---

## Creating a Skill Manually

### Skill Form (Recommended for simple skills)

1. Click **New Skill**
2. Fill in the three fields:
   - **Name**: Short, descriptive (e.g. `Weekly Report`)
   - **Description**: *"Generates a weekly status report from uploaded documents using a Word template"*
   - **Instructions**: The full playbook (see examples below)
3. Click **Save Skill**
4. Enable it by toggling the switch on the card

### Via Chat (For iterative creation)

Ask the agent directly:

> *"Create a skill called 'Weekly Report' that reads my project files and generates a structured report"*

The agent uses `save_skill` to create it. You can then find it in the Skills tab and refine the instructions.

---

## Writing Good Instructions

Instructions are what the agent reads and follows. Be explicit — treat it like writing a procedure for a new employee.

**Bad instructions:**
```
Write a weekly report from my files.
```

**Good instructions:**
```
You are generating a weekly status report. Follow these steps exactly:

1. Use glob("*weekly*") or grep("week") to find relevant documents uploaded this week.
2. For each found document, use analyze_document to extract: completed tasks, blockers, and planned work.
3. Use execute_code with libraries=["python-docx"] to create a Word document (.docx) with this structure:
   - Title: "Weekly Status Report — [date]"
   - Section 1: "Completed This Week" — bullet list
   - Section 2: "Blockers & Risks" — bullet list
   - Section 3: "Planned Next Week" — bullet list
   - Footer: "Generated by AI Agent"
4. Save the file to /sandbox/output/weekly_report.docx
5. Return the download link to the user.
```

---

## Weekly Report Skill — Full Example

Here is a complete, production-ready weekly report skill that generates a formatted `.docx` Word document.

### Create this skill in the Skills tab:

**Name:** `Weekly Report`

**Description:** `Generates a formatted Word document weekly status report from uploaded project files, organized by completed work, blockers, and planned tasks.`

**Instructions:**

```
You are generating a weekly status report as a formatted Word document. Follow every step below precisely.

## Step 1 — Find This Week's Documents

Use grep or glob to find relevant documents. Try these searches in order:
1. glob("*weekly*") — files with "weekly" in the name
2. glob("*report*") — files with "report" in the name  
3. grep("completed|finished|done|blocker|next week") — documents with status content
4. If nothing specific found, use ls("/") to list all documents and pick the most relevant ones.

## Step 2 — Extract Content from Each Document

For each relevant document found, call analyze_document with:
  task: "Extract three lists from this document: (1) Completed tasks this week, (2) Current blockers or risks, (3) Tasks planned for next week. Return as structured JSON with keys: completed, blockers, planned."

Collect all results. Combine items from all documents — remove exact duplicates.

## Step 3 — Generate the Word Document

Call execute_code with libraries=["python-docx"] and this Python code (substitute the actual extracted content):

```python
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from datetime import date

doc = Document()

# Title style
title = doc.add_heading("Weekly Status Report", 0)
title.alignment = WD_ALIGN_PARAGRAPH.CENTER

# Date subtitle
subtitle = doc.add_paragraph(f"Week ending: {date.today().strftime('%B %d, %Y')}")
subtitle.alignment = WD_ALIGN_PARAGRAPH.CENTER
subtitle.runs[0].font.color.rgb = RGBColor(0x88, 0x88, 0x88)

doc.add_paragraph()  # spacer

# Section 1 — Completed
doc.add_heading("✅ Completed This Week", level=1)
completed_items = [
    # REPLACE WITH ACTUAL EXTRACTED ITEMS
    "Item 1 from documents",
    "Item 2 from documents",
]
for item in completed_items:
    p = doc.add_paragraph(style="List Bullet")
    p.add_run(item)

doc.add_paragraph()

# Section 2 — Blockers
doc.add_heading("🚧 Blockers & Risks", level=1)
blocker_items = [
    # REPLACE WITH ACTUAL EXTRACTED ITEMS
    "Blocker 1",
]
if blocker_items:
    for item in blocker_items:
        p = doc.add_paragraph(style="List Bullet")
        p.add_run(item).font.color.rgb = RGBColor(0xCC, 0x33, 0x33)
else:
    doc.add_paragraph("No blockers reported.")

doc.add_paragraph()

# Section 3 — Planned
doc.add_heading("📋 Planned Next Week", level=1)
planned_items = [
    # REPLACE WITH ACTUAL EXTRACTED ITEMS
    "Planned task 1",
]
for item in planned_items:
    p = doc.add_paragraph(style="List Bullet")
    p.add_run(item)

doc.add_paragraph()

# Footer
footer_para = doc.add_paragraph("─" * 60)
footer_para.alignment = WD_ALIGN_PARAGRAPH.CENTER
note = doc.add_paragraph("Generated automatically by AI Agent")
note.alignment = WD_ALIGN_PARAGRAPH.CENTER
note.runs[0].font.size = Pt(9)
note.runs[0].font.color.rgb = RGBColor(0xAA, 0xAA, 0xAA)

doc.save("/sandbox/output/weekly_report.docx")
print("Report saved to /sandbox/output/weekly_report.docx")
```

IMPORTANT: Before running the code, replace the placeholder lists (`completed_items`, `blocker_items`, `planned_items`) with the actual content extracted in Step 2. Build the Python lists as string literals inside the code string before calling execute_code.

## Step 4 — Return the Result

After execute_code completes, a download link for `weekly_report.docx` will appear in the chat. Tell the user the report is ready and summarize the key sections in 3-4 bullet points.

## Requirements

- SANDBOX_ENABLED must be true (Docker must be running) for the Word document generation
- If sandbox is not available, produce a Markdown-formatted report in the chat instead as a fallback
```

---

## Using the Weekly Report Skill

Once created and enabled:

1. Open a **new chat** in General mode
2. Type: *"Generate the weekly report"* or *"Create a weekly status report from my files"*
3. The agent sees the skill in its catalog, calls `load_skill("Weekly Report")`, reads the instructions, then:
   - Searches your uploaded documents
   - Extracts completed work, blockers, and planned tasks
   - Generates a `.docx` file in the sandbox
   - Returns a download link in the chat

**For best results:** Upload your project status files (daily standup notes, task logs, Jira exports, etc.) before running the report.

---

## Attaching a Word Template File

Instead of generating the document structure from scratch, you can attach a `.docx` template to the skill and the agent will use it as the base.

1. Create the skill and save it first
2. Click **Edit** on the skill card
3. In the **Attached Files** section, click **Attach File**
4. Upload your `weekly_template.docx`
5. Update the Instructions to reference the file:

```
## Step 3 — Use the Template

Call read_skill_file(skill_name="Weekly Report", filename="weekly_template.docx") 
to get the file reference, then use execute_code to load it:

```python
# The template file will be available — load it and fill in the placeholders
from docx import Document
import base64

# Decode and load template
template_b64 = "<base64 content from read_skill_file>"
with open("/tmp/template.docx", "wb") as f:
    f.write(base64.b64decode(template_b64))

doc = Document("/tmp/template.docx")
# Now modify doc paragraphs to fill in your data...
doc.save("/sandbox/output/weekly_report.docx")
```
```

---

## ZIP Format for Manual Distribution

If you want to create a skill ZIP file by hand (to share with teammates):

```
weekly-report.zip
└── weekly-report/
    └── SKILL.md
```

`SKILL.md` contents:
```markdown
---
name: weekly-report
description: Generates a formatted Word document weekly status report from uploaded project files
license: MIT
metadata:
  version: "1.0"
  original_name: Weekly Report
compatibility: Requires execute_code tool with Docker sandbox and python-docx
---

[Full instructions text here]
```

For a skill with attached files:
```
weekly-report.zip
└── weekly-report/
    ├── SKILL.md
    ├── assets/
    │   └── weekly_template.docx
    └── references/
        └── style_guide.md
```

**File placement rules:**

| Directory | File types |
|-----------|-----------|
| `scripts/` | Python files (`.py`) |
| `assets/` | Images, audio, video, Office documents (`.docx`, `.xlsx`, `.pptx`), PDFs, ZIPs, binary files |
| `references/` | Plain text documentation (`.md`, `.txt`, `.csv`, `.html`) |

---

## Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| Skill doesn't activate | Skill is disabled | Toggle the enable switch on the skill card |
| Skill doesn't activate | Description is too vague | Make description match how users will phrase requests |
| "Skill not found" error | Name mismatch | Ensure skill name in instructions matches exactly |
| No Word file generated | `SANDBOX_ENABLED=false` | Set `SANDBOX_ENABLED=true` in `.env` and start Docker |
| Import fails | Invalid ZIP structure | Ensure ZIP has a root folder containing `SKILL.md` (e.g. `my-skill/SKILL.md`) |
| Skill activates in wrong mode | Using Explorer mode | Switch to General mode — skills are General-only |
