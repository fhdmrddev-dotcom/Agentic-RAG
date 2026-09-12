/**
 * `stripComments` — remove `//` line comments and `/* … *\/` block comments from source text
 * before a `?raw` fence counts anything in it.
 *
 * ⚠ WHY THIS EXISTS, AND WHY IT IS SHARED RATHER THAN COPIED (Phase 244-14, review IN-02).
 * A `?raw` source fence CANNOT TELL CODE FROM A COMMENT. `244-12` measured that the expensive
 * way: `MessageItem.inlineApproval.test.tsx` asserted `<PendingAskStack` appeared exactly ONCE
 * in `MessageItem.tsx`, the mount then MOVED to `MessageList.tsx`, and a prose mention in
 * MessageItem's own *"it was here and is gone"* comment held the count at 1 — so the fence went
 * on passing while the thing it counted had left the file entirely.
 *
 * `244-12`'s repair (assert 0 on one side and 1 on the other) fixed the ZERO side for good and
 * left the ONE side carrying the identical hazard one file over. This normaliser is the actual
 * remedy, and it lives here — in ONE place — because the repair for *"two copies of a rule
 * drift"* must not itself be two copies of a rule.
 *
 * ⚠ DELIBERATELY CRUDE: it does not parse strings, so a string literal containing `//` is
 * mangled. That is acceptable for the sweeps it serves (identifier and class-token counts) and
 * unacceptable for anything that asserts on string CONTENT. ⛔ Never apply it to a class-list
 * assertion.
 *
 * ⚠ CRLF-SAFE by construction: `.` never matches a newline, `[\s\S]` does, and `$` with the `m`
 * flag matches before a `\r`. Source files check out with Windows line endings on this box.
 *
 * ⚠ TEST-ONLY — the `.testutil` suffix is load-bearing (the `apiSource.testutil.ts` precedent).
 * Nothing under `src/` outside a `*.test.*` file may import it.
 */
export const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "")
