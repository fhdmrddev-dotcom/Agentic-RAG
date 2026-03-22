# TC-04: Folder System

## TC-04-01 — Create a root-level folder

**GIVEN** the Documents page, folder tree panel visible on the left
**WHEN** I click the "+" icon at the root level and type a folder name (e.g., "Finance")
**THEN**
- The folder appears in the tree immediately
- No page refresh required (Realtime update)

---

## TC-04-02 — Create a nested subfolder

**GIVEN** a folder "Finance" exists
**WHEN** I click the "+" icon inside "Finance" and type "Q1 2025"
**THEN**
- "Q1 2025" appears nested under "Finance" in the tree
- The tree is expandable/collapsible

---

## TC-04-03 — Upload document into a folder

**GIVEN** a folder "Finance > Q1 2025" exists
**WHEN** I select "Q1 2025" in the folder tree (it becomes the active target) and upload a file
**THEN**
- The document appears in the document list filtered to "Q1 2025"
- The upload zone label updates to reflect the selected folder (e.g., "Upload to Q1 2025")

---

## TC-04-04 — Document list filtered by folder

**GIVEN** documents exist in multiple folders
**WHEN** I click "Finance" in the folder tree
**THEN**
- Only documents inside "Finance" (and its subfolders) are shown in the list
- Documents in other folders are hidden

---

## TC-04-05 — All documents view

**GIVEN** documents exist in multiple folders
**WHEN** I click the root "/" in the folder tree or click "All Documents"
**THEN**
- All documents (regardless of folder) are shown in the list

---

## TC-04-06 — Rename a folder

**GIVEN** a folder named "Finance" in the tree
**WHEN** I right-click (or use the folder actions menu) and select Rename, then type "Accounting"
**THEN**
- The folder name updates to "Accounting" in the tree
- Documents inside are unaffected

---

## TC-04-07 — Delete a folder

**GIVEN** a folder with documents inside
**WHEN** I delete the folder
**THEN**
- The folder is removed from the tree
- Documents previously in that folder are moved to the root (no documents lost)
- The documents appear in the "All" view at root level

---

## TC-04-08 — Global folder visibility

**GIVEN** a global folder was created (via API: `is_global=true`)
**WHEN** a different user logs in
**THEN**
- The global folder is visible in their folder tree
- They can upload documents into it and read its contents

---

## TC-04-09 — Folder tree reflects real-time changes

**GIVEN** two browser tabs open to the same account
**WHEN** a folder is created in Tab A
**THEN**
- The folder appears in Tab B without a page refresh (Supabase Realtime)
