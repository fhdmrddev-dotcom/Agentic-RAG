---
phase: 247-sources-and-watches
plan: 04
status: complete
wave: 3
commits:
  - id: pending
    message: "docs(247-04): disposition Phase 240 warnings and reviewer findings, sync hot-file ledger, complete verification"
requirements_met: [WATCH-08]
gates_passed:
  - "node scripts/check-hot-file-ledger.cjs: 0 (clear)"
  - "node scripts/check-verification-honesty.cjs: 0 (clear, 10/10 subject files carry verification_mode)"
  - "node scripts/check-claude-md-size.cjs: 0 (clear, 99625 chars, 50375 headroom)"
  - "backend tests: 43/43 passed across 4 suites"
  - "frontend tests: 144/144 passed across 4 suites"
  - "connectors.py fence: byte-identical (0 lines modified)"
---

# Plan 247-04 Summary: Warnings & Findings Disposition, Hot-File Ledger Sync & Verification

**Delivered:**
1. **`247-DISPOSITION.md` Delivered (WATCH-08):**
   - Dispositioned all seven Phase 240 review warnings:
     - WR-04 (User label human name resolution): Fixed in 247-01.
     - WR-07 (Recursive boundary fence check): Fixed in 247-01 and hardened with meta-test in 247-03.
     - WR-09 (Microsoft Graph product mark mapping to OneDrive): Fixed in 247-03.
     - WR-02 (SharePoint path parsing without root marker): Accepted debt; preserves WR-03 fail-safe.
     - WR-05 (DOM limit on missing files): Accepted debt; UI capped at 5 files with `+N more` counter.
     - WR-06 (Push subscriptions / webhooks): Accepted debt; polled schedule preserved per D-234.
     - WR-08 (Disposition documentation): Completed in `247-DISPOSITION.md`.
   - Dispositioned Wave 1 reviewer findings (BUS-214):
     - F-1 (BLOCKING - Multi-tenant Gmail label cache): Fixed in 247-03 with `(connection_id, label_id)` keying and unit test.
     - F-2 (Fence exemption meta-tests): Fixed in 247-03 with `LEAF_SHARED_MODULES` and `test_provider_half_and_leaf_modules_are_guarded`.
     - F-3 (Orphan commit ID in summary): Corrected to `e5ded885a` on develop.
     - F-4 (Bounded cache memory lifecycle): Documented eviction threshold and worker restart policy.
2. **Hot-File Ledger Synchronisation (`docs/HOT-FILE-LEDGER.md`):**
   - Added `## frontend/src/components/sources/WatchRowCard.tsx` narrative section and row in the Scan list table (`2 / 1 / 649`).
   - Recorded G-5 discharge on `frontend/src/components/sources/WatchedFoldersSection.tsx` (1,095 -> 470 lines).
   - Re-derived triples for `watch_service.py` (`7 / 5 / 643`), `watches.py` (`4 / 3 / 709`), and `sources.py` (`8 / 2 / 693`).
   - Verified with `node scripts/check-hot-file-ledger.cjs .planning/phases/247-sources-and-watches` (exited 0).
3. **Phase Verification & Honesty Gate:**
   - Authored `247-VERIFICATION.md` with `verification_mode: peer-reviewed` documenting full evidence across all 8 WATCH requirements.
   - Verified with `node scripts/check-verification-honesty.cjs` (exited 0).
   - Verified with `node scripts/check-claude-md-size.cjs` (exited 0, 50,375 char headroom).
