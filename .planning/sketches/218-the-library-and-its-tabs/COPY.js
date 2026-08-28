/**
 * ⭐ THE GOVERNED VOCABULARY — sketch 218 (SEED-224 / BUS-026, operator direction 2026-08-28).
 *
 * ⚠ IT DOES NOT PORT AS A NEW MODULE FOR THE HALF THAT ALREADY EXISTS. Three of these tables
 * mirror strings that SHIP TODAY, and the drive asserts they are reproduced BYTE FOR BYTE:
 *
 *   SHIPPED[] .................. read out of the live source, never re-typed from memory
 *   NEW[] ...................... genuinely new sentences this redesign introduces
 *
 * ── ⚠ THE HOUSE RULES THIS TABLE INHERITS ──
 *   · Text is noise — cut it. The purpose must survive the cut.
 *   · **Never print the mechanism.** No table names, no `ingestion_step` enum values, no
 *     `audit_log`, no `action_type`. Show the value; hide the derivation.
 *   · Colour carries state and is NEVER the only carrier — every coloured state says its word.
 *   · An unknown value says so. Never blank, never zero, never a green tick.
 */

const COPY = {
  // ══════════════════════════════════════════════════════════════════════════════════════
  // §1 · THE SURFACE'S OWN NAME — operator decision D-2, 2026-08-28
  //
  // ⚠ SHIPPED TODAY (and CHANGING): `nav-items.ts:37` label "Documents";
  //    `IngestionPage.tsx:337` <h1>Documents</h1>.
  // The rename is FRONT-END ONLY. The `ActiveView` key stays "documents" — it is never
  // printed to a user, so renaming it would spend a migration of `citationNav.tsx`,
  // `ChatLayout` and `App.tsx` for zero user-visible gain.
  // ══════════════════════════════════════════════════════════════════════════════════════
  PAGE_TITLE: "Library",
  /** ⚠ REPLACES a shipped line. The shipped one names the mechanism ("Upload documents…"); this
   *  one names the PURPOSE. Both are pinned below so the diff is visible, not assumed. */
  PAGE_SUB: "What the agent can read, and how well it reads it.",
  SHIPPED_PAGE_TITLE: "Documents",
  SHIPPED_PAGE_SUB: "Upload documents to give the AI context for your conversations.",

  // ══════════════════════════════════════════════════════════════════════════════════════
  // §2 · THE TAB SET — the thing this sketch exists to settle
  //
  // ⚠ TWO SETS ARE DRAWN, NOT ONE. Variant A is the seed's five; variant B is four, with
  // Views left where it already works. See README §2 — a tab with no content of its own is
  // the cheapest mistake to find here and the most expensive to find after it ships.
  // ══════════════════════════════════════════════════════════════════════════════════════
  TABS_A: ["Documents", "Views", "Ingestion", "Indexing", "Health"],
  TABS_B: ["Documents", "Ingestion", "Indexing", "Health"],
  /** ⚠ NOT "Retrieval". After the merge tab 5 also carries Stale and Low confidence, which are
   *  not retrieval facts. Naming it Retrieval would make two of its four filters lies. */
  TAB_HEALTH_REJECTED_NAME: "Retrieval",

  // ══════════════════════════════════════════════════════════════════════════════════════
  // §3 · THE DOCUMENT TABLE — SHIPPED. Column order is FIXED and load-bearing.
  //
  // ⚠ `IngestionPage.tsx` sheds columns 3-5 by nth-child when the 430px detail panel opens:
  //    "[&_table_th:nth-child(n+3):nth-child(-n+5)]:hidden". A sketch that reorders these
  //    columns silently breaks the shedding rule on a surface it never draws.
  // ══════════════════════════════════════════════════════════════════════════════════════
  COLUMNS: ["", "Filename", "Type", "Size", "Chunks", "Status", "Actions"],
  SHEDDABLE: ["Type", "Size", "Chunks"],

  // ══════════════════════════════════════════════════════════════════════════════════════
  // §4 · INGESTION STAGES — ⚠ SIX, NOT THREE, AND TWO ARE CONDITIONAL
  //
  // ⛔ SEED-224 says "3-stage per-file progress (parse → chunk → embed)". That is WRONG and
  // the drive proves it: `backend/app/api/documents.py` writes SIX distinct steps, and
  // `frontend/src/lib/termMap.ts` already carries a plain label for every one of them.
  // A fixed 3-segment bar drops `metadata` entirely and collapses three extract phases into
  // one — it would draw a shape the pipeline never has.
  //
  // ⚠ THE TWO CONDITIONAL STAGES ARE WHY THIS IS NOT A PROGRESS BAR. A determinate bar needs
  // a known denominator; this pipeline's length is not known until it runs. So the strip
  // shows STAGES REACHED, never a percentage and never an ETA.
  // ══════════════════════════════════════════════════════════════════════════════════════
  STAGES: [
    { key: "extracting", label: "Reading", always: true },
    { key: "extracting_tables", label: "Tables", always: false },
    { key: "extracting_images", label: "Images", always: false },
    { key: "chunking", label: "Splitting", always: true },
    { key: "embedding", label: "Indexing", always: true },
    { key: "metadata", label: "Labelling", always: true },
  ],
  STAGE_CONDITIONAL_NOTE: "Skipped when the file has none.",

  // ══════════════════════════════════════════════════════════════════════════════════════
  // §5 · STATUS WORDS — SHIPPED. `DocumentStatusBadge.tsx` keys its colour on the RAW enum
  // and routes the LABEL through the term map (Phase 154, D-02a). The enum is untouched here.
  // ══════════════════════════════════════════════════════════════════════════════════════
  STATUS: {
    completed: { word: "Ready", tone: "success" },
    processing: { word: "Working", tone: "primary" },
    pending: { word: "Queued", tone: "dim" },
    failed: { word: "Failed", tone: "danger" },
  },

  // ══════════════════════════════════════════════════════════════════════════════════════
  // §6 · THE HEALTH TAB — the merge (operator decision D-1)
  //
  // ⚠ THESE FOUR FILTERS ARE THE SHIPPED `KnowledgeHealthPage` TABS. They become CHIPS inside
  // one tab, because four more top-level tabs would make a nine-tab bar.
  // ══════════════════════════════════════════════════════════════════════════════════════
  /** ⚠ SEVEN chips, in TWO named groups — the merge of Library Health (4) AND Governance (3).
   *  Seven undifferentiated chips is a filter bar nobody reads, so they split on the question
   *  they answer: is it being used, or is it in good shape. */
  HEALTH_GROUPS: {
    "Being used": ["Most found", "Never found", "Weak matches"],
    "In good shape": ["Stale", "Unclassified", "Broken links", "Unsure metadata"],
  },
  get HEALTH_FILTERS() {
    return [...this.HEALTH_GROUPS["Being used"], ...this.HEALTH_GROUPS["In good shape"]]
  },

  SHIPPED_HEALTH_TABS: ["Most Retrieved", "Never Retrieved", "Stale", "Low Confidence"],
  /** The three cards on the shipped Governance page, which merges in here (operator, 2026-08-28). */
  SHIPPED_GOVERNANCE_CARDS: ["Broken relationships", "Unclassified documents", "Low-confidence metadata"],

  // ══════════════════════════════════════════════════════════════════════════════════════
  // ⚠ THE RENAME MAP — every shipped signal maps to exactly ONE chip, and the map is TOTAL.
  //
  // This exists so a rename can never become a LOSS. The drive asserts (a) every shipped
  // signal appears here, and (b) every target is actually rendered — so dropping a signal
  // during the merge fails, while renaming one is allowed and auditable.
  //
  // ⭐ THE COLLISION THIS RESOLVES, AND IT WOULD HAVE SHIPPED SILENTLY:
  //   Library Health "Low Confidence"      = avg RETRIEVAL SIMILARITY below 0.38
  //   Governance     "Low-confidence …"    = an EXTRACTED FIELD below the confidence tier, 0.5
  // Two thresholds, two meanings, one pair of words — and the merge puts them in the same row.
  // ══════════════════════════════════════════════════════════════════════════════════════
  SIGNAL_RENAMES: {
    "Most Retrieved": "Most found",
    "Never Retrieved": "Never found",
    "Stale": "Stale",
    "Low Confidence": "Weak matches",              // ← retrieval similarity
    "Broken relationships": "Broken links",
    "Unclassified documents": "Unclassified",
    "Low-confidence metadata": "Unsure metadata",  // ← extraction confidence
  },

  /** ⚠ The shipped Library Health stat cards, verbatim, so the merge can be checked for LOSS
   *  rather than assumed complete. `Retrieval Score` is the contested one — see §7. */
  SHIPPED_HEALTH_TILES: ["Total Docs", "Coverage %", "Retrieval Score", "Active This Month"],

  TILES: [
    { label: "DOCUMENTS", value: "224", sub: "12 added this month" },
    { label: "COVERAGE", value: "87 of 224", sub: "found by a search in 30 days" },
    { label: "SEARCHES", value: "412", sub: "last 30 days" },
    { label: "CHECKED QUERIES", value: "12", sub: "9 holding, 3 slipped" },
  ],

  // ══════════════════════════════════════════════════════════════════════════════════════
  // §7 · ⚠ THE CONTESTED TILE — drawn BOTH ways, decided by the operator, not by this file
  //
  // `Retrieval Score` ships today as a bare percentage. This brief's cut list forbids a
  // percentage score — but this one is NOT decorative: it is derived from real similarity
  // thresholds (`LOW_CONF_THRESHOLD 0.38` / `HIGH_CONF_THRESHOLD 0.54`).
  //
  // ⚠ So the objection is not "the number is fake". It is "the number does not say what it
  // measures", and a reader will assume it means quality. Arm 2 keeps the value and adds the
  // sentence that makes it true.
  // ══════════════════════════════════════════════════════════════════════════════════════
  SCORE_AS_SHIPPED: { label: "Retrieval Score", value: "0.61" },
  SCORE_QUALIFIED: {
    label: "MATCH STRENGTH",
    value: "0.61",
    sub: "average similarity of what searches returned",
  },
  SCORE_ABSENT_ARM: "Not enough searches yet",

  // ══════════════════════════════════════════════════════════════════════════════════════
  // §8 · ⚠ THE NAME THIS FEATURE MUST NOT HAVE
  //
  // `workflow_runs.is_golden_run` ALREADY MEANS something else in this product: the publish
  // gauntlet's one live run, of which `runs.py:526` says "A GOLDEN RUN IS NEVER RESUMABLE".
  // Calling a retrieval fixture a "golden sample" puts two unrelated meanings on one word.
  // ══════════════════════════════════════════════════════════════════════════════════════
  GOLDEN_REJECTED: ["Golden sample", "Golden answer", "Golden query"],
  /** The chosen name: it says what it does and collides with nothing. */
  CHECK_TITLE: "Checked queries",
  CHECK_SUB: "Questions you expect a document to answer.",
  CHECK_ADD: "Add a check",
  CHECK_COLUMNS: ["Question", "Should find", "Rank", "Verdict"],
  CHECK_VERDICT: {
    holding: { word: "Holding", tone: "success" },
    slipped: { word: "Slipped", tone: "danger" },
    unrun: { word: "Not checked yet", tone: "dim" },
  },
  /** ⚠ A slipped check names WHAT CHANGED, never just that it is red. */
  CHECK_SLIPPED_DETAIL: (was, now) => `was ${was}, now ${now}`,

  // ══════════════════════════════════════════════════════════════════════════════════════
  // §9 · EMPTY + UNKNOWN ARMS — "silence is not success"
  // ══════════════════════════════════════════════════════════════════════════════════════
  EMPTY_NEVER_RETRIEVED: "Every document has been found by a search.",
  EMPTY_NO_SEARCHES: "No searches yet — ask the agent something.",
  /** ⚠ The 30-day window is the ONLY window there is. A document not listed is not "never
   *  retrieved"; it is "not retrieved in 30 days", and saying otherwise is the lie. */
  WINDOW_NOTE: "Counts cover the last 30 days.",
  NEVER_RETRIEVED_SUB: "In the library, never returned by a search in 30 days.",

  // ══════════════════════════════════════════════════════════════════════════════════════
  // §10 · THE CHUNK LIST — read-only, and it says so
  // ══════════════════════════════════════════════════════════════════════════════════════
  CHUNKS_TITLE: "Chunks",
  CHUNKS_SUB: "What the agent actually searches.",
  CHUNKS_EMPTY: "Not split yet.",
}

if (typeof module !== "undefined") module.exports = { COPY }
