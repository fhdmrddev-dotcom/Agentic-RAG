/**
 * `API_SOURCE` — the api client's source text, as ONE string.
 *
 * ⚠ WHY THIS EXISTS (Phase 207). Three shipped fences sweep the api client's SOURCE
 * rather than its behaviour, and each of them imported `@/lib/api?raw`. That worked
 * while the client was one 6,815-line file. Phase 207 split it into `lib/api/*.ts`
 * behind a re-export barrel, so `@/lib/api?raw` now returns the BARREL — 413 lines of
 * re-exports — and all three fences went red together (8 assertions, measured).
 *
 * ⚠ THE DANGEROUS FIX WOULD HAVE BEEN TO LOWER THEIR SIZE THRESHOLDS. Two of the three
 * open with a NON-VACUITY control (`expect(src.length).toBeGreaterThan(100000)`) whose
 * entire job is to prove the sweep actually read something. Relaxing that number to
 * accommodate a barrel would leave the fence green and blind — which is strictly worse
 * than the red it was showing.
 *
 * So the sweep follows the source. This module is the ONE place that knows the client
 * spans many files; a fence imports `API_SOURCE` and is otherwise untouched.
 *
 * ⚠ TEST-ONLY, and the `.testutil` suffix is load-bearing: this eagerly inlines every
 * api module as a STRING, so a production import would bundle the whole client twice.
 * Nothing under `src/` outside a `*.test.*` file may import it.
 */

const modules = import.meta.glob("./api/*.ts", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

/**
 * Every api module concatenated, ordered by path so the string is STABLE across runs —
 * an unstable order would make a positional assertion flap for no reason.
 *
 * ⚠ The barrel (`lib/api.ts`) is deliberately NOT included. It re-exports names and
 * declares nothing, so folding it in would let a fence that counts DECLARATIONS count a
 * re-export as one — the 187-24 trap in its counting form.
 */
export const API_SOURCE: string = Object.keys(modules)
  .sort()
  .map((k) => modules[k])
  .join("\n")
