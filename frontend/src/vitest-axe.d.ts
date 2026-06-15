/**
 * Phase 094 Plan 03 — vitest-axe matcher type augmentation.
 *
 * setupTests.ts registers `toHaveNoViolations` at runtime
 * (`expect.extend(axeMatchers)`), but vitest 4.x's `Assertion` interface does not
 * know the matcher's type — so `expect(await axe(container)).toHaveNoViolations()`
 * raised TS2339 "Property 'toHaveNoViolations' does not exist" across every panel
 * a11y test (the documented baseline gap). vitest-axe ships an `extend-expect.d.ts`
 * that augments only the legacy `Vi.Assertion` namespace, which vitest 4 no longer
 * routes matcher types through.
 *
 * This declaration augments the `vitest` module's `Assertion` +
 * `AsymmetricMatchersContaining` interfaces so the runtime-registered matcher is
 * type-visible. Additive (a new file, no baseline file touched); it resolves the
 * net-new INV-2 axe assertions AND the pre-existing PendingAskCard/WorkspacePanel
 * axe assertions in the same matcher class.
 */
import "vitest"
import type { AxeMatchers } from "vitest-axe/matchers"

declare module "vitest" {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Assertion<T = any> extends AxeMatchers {}
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface AsymmetricMatchersContaining extends AxeMatchers {}
}
