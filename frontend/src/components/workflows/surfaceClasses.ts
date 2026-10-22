/**
 * Phase 291-04 — THE DESCRIBE DOOR'S SHARED ROW CLASSES, IN ONE HOME.
 *
 * `ROW_CLASSES`, `NOTE_CLASSES`, `FOOTING_CLASSES` and `FILENAME_CLASSES` were MOVED here
 * byte-identical from `DescribeTemplateRow.tsx`, so the form slot and its new peer, the
 * references section (sketch 291-describe-files winner B), render one rhythm from one source.
 *
 * ⚠ A `.ts` MODULE, AND THAT IS A CONSTRAINT RATHER THAN A TASTE. `react-refresh/only-export-
 * components` is an active error on this directory: a `.tsx` that carries a component may not
 * also export runtime constants. So the constants cannot be exported from the row they came
 * from, and a second copy typed into the new section would be a second home to drift.
 *
 * ⚠ THE OFF-GRID VALUES (6px, 10px, 10.5px) REACH NEW MARKUP ONLY THROUGH THESE NAMES. The
 * UI-SPEC's `?raw` spacing fence asserts the references section imports them by name and types
 * none of those literals itself, and the same fence runs over the lines 291 added to the row.
 * New class strings that need one of those values live HERE, named, for the same reason.
 */

/** A door section's frame — the template row and the references section alike. */
export const ROW_CLASSES = "mt-3 w-full rounded border border-border bg-muted/40 px-2.5 py-2 text-left"

/** Door explanation: muted, 10.5px. */
export const NOTE_CLASSES = "mt-1.5 text-[10.5px] leading-snug text-muted-foreground"

/** The one footing line under a reading. */
export const FOOTING_CLASSES = "mt-1.5 text-[11px] leading-snug text-foreground"

/** The `📄 Drafting to …` line. */
export const FILENAME_CLASSES =
  "mt-1.5 flex items-center gap-1.5 text-[11px] leading-snug text-foreground"

/**
 * A FACT line (scan unreadable, cut short, couldn't place, refused, no fields): the note's size
 * and rhythm in the FOREGROUND, with no colour (D-17). Facts stand out by colour, not by hue.
 */
export const FACT_CLASSES = "mt-1.5 text-[10.5px] leading-snug text-foreground"

/** The PDF field grid (UI-SPEC Surface 1): name · type word, server order. */
export const FIELD_GRID_CLASSES =
  "mt-1.5 grid grid-cols-[minmax(0,max-content)_max-content] justify-start gap-x-4 gap-y-1 pl-4 text-[11px] leading-snug"

/** The Word placement list (UI-SPEC Surface 1, D-27). */
export const PLACES_LIST_CLASSES = "mt-1.5 flex flex-col gap-1 pl-4 text-[11px] leading-snug"
