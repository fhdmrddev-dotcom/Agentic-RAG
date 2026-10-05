/**
 * Phase 274 plan 03 (D-15) — THE SAVE-TO-LIBRARY COPY, PORTED.
 *
 * ⛔ THIS FILE IS A PORT OF `.planning/sketches/274-save-to-library/COPY.js`, NOT A RE-TYPING OF
 * IT. The operator approved the sketch (winner A, 2026-10-05), and a re-typed string is a silently
 * different product (the `feedback-sketch-to-build-drift` rule). `__tests__/saveToLibraryCopy.test.ts`
 * reads `COPY.js` with `?raw` and asserts every string below as `key: "value"`, so a value that
 * drifts, or drifts onto a different key, goes red rather than shipping.
 *
 * ⭐ WHAT IS PORTED AND WHAT IS NOT, and why the omission is a decision rather than an oversight:
 *   · `COPY.engine`   — PORTED. The server's REAL facts: the minter's 403 and 404 sentences
 *                       (`backend/app/services/ingest_splice.py`, fenced there too) and the chip's
 *                       scope words.
 *   · `COPY.shared`   — PORTED. Every variant shares the verb and the dialog frame. The builders
 *                       (`versionWarn`, `alreadyBody`, `alreadyDiffFolder`, `agentRead`) are
 *                       ported by SHAPE: the fence finds their template text in the sketch.
 *   · `COPY.a`        — PORTED, the product keys only (`moreLabel`, `search`, `afterStyle`). A won
 *                       the operator vote. Its `name` and `claim` are the sketch's pitch to the
 *                       person voting, never rendered by the product, so they are not ported.
 *   · `COPY.b`, `COPY.c` — ⛔ NOT PORTED. They lost the vote. B's written verb is recorded in the
 *                       sketch README as the cheapest addition if UAT shows the `⋯` is not found;
 *                       porting it here would put it one careless edit from shipping.
 *   · `COPY.scenario` — NOT PORTED. The Meridian business case is fixture data, not product.
 *
 * ⛔ The confirm word is `Save to Library`, never `Attach` or `Import` (D-10): `Attach` is the
 * composer's word for "this chat only", and `Import` is the Library door's.
 */

/** The server's own sentences and the chip's scope words (`COPY.engine`). */
const engine = {
  /** `ingest_splice.py` — the minter's 403 when the folder is someone else's. */
  REFUSE_NOT_OWNER: "Cannot upload to a folder you do not own",
  /** `ingest_splice.py` — the minter's 404 when the folder is gone. */
  REFUSE_NO_FOLDER: "Folder not found",
  /** `composerCopy.ts` `chipScope` (sketch 236 A). */
  CHIP_SCOPE: "this chat only",
} as const

/** Shared across every variant: the verb and the dialog frame (`COPY.shared`). */
const shared = {
  verb: "Save to Library",
  dialogTitle: "Save to Library",
  dialogSub: "A copy goes into the folder you choose. The file also stays in this chat.",
  folderRequired: "Choose a folder",
  cancel: "Cancel",
  confirm: "Save to Library",
  saving: "Saving…",
  versionWarn: (name: string, path: string, n: number): string =>
    `${path} already has a file called ${name}. Saving makes this version ${n}; version ${n - 1} stays in its history.`,
  alreadyTitle: "Already in your Library",
  alreadyBody: (path: string): string => `The same file is already in ${path}, so nothing new was saved.`,
  alreadyDiffFolder: (picked: string): string => `You picked ${picked}. The existing copy was not moved.`,
  openDoc: "Open it",
  done: "Done",
  refuseLead: "You can't save into this folder.",
  indexing: "indexing…",
  inLibrary: "In Library",
  alreadyInLibrary: "Already in Library",
  openInPanel: "Open in panel",
  panelTitle: "Files",
  panelAgentFile: "made by the agent",
  agentRead: (name: string): string => `Read ${name}`,
} as const

/** Variant A, the winner: a menu on the chip, a searchable folder list, a segment on the chip. */
const a = {
  moreLabel: "More actions for this file",
  search: "Find a folder",
  afterStyle: "segment",
} as const

/**
 * ⭐ NOT PORTED FROM THE SKETCH — net-new strings, each from a decision the sketch did not draw.
 * The fence asserts none of these appears in `COPY.js`; a string that IS there belongs above.
 *   · `typeRefused`      — D-22: the four types the Library refuses (`.json .py .js .sh`); the
 *                          action is disabled with this reason rather than failing after confirm.
 *                          ⚠ 274 review WR-07: also the dialog's LEAD over a 422 / a type-refusing
 *                          preview, so a type refusal never reads as a folder one.
 *   · `saveFailed` doubles as the lead over any refusal that is neither the folder nor the type.
 *   · `couldntIndex`     — D-25: the segment's terminal state when ingestion `failed`, so it never
 *                          reads `indexing…` forever.
 *   · `noFolders`        — D-10: there is no Root, so a person with no folders must be told where
 *                          to make one rather than offered nowhere.
 *   · `noFolderMatches`  — the search's empty result. The sketch's HTML draws this line inline
 *                          (outside `COPY.js`); the wording is the drawn one.
 *   · `loadFoldersFailed`— `MoveToFolderDialog`'s existing sentence for the same failure.
 *   · `saveVerbMenu`     — the menu item: `shared.verb` plus the ellipsis the sketch draws on it.
 *   · `unknownFolder`    — the existing copy sits at the Library's top level or in a folder this
 *                          person cannot see; `alreadyBody` still needs a place to name.
 *   · `saveFailed`       — a failure that is not a server refusal (the network dropped), so there
 *                          is no server sentence to show verbatim.
 */
const netNew = {
  typeRefused: "The Library doesn't accept this file type.",
  couldntIndex: "couldn't index",
  noFolders: "You have no folders yet. Create one in the Library first.",
  noFolderMatches: "No folder matches.",
  loadFoldersFailed: "Could not load folders.",
  saveVerbMenu: "Save to Library…",
  unknownFolder: "your Library",
  saveFailed: "Couldn't save this file. Try again.",
} as const

export const COPY = { engine, shared, a, netNew } as const
