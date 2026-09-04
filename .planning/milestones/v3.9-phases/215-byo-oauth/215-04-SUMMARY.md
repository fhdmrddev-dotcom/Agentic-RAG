# Plan 215-04 Summary: Frontend 1-Click OAuth Integration & Revocation State

## Execution Overview
Plan 215-04 integrated the BYO OAuth authorization flow, credential representations, and status handling into the frontend connection manager UI.

## Key Changes
1. **API Models & Client Extensions (`frontend/src/lib/api/`):**
   - Added OAuth types (`OAuthProvider`, `OAuthAuthorizeRequest`, `OAuthAuthorizeResponse`, `OAuthTokenStatusResponse`) and methods `createOAuthAuthorizeUrl` and `getConnectionOAuthToken`.
   - Updated `ConnectorConnection` with `auth_type`, `status`, `account_email`, `account_name`, and `error_message`.
2. **Catalog & Form Copy Derivations (`frontend/src/components/settings/`):**
   - Configured Google Workspace and Microsoft 365 in `servicesCatalog.ts` with `shape: "oauth"` and provider keys.
   - Added `"oauth"` shape to `ConnectionShape`, `FIELD_COUNTS`, `EMPTY_DRAFT`, and `draftFromConnection`.
   - In `connectionsCopy.ts`, added `CONNECTION_STATE_REVOKED = "⚠ Revoked"`, `revoked` state kind, and updated `credentialReadingOf` and `connectionStateOf` to report `account_email` and `OAuth (revoked)`.
3. **UI Components (`ConnectionFormPanel.tsx` & `ConnectionsTab.tsx`):**
   - Added 1-Click OAuth connection card with "Connect with Google" / "Connect with Microsoft 365" action invoking `createOAuthAuthorizeUrl`.
   - Added expandable section for optional custom client ID/secret.
   - Added amber `REVOKED` badge and Reconnect flow.
   - Added `MicrosoftIcon` to `frontend/src/lib/connectionMark.tsx`.
4. **Testing (`ConnectionFormPanel.oauth.test.tsx`):**
   - Added 5 unit tests verifying shape resolution, OAuth authorization card rendering, password field hiding, revoked badge display, and credential reading.
   - Verified all 257 settings tests pass across `ConnectionFormPanel.test.tsx`, `ConnectionsTab.test.tsx`, and `ConnectionFormPanel.oauth.test.tsx`.
   - Verified clean `tsc --noEmit`.

## Verification Result
- Vitest: 257/257 passing
- TSC: Clean (exit code 0)
- Commit: `6bddec077`
