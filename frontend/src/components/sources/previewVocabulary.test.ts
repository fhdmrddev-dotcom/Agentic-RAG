/**
 * Phase 233 (PREV-01 / LIB-09) — the four labels are the deliverable, so they get a fence.
 *
 * ⭐ This suite is the React-side twin of `229-the-four-buckets/drive.cjs` §5 and §6. The sketch
 * asserts the labels against the mockup; this asserts them against the shipped vocabulary, so the
 * two cannot come to disagree.
 *
 * ⚠ **THE HASH GUARD IN THE SKETCH WAS PROVEN BROKEN BEFORE IT WAS TRUSTED**, and the same trap
 * is avoided here. Its first version searched the whole document, so rewriting one variant's copy
 * to *"matched by content hash"* still passed: the phrase survived elsewhere and the sub-region
 * regex silently matched nothing at all. This suite therefore reads the module's own source with
 * `?raw` **and asserts the source was actually read** (a length floor) before any claim rests on
 * it — the `217-06` lesson, where `index.css?raw` resolved to `""` under vitest and nine cases
 * went green over nothing.
 */
import { describe, it, expect } from "vitest"

import {
  BUCKET_ORDER,
  BUCKET_LABEL,
  BUCKET_BLURB,
  HERE_QUALIFIER,
  ZERO_WRITE_LINE,
  CANCEL_TOAST,
  OUTCOME_ORDER,
  reconciliationLine,
  confirmLabel,
  scannedLine,
  STOPPED_REASON,
} from "./previewVocabulary"

// The live source this suite is BOUND to — the repo's shipped `?raw` fence idiom.
import vocabularySource from "./previewVocabulary.ts?raw"

describe("the four buckets", () => {
  it("non-vacuity — the ?raw import really carries the module", () => {
    expect(vocabularySource.length).toBeGreaterThan(1500)
    expect(vocabularySource).toContain("BUCKET_LABEL")
  })

  it("there are EXACTLY four, in render order", () => {
    expect(BUCKET_ORDER).toEqual(["add", "here", "uns", "unk"])
    expect(BUCKET_ORDER).toHaveLength(4)
  })

  it("the labels are verbatim from the locked sketch", () => {
    expect(BUCKET_LABEL.add).toBe("Will be added")
    expect(BUCKET_LABEL.here).toBe("Already here")
    expect(BUCKET_LABEL.uns).toBe("Type not supported")
    expect(BUCKET_LABEL.unk).toBe("Can't tell without reading it")
  })

  it("every bucket has a label and a blurb — none is a bare word", () => {
    for (const b of BUCKET_ORDER) {
      expect(BUCKET_LABEL[b]).toBeTruthy()
      expect(BUCKET_BLURB[b].length).toBeGreaterThan(20)
    }
  })
})

describe("⛔ 'Already here' may not claim a content identity", () => {
  it("the qualifier is PRESENT, not merely the overclaim absent", () => {
    // An absent overclaim and a present qualifier are different guarantees, and only the second
    // survives a copy edit that reflows the sentence.
    expect(HERE_QUALIFIER).toBe("by source file, not content")
    expect(BUCKET_BLURB.here).toContain("not content")
    expect(BUCKET_BLURB.here).toContain("have not been compared")
  })

  it("the forbidden words appear NOWHERE in the vocabulary's own copy", () => {
    // ⚠ Scoped to the string constants, not the whole file: the module's DOCBLOCK deliberately
    // discusses hashes at length to explain why the copy must not. A whole-file search would
    // fire on the explanation and would then be softened into uselessness — which is exactly how
    // the sketch's first guard became decoration.
    const copy = [
      ...Object.values(BUCKET_LABEL),
      ...Object.values(BUCKET_BLURB),
      HERE_QUALIFIER,
      ZERO_WRITE_LINE,
      CANCEL_TOAST,
    ]
      .join(" ")
      .toLowerCase()
    expect(copy).not.toContain("hash")
    expect(copy).not.toContain("checksum")
    expect(copy).not.toContain("digest")
    expect(copy).not.toContain("identical")
  })
})

describe("the zero-write receipt is four numbers, never a mood", () => {
  it("names all four things that were not written", () => {
    expect(ZERO_WRITE_LINE).toBe("0 documents · 0 chunks · 0 jobs · 0 folders")
    for (const noun of ["documents", "chunks", "jobs", "folders"]) {
      expect(ZERO_WRITE_LINE).toContain(`0 ${noun}`)
    }
  })

  it("Cancel prints the zeros rather than saying 'cancelled'", () => {
    expect(CANCEL_TOAST).toContain(ZERO_WRITE_LINE)
    expect(CANCEL_TOAST.toLowerCase()).not.toContain("cancelled")
  })
})

describe("outcomes", () => {
  it("there are EXACTLY three, so 'silently in neither' is unrepresentable", () => {
    expect(OUTCOME_ORDER).toEqual(["added", "here", "refused"])
    expect(OUTCOME_ORDER).toHaveLength(3)
  })
})

describe("the sentences the surface composes", () => {
  it("the reconciliation line is the SC#4 receipt", () => {
    expect(reconciliationLine(26, 0, 12, 12)).toBe(
      "26 accounted · 0 unaccounted — preview said 12 → 12 added",
    )
  })

  it("the confirm names BOTH numbers when something still has to be opened", () => {
    expect(confirmLabel(12, 4)).toBe("Add 12 · read 4")
  })

  it("…and names only one when nothing is uncertain", () => {
    expect(confirmLabel(12, 0)).toBe("Add 12")
  })
})

describe("⛔ the screen may not imply a depth the walk did not go to", () => {
  it("says so plainly when sub-folders were NOT read", () => {
    expect(scannedLine(1, false)).toBe("This folder only — sub-folders were not read.")
  })

  it("distinguishes 'no sub-folders' from 'sub-folders not read'", () => {
    // ⚠ These are DIFFERENT facts and the first shipped version could state neither: it read
    //    one level deep and said nothing at all, so a person previewing a nested folder was
    //    shown less than they had selected with no way to tell.
    expect(scannedLine(1, true)).toBe("This folder — it has no sub-folders.")
    expect(scannedLine(1, true)).not.toBe(scannedLine(1, false))
  })

  it("counts sub-folders, and gets the plural right at one", () => {
    expect(scannedLine(2, true)).toBe("This folder and 1 sub-folder.")
    expect(scannedLine(4, true)).toBe("This folder and 3 sub-folders.")
  })
})

describe("⛔ a budget-stopped listing names WHICH budget stopped it", () => {
  it("has a sentence for every stop reason the walker can emit", () => {
    // The walker's `stopped_by` values, mirrored. A reason with no sentence renders the generic
    // "did not finish" line — true, but it drops the one detail a person could act on.
    for (const reason of ["depth", "folders", "files", "pages", "unreadable"]) {
      expect(STOPPED_REASON[reason]).toBeTruthy()
      expect(STOPPED_REASON[reason].length).toBeGreaterThan(25)
    }
  })

  it("never says 'some files' — the sentence that lets a person assume the rest were fine", () => {
    for (const sentence of Object.values(STOPPED_REASON)) {
      expect(sentence.toLowerCase()).not.toContain("some files")
    }
  })
})
