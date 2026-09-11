/* ─────────────────────────────────────────────────────────────────────────────
   Sketch 236 — COPY
   Every string the sketch renders is declared here. The sketch renders NOTHING
   that is not in this object, so the build PORTS THIS OBJECT rather than hunting
   strings through JSX (the feedback-sketch-to-build-drift rule).

   ⚠ ENGINE FACTS ARE REAL — read from the shipped source, not invented:
     · ALLOWED_EXT         backend/app/api/workspace.py:124-130
     · MAX_MB              backend/app/api/workspace.py MAX_FILE_SIZE (10 MB)
     · TTL_HOURS           backend/app/models/user_settings.py:292 (template_ttl_hours = 24)
     · REFUSE_TYPE / REFUSE_SIZE / REFUSE_EMPTY are the server's OWN 422 strings
     · PLUS_BTN_TESTID     frontend/src/components/chat/MessageInput.tsx:354
     · CLOUD_ITEM_TODAY    the one item that ships today (MessageInput.tsx:378)

   The BUSINESS SCENARIO is deliberately authored (feedback-sketch-realistic-
   not-fixture-data): a wording/trust question needs a readable business case,
   while the engine facts stay real.
   ───────────────────────────────────────────────────────────────────────────── */

const COPY = {
  /* ── Engine facts — REAL, do not edit without re-reading the source ───────── */
  engine: {
    // ⭐ Phase 244 / D-244-24 — `.pdf` IS TAKEN and shipped (`_PDF_EXT`, `%PDF-` magic bytes).
    // This list is PINNED to the server: `backend/tests/unit/test_244_workspace_pdf.py` parses
    // this array out of this file and asserts set equality against `workspace.py _ALLOWED_EXT`,
    // so the acceptance bar and the build cannot drift apart silently. Sixteen, not fifteen.
    ALLOWED_EXT: [
      ".docx", ".pptx", ".xlsx",
      ".md", ".json", ".csv", ".txt", ".py", ".js", ".sh",
      ".png", ".jpg", ".jpeg", ".gif", ".webp",
      ".pdf",
    ],
    MAX_MB: 10,
    TTL_HOURS: 24,
    PLUS_BTN_TESTID: "composer-plus-btn",
    CLOUD_ITEM_TODAY: "Import from Cloud Storage...",
    // The server's own refusal sentences (workspace.py). A build must surface
    // THESE, not a paraphrase.
    REFUSE_TYPE: (ext, allowed) => `Unsupported type ${ext || "(none)"}. Allowed: ${allowed}`,
    REFUSE_SIZE: "File too large. Maximum size is 10 MB.",
    REFUSE_EMPTY: "File is empty",
  },

  /* ── Variant A — scope lives on the CHIP; the menu stays plain ───────────── */
  a: {
    menuTitle: null,                       // deliberately no header — plain menu
    itemLocal: "Attach a file",
    itemCloud: "From cloud storage",
    itemConnectors: "Tools and connectors",
    chipScope: "this chat only",
    chipTtl: "24h",
    chipRemove: "Remove",
    cloudTitle: "Choose a file",
    cloudSub: "From Google Drive · Meridian Supply",
    cloudConfirm: "Attach",
    cloudCancel: "Cancel",
    sentNote: "this chat only",
  },

  /* ── Variant B — the DOOR names the destination; the chip stays minimal ──── */
  b: {
    menuTitle: "Add a file to this chat",
    itemLocal: "From this computer",
    itemCloud: "From cloud storage",
    itemConnectors: "Tools and connectors",
    menuFooter: "Files here stay in this chat. The Library is for files you keep.",
    chipScope: null,                       // deliberately absent — the door said it
    chipTtl: null,
    chipRemove: "Remove",
    cloudTitle: "Add to this chat",
    cloudSub: "From Google Drive · Meridian Supply",
    cloudConfirm: "Add to this chat",
    cloudCancel: "Cancel",
    sentNote: null,
  },

  /* ── Shared across both variants ──────────────────────────────────────────── */
  shared: {
    composerPlaceholder: "Ask anything…",
    sendLabel: "Send",
    agentReadLine: (name) => `Read ${name}`,
    expiredChip: "No longer available",
    expiredWhy: "Files attached to a chat are kept for 24 hours.",
    refusalDismiss: "OK",
  },

  /* ── The authored business scenario ───────────────────────────────────────── */
  scenario: {
    threadTitle: "Q4 supplier pricing review",
    userMsg: "Compare these quarterly rates against what we agreed in the Meridian contract — flag anything above the cap.",
    file: { name: "Meridian-Q4-pricing.xlsx", ext: ".xlsx", sizeLabel: "84 KB" },
    cloudFiles: [
      { name: "Meridian-Q4-pricing.xlsx", ext: ".xlsx", meta: "Modified 2 days ago · 84 KB" },
      { name: "Contract-amendment-3.docx", ext: ".docx", meta: "Modified last week · 31 KB" },
      { name: "Supplier-scorecard.csv", ext: ".csv", meta: "Modified 3 weeks ago · 12 KB" },
    ],
    refusedFile: { name: "Meridian-contract-signed.pdf", ext: ".pdf" },
    agentReply: "Two line items sit above the contracted cap: Freight surcharge at 6.2% (cap 4.0%) and Expedite fee at £480 per shipment (cap £350). The remaining eleven are within terms.",
  },
}

if (typeof module !== "undefined") module.exports = COPY
