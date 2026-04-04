# Phase 11: Skills LLM Integration — Human UAT

> Browser verification steps for Phase 11 outcomes. These tests require a running backend and frontend with at least one skill in the database.
>
> **Note:** The live E2E test was intentionally deferred to Phase 12 by explicit user decision (documented in 11-03-SUMMARY.md). The `onSkillActivated` SSE callback was wired as a no-op in Phase 11 — full observable behaviour (visual skill-activated indicator) was not built until Phase 12. This UAT should be performed with the Phase 12 UI in place.

---

## Prerequisites

1. Backend running: `cd backend && python -m uvicorn app.main:app --reload`
2. Frontend running: `cd frontend && npm run dev`
3. At least one skill created (name: "Test Skill", description: "A test skill for UAT", instructions: "When activated, respond with: Skill activated successfully.")
4. The skill is toggled **enabled**

---

## UAT Checklist

### UAT-11-01: Skill Catalog Injection

**Scenario:** General Mode system prompt contains the skill catalog.

**Steps:**
1. Open browser DevTools → Network tab
2. Start a new General Mode chat thread
3. Send any message (e.g. "hello")
4. Inspect the POST `/threads/{id}/messages` request payload
5. The backend should include skill catalog in the system prompt (not directly visible from client, but verifiable from LLM behaviour)

**Expected:**
- LLM response may reference available skills if the message is relevant
- No errors in backend logs

**Pass/Fail:** ___

---

### UAT-11-02: load_skill Tool Dispatch

**Scenario:** LLM calls `load_skill` when the user's request matches an enabled skill description.

**Steps:**
1. Start a new General Mode chat thread
2. Send a message that matches the skill description (e.g. "Use my Test Skill")
3. Observe the ToolCallPanel in the chat response

**Expected:**
- A `load_skill` tool call appears in the ToolCallPanel
- A `skill_activated` event fires (visible in Phase 12 as a "Skill activated: Test Skill" indicator in the message)
- LLM final response references the skill instructions ("Skill activated successfully.")

**Pass/Fail:** ___

---

### UAT-11-03: Explorer Mode Excludes Skill Tools

**Scenario:** Explorer Mode does NOT include load_skill, save_skill, or read_skill_file.

**Steps:**
1. Switch to Explorer Mode (Compass icon in the input toolbar)
2. Send a message matching a skill description (e.g. "Use my Test Skill")

**Expected:**
- No `load_skill` tool call appears
- LLM response does not mention skills or skill instructions
- Only KB tools (ls, tree, grep, glob, read_document, analyze_document) are available

**Pass/Fail:** ___

---

### UAT-11-04: save_skill Tool Dispatch

**Scenario:** LLM calls `save_skill` to create a new skill from conversation.

**Steps:**
1. Start a new General Mode chat thread
2. Send: "Create a skill called 'Summarizer' that summarizes documents in 3 bullet points"

**Expected:**
- A `save_skill` tool call appears in the ToolCallPanel with name, description, and instructions visible
- LLM confirms the skill was created
- Navigating to the Skills tab shows the new "Summarizer" skill

**Pass/Fail:** ___

---

### UAT-11-05: read_skill_file Tool Dispatch

**Scenario:** LLM calls `read_skill_file` when skill has an attached file.

**Steps:**
1. Attach a small text file (e.g. `template.txt` containing "Hello World") to the Test Skill via the Skills tab
2. Start a new General Mode chat thread
3. Send: "Read the template file from Test Skill"

**Expected:**
- A `read_skill_file` tool call appears in the ToolCallPanel
- LLM response includes the file content ("Hello World")

**Pass/Fail:** ___

---

## Sign-off

| Test | Result | Notes |
|------|--------|-------|
| UAT-11-01 | | |
| UAT-11-02 | | |
| UAT-11-03 | | |
| UAT-11-04 | | |
| UAT-11-05 | | |

**Verified by:** ___
**Date:** ___
**Overall:** PASS / FAIL
