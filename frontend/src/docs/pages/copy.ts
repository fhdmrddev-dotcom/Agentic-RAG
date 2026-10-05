// Phase 276-03 — the page copy contract (UI-SPEC §Copywriting + §Honesty badges), exact words.
// One home, so a page cannot drift from the sentence a grep gate or a test pins.

/** Every release:v4.5 page, first thing after the meta row (G4-3). */
export const UNRELEASED_SENTENCE =
  "Not yet released. This is part of v4.5, which has not shipped. Nothing on this page is in Syrel today."

/** Every stub (D-07). */
export const STUB_SENTENCE = "This page is a short summary. The full guide is being written."

export const NOT_FOUND = {
  title: "This page isn't in the docs",
  body: "It may have moved or been renamed. Search the docs, or start from the docs home.",
  cta: "Go to the docs home",
} as const
