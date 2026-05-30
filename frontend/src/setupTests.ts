import "@testing-library/jest-dom"
// Phase 088-01 (D-13a) — axe-core matcher for the Vitest runner (NOT jest-axe;
// the project runner is Vitest 4.1.0). `expect.extend` makes `toHaveNoViolations`
// available on `expect` across every test file (vitest.config.ts setupFiles loads
// this). vitest-axe pulls axe-core 4.11.4 transitively; dev-dependency only.
import * as axeMatchers from "vitest-axe/matchers"
import { expect } from "vitest"
expect.extend(axeMatchers)
