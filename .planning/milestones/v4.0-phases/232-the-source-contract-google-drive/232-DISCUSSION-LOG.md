# Phase 232: The Source Contract + Google Drive — Discussion Log

**Date:** 2026-09-05  
**Participants:** Operator, Gemini (Builder)  
**Status:** Completed  

---

## Gray Areas & Locked Decisions

### 1. Drive Folder Tree UX (My Drive vs Shared Drives)
- **Question:** How should the Drive picker present My Drive and Shared Drives to the user?
- **Options Considered:**
  1. *(Recommended)* Two top-level root nodes ("My Drive" and "Shared Drives") inside a unified tree picker.
  2. A segmented toggle at the top switching between "My Drive" and "Shared Drives" views.
  3. Flat list of drives first (My Drive + each Shared Drive), expanding into their folders.
- **Decision:** **Option 1 (Two top-level root nodes in a unified tree picker)**.
- **Rationale:** Mirrors native cloud drive browsing semantics. A single tree control eliminates state switching between tabs, letting the user browse and compare hierarchies intuitively.

---

### 2. Connection Source Configuration & Inbound Identity
- **Question:** How should connection source configuration and inbound identity be persisted?
- **Options Considered:**
  1. *(Recommended)* Zero migrations: Use existing `connector_connections` with `service_id='google'` and store source folder configuration in the existing `config` JSONB (respecting SEED-146).
  2. Raise migration 157 to explicitly add an inbound capability / direction column on `connector_connections`.
- **Decision:** **Option 1 (Zero migrations, ratified by Operator on 2026-09-05 discuss-phase turn)**.
- **State Boundary & Multi-Folder Watching Rationale (BUS-131 addressed):**
  - The measurement pack (`BUS-127` / `BUS-130`) proved that `capability` is nullable, and migration 127's `connector_connections_shape_is_not_ambiguous` constraint explicitly permits both `capability` and `mcp_server_url` to be null. Google OAuth connections already exist in this shape today.
  - Adding a column triggers SEED-146's warning against prematurely committing connection table shapes.
  - Crucially, a connection represents an authenticated *account* (1 connection -> N watched folders). Storing a singular authoritative folder in `connector_connections.config` would foreclose multi-folder watching and create a duplicate source of truth when Phase 234's `connector_watches` table lands.
  - Therefore, Phase 232 implements folder selection as an interactive component callback contract (`onSelectFolder({ folderId, folderName, driveId, driveName })`) without binding a singular authoritative watch into `config`. Watched folders remain cleanly owned by Phase 234.

---

### 3. Mock/Fake Source Family Exposure in UI
- **Question:** Where and when should the test-suite fake source adapter appear in the source picker?
- **Options Considered:**
  1. *(Recommended)* Gate on test/dev environment or mock flag so the fake adapter is selectable only during tests or local development.
  2. Always expose the Mock/Test Source adapter in the source picker alongside Google Drive.
- **Decision:** **Option 1 (Gate on test/dev environment or mock flag)**.
- **Rationale:** Satisfies `SRC-01` Success Criterion 4 ("A source family that exists only in the test suite appears in the product's own source picker and browses exactly like Drive") without leaking mock adapters into customer-facing production environments.

---

## Next Steps
- Run `gsd:plan-phase 232` to author the execution plans.
- Create threat model / validation documents if applicable.
