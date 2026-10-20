import "@testing-library/jest-dom"
// Phase 088-01 (D-13a) — axe-core matcher for the Vitest runner (NOT jest-axe;
// the project runner is Vitest 4.1.0). `expect.extend` makes `toHaveNoViolations`
// available on `expect` across every test file (vitest.config.ts setupFiles loads
// this). vitest-axe pulls axe-core 4.11.4 transitively; dev-dependency only.
import * as axeMatchers from "vitest-axe/matchers"
import { afterEach, expect } from "vitest"
import { resetAskDrafts } from "@/stores/askDraftStore"
import { resetCitationChecks } from "@/stores/citationCheckStore"
expect.extend(axeMatchers)
// Phase 282-02 (D-24): the ask draft store is a module singleton that outlives cleanup(), and a
// leaked selection is toggled OFF by the next case's click — so every case starts with no drafts.
afterEach(() => resetAskDrafts())
// Phase 294-05: the citation-check store is a module singleton too (stored checks, availability and
// the requested-id set would otherwise leak into the next case). It imports its API client lazily,
// so this import does not cache lib/api/_core ahead of any suite's vi.mock of it.
afterEach(() => resetCitationChecks())
