# Phase 264 — deferred / out-of-scope discoveries

## From 264-01 (pre-existing, zero frontend files in this plan's diff)

- **`node scripts/check-landing-drift.cjs` FAILS at the phase base `e9d6a9410`.**
  `SURFACE_TABS.orgAdmin` (`OrgAdminShell.tsx`) lists an **`Experts`** tab that the landing
  canvas's `facts.ts` does not:

  ```
  Source Code: ["Members","Experts","Audit","Settings","Invitations & Roles","SSO","Subscription","Retention"]
  facts.ts:    ["Members",          "Audit","Settings","Invitations & Roles","SSO","Subscription","Retention"]
  ```

  Landed with the Experts work (261 / 263) and never mirrored into the landing facts.
  Reproduced standalone on a tree whose ONLY modified files were
  `backend/app/services/agent_loop.py` and `backend/app/services/tool_dispatcher.py`
  (`git diff --name-only HEAD` quoted in 264-01-SUMMARY.md), so it is provably not this
  plan's. The fix is a one-line `facts.ts` edit and belongs to whoever owns the landing
  canvas — 264-01 touches no frontend source at all.
