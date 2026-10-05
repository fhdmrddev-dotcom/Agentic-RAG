/* ─────────────────────────────────────────────────────────────────────────────
   Sketch 274 — COPY
   Every string the sketch renders is declared here. The build PORTS this object
   (the feedback-sketch-to-build-drift rule); it does not re-type strings from
   the HTML or README.

   ⚠ ENGINE FACTS ARE REAL — read from the shipped source at 2026-10-05:
     · REFUSE_NOT_OWNER   backend/app/services/ingest_splice.py:173 (the minter's 403)
     · REFUSE_NO_FOLDER   backend/app/services/ingest_splice.py:169 (the minter's 404)
     · CHIP_SCOPE         composerCopy.ts `chipScope` — "this chat only" (sketch 236 A)
     · TTL dropped        274-CONTEXT D-05/D-07: a chat attachment lives for the thread,
                          so the chip no longer says "24h"
     · NO ROOT            274-CONTEXT D-10: unset folder = refuse. Both shipped pickers
                          (MoveToFolderDialog, UploadFolderPicker) offer "Root (no folder)";
                          this sketch deliberately does not.
   ⚠ NET-NEW (does not exist at HEAD): the promote route itself, and whatever the
     "In Library" mark persists on (274-CONTEXT Claude's discretion).
   The business scenario continues sketch 236 (Meridian, Q4 supplier pricing review).
   ───────────────────────────────────────────────────────────────────────────── */

const COPY = {
  engine: {
    REFUSE_NOT_OWNER: "Cannot upload to a folder you do not own",
    REFUSE_NO_FOLDER: "Folder not found",
    CHIP_SCOPE: "this chat only",
  },

  /* ── shared across variants — the verb and the dialog frame are the same in all three ── */
  shared: {
    verb: "Save to Library",                       // D-10: never "Attach", never "Import"
    dialogTitle: "Save to Library",
    dialogSub: "A copy goes into the folder you choose. The file also stays in this chat.",
    folderRequired: "Choose a folder",
    cancel: "Cancel",
    confirm: "Save to Library",
    saving: "Saving…",
    versionWarn: (name, path, n) =>
      `${path} already has a file called ${name}. Saving makes this version ${n}; version ${n - 1} stays in its history.`,
    alreadyTitle: "Already in your Library",
    alreadyBody: (path) => `The same file is already in ${path}, so nothing new was saved.`,
    alreadyDiffFolder: (picked) => `You picked ${picked}. The existing copy was not moved.`,
    openDoc: "Open it",
    done: "Done",
    refuseLead: "You can't save into this folder.",
    indexing: "indexing…",
    inLibrary: "In Library",
    alreadyInLibrary: "Already in Library",
    openInPanel: "Open in panel",
    panelTitle: "Files",
    panelAgentFile: "made by the agent",          // agent-written files get NO save action (D-09)
    agentRead: (name) => `Read ${name}`,
  },

  /* ── Variant A — a menu on the chip; searchable folder list; segment on the chip ── */
  a: {
    name: "A: Menu on the chip",
    claim: "The chip carries a quiet ⋯ that is always visible (touch has no hover). It opens a two-item menu. The dialog is a searchable list of folders shown as full paths. Afterwards the chip itself gains a second segment.",
    moreLabel: "More actions for this file",
    search: "Find a folder",
    afterStyle: "segment",
  },

  /* ── Variant B — the verb is written on the chip; folder tree; a sibling chip ── */
  b: {
    name: "B: The word on the chip",
    claim: "The verb is written beside the chip at low emphasis: no menu to open, nothing to discover. The dialog is the Library's own folder tree. Afterwards a second chip, with the Library's folder icon, sits beside the attachment chip and links to the document.",
    afterStyle: "sibling",
  },

  /* ── Variant C — icon button; the shipped Select with full paths; a line under the message ── */
  c: {
    name: "C: Icon + plain picker",
    claim: "The smallest touch: one icon button with a label for screen readers and a tooltip. The dialog is the shipped Select pattern (minus Root), each folder shown as a full path. Afterwards one plain line sits under the message.",
    iconLabel: "Save to Library",
    selectPlaceholder: "Choose a folder…",
    savedLine: (path) => `Saved to Library · ${path}`,
    alreadyLine: (path) => `Already in Library · ${path}`,
    afterStyle: "line",
  },

  scenario: {
    threadTitle: "Q4 supplier pricing review",
    userMsg: "Compare these quarterly rates against what we agreed in the Meridian contract — flag anything above the cap.",
    file: { name: "Meridian-Q4-pricing.xlsx", ext: ".xlsx", sizeLabel: "84 KB" },
    agentReply: "Two line items sit above the contracted cap: Freight surcharge at 6.2% (cap 4.0%) and Expedite fee at £480 per shipment (cap £350). The remaining eleven are within terms.",
    agentFile: { name: "pricing-variance.md", ext: ".md", sizeLabel: "3 KB" },
    // The Library's folders. `has` = a same-NAME file already in that folder (different bytes).
    folders: [
      { id: "f1", path: ["Contracts"] },
      { id: "f2", path: ["Contracts", "Active suppliers"] },
      { id: "f3", path: ["Finance"] },
      { id: "f4", path: ["Finance", "Q4 2026 review"] },
      { id: "f5", path: ["Suppliers"] },
      { id: "f6", path: ["Suppliers", "Meridian"] },
      { id: "f7", path: ["Suppliers", "Meridian", "Pricing"], has: { name: "Meridian-Q4-pricing.xlsx", nextVersion: 2 } },
      { id: "f8", path: ["Suppliers", "Northwind"], locked: true },   // someone else's folder → the 403
      { id: "f9", path: ["Policies"] },
    ],
    // where the SAME BYTES already live (D-13 — link, don't copy, say where)
    alreadyAt: ["Finance", "Q4 2026 review"],
    pickedForAlready: ["Suppliers", "Meridian"],
  },
}

if (typeof module !== "undefined") module.exports = COPY
