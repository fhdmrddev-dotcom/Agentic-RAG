"""Phase 104 Plan 01 — reproducible builder for the synthetic "PM Demo Project" corpus.

CONTENT/DATA ONLY (PM-01). This writes 5 markdown docs into
``scripts/pm-pack/sample-corpus/`` that the headline Weekly Status Report and the
Risk Register template-fill workflows retrieve from and cite against. The seed script
(Plan 02) ingests these via ``POST /documents/upload`` into a per-account demo folder.

Why markdown (RESEARCH Q4): ``ALLOWED_MIME_TYPES`` accepts ``text/markdown``; it ingests
byte-identically to a human upload and is the simplest synthetic content to author. The
material reuses the spike-097 "Project Meridian" story (Legacy CRM → Cloud migration;
PM Dana Whitfield; risks M-01..M-07 + SR-01..SR-03 with worded High/Medium/Low
probability + impact, named owners, mitigations, status) so risks recur across docs and
citation cross-referencing is exercised.

The corpus carries cited-able spans for EVERY non-null field the status report + risk
register defs fill: project name, reporting period, overall RAG status (AMBER),
accomplishments, planned next, risks/blockers, milestones, and each risk's 8
model-emitted columns (id, description, category, probability, impact, owner, mitigation,
status). A healthy ~10% decline-rate is EXPECTED — the corpus is deliberately NOT padded
to 0% (that would signal invention). 5 docs ≈ 5 embedding calls at seed time.

Run from the repo root:
    backend/venv/Scripts/python.exe scripts/pm-pack/make_pm_corpus.py
"""

from __future__ import annotations

from pathlib import Path

OUT = Path(__file__).resolve().parent / "sample-corpus"


# ---------------------------------------------------------------------------
# Doc 1 — Project Charter source (project name, sponsor, objectives, scope, programme)
# ---------------------------------------------------------------------------
PROJECT_CHARTER_SOURCE = """# Project Meridian — Project Charter (Source Excerpt)

- **Project**: Project Meridian (Legacy CRM to Cloud Platform Migration)
- **Document**: Project Charter v1.2 — Sections 1, 3 and 7 extract
- **Sponsor**: Marcus Alvarez, Chief Operating Officer
- **Programme**: CRM Modernisation
- **Project Manager**: Dana Whitfield
- **Duration**: 24-week programme

## 1. Purpose and Objectives

Project Meridian migrates Brightline Insurance's on-premise legacy CRM to a
cloud-hosted platform over a 24-week programme. The objectives approved at charter
sign-off are:

- Decommission the on-premise legacy CRM and move all customer and policy data to the
  new cloud platform.
- Improve data quality by removing duplicate and partially merged customer records
  before migration.
- Integrate the third-party policy-rating API so quotes are produced inside the new
  platform.
- Deliver the migration without a customer-facing outage during business hours.

## 3. Scope

In scope: customer records, policy records, the policy-rating integration, agent-facing
UI, and the cutover runbook. Out of scope: the actuarial reporting batch (re-pointed,
not rebuilt) and the billing programme (a separate parallel workstream).

## 7. Initial Strategic Risk Assessment

At charter approval the steering committee recorded the following strategic risks to be
actively managed and reviewed at each stage gate:

- **Strategic risk SR-01 (Executive sponsorship continuity).** Category: governance.
  A pending reorganisation of the operations division could cause loss of an engaged
  executive sponsor mid-programme, stalling decisions and funding. Probability: Low.
  Impact: High. Owner: Marcus Alvarez (COO). Response: name a deputy sponsor with
  delegated authority. Status: open.
- **Strategic risk SR-02 (Regulatory approval).** Category: compliance. The cloud
  platform must pass an information-security assessment before holding customer data;
  a delay would block production cutover and slip the schedule beyond the 24-week
  window. Probability: Low. Impact: High. Owner: Sade Okafor (Security Lead).
  Response: engage the regulator early and book the assessment in Week 14. Status: open.
- **Strategic risk SR-03 (Legacy decommission dependency).** Category: technical. The
  legacy CRM also feeds the nightly actuarial reporting batch; decommissioning legacy
  without re-pointing the feed would break regulatory financial reporting. Probability:
  Medium. Impact: High. Owner: Priya Nair (Data Lead). Response: map and re-point the
  downstream feed before decommission. Status: open.
"""


# ---------------------------------------------------------------------------
# Doc 2 — Weekly meeting notes, Week 8 (an earlier reporting period for freshness)
# ---------------------------------------------------------------------------
WEEKLY_MEETING_NOTES_W1 = """# Project Meridian — Weekly Meeting Notes (Week 8 of 24)

- **Project**: Project Meridian
- **Reporting period**: Week 8 of 24
- **Chair**: Dana Whitfield, Project Manager
- **Overall RAG status**: GREEN

## Accomplishments this period

- Cloud landing zone provisioned; security hardening started.
- Kicked off the legacy data profiling pass across customer and policy records.
- Agreed the de-duplication threshold (0.5%) with the Data team.

## Blockers and decisions

- No critical blockers this week; programme remains on schedule.
- Decision: the policy-rating API integration will be developed against a stub until the
  vendor contract is signed.

## Action items

- Priya Nair to complete the data profiling pass by end of Week 9.
- Tom Becker to chase Acme Ratings Ltd on the API contract.

## Upcoming milestones

- Week 11 — Data migration dress rehearsal.
- Week 13 — Integration test entry for the policy-rating API.
"""


# ---------------------------------------------------------------------------
# Doc 3 — Weekly meeting notes, Week 9 (the LATEST reporting period — RAG → AMBER)
# ---------------------------------------------------------------------------
WEEKLY_MEETING_NOTES_W2 = """# Project Meridian — Weekly Meeting Notes (Week 9 of 24)

- **Project**: Project Meridian
- **Reporting period**: Week 9 of 24
- **Chair**: Dana Whitfield, Project Manager
- **Overall RAG status**: AMBER

## Executive summary

We are at the end of Week 9. Foundation infrastructure is provisioned and the
data-profiling pass is complete, but two risks have escalated this week and the
programme RAG status has moved from Green to Amber. The critical path now runs through
the data-migration validation gate and the third-party policy-rating API integration.

## Accomplishments this period

- Cloud landing zone provisioned and security-hardened (sign-off received).
- Legacy data profiling complete: 412,000 customer records and 38,000 policies.
- Identified roughly 6% duplicate customer records in the legacy CRM during profiling.
- Drafted the cutover runbook (v0.3) for review at the next steering committee.

## Planned next period (Week 10)

- Build and test the deterministic de-duplication pass against the 0.5% validation gate.
- Escalate the policy-rating API contract to vendor account management.
- Prepare the stub-based integration fallback so internal testing is not blocked.

## Risks and blockers

- Risk M-01 (Data quality) escalated to High/High — duplicate records threaten the
  migration validation gate.
- Risk M-02 (Integration dependency) escalated — the Acme Ratings Ltd API contract is
  still unsigned, putting the Week 13 integration test entry at risk.

## Decisions needed

- Steering committee approval is requested for a dedicated allocation of the two senior
  engineers currently shared with the Billing programme (see Risk M-03), and for the
  stub-based integration fallback budget (see Risk M-02).
"""


# ---------------------------------------------------------------------------
# Doc 4 — Sprint / task log (task status, planned next, milestones + metrics)
# ---------------------------------------------------------------------------
SPRINT_TASK_LOG = """# Project Meridian — Sprint and Task Log (Sprint 5, Week 9)

- **Project**: Project Meridian
- **Sprint**: 5 (covers Weeks 8-9)
- **Compiled by**: Dana Whitfield, Project Manager

## Task status

| Task | Owner | Status |
|------|-------|--------|
| Cloud landing zone provisioning | Platform team | Done |
| Security hardening and sign-off | Sade Okafor | Done |
| Legacy data profiling | Priya Nair | Done |
| De-duplication pass build | Priya Nair | In progress |
| Policy-rating API stub | Tom Becker | In progress |
| Cutover runbook draft | Dana Whitfield | In progress (v0.3) |

## Planned next

- Complete the de-duplication pass and run it against the 0.5% validation gate.
- Finish the policy-rating API stub and begin internal integration testing.

## Key milestones and metrics

- Week 11 — Data migration dress rehearsal (dependent on de-duplication completion).
- Week 13 — Integration test entry for the policy-rating API.
- Week 18 — User Acceptance Testing begins.
- Week 24 — Production cutover and legacy decommission.

Metrics this sprint: 412,000 customer records profiled; 38,000 policies profiled;
~6% duplicate customer records detected; de-duplication target threshold 0.5%.
"""


# ---------------------------------------------------------------------------
# Doc 5 — Risk log (7 risks, each with worded probability + impact + owner + mitigation)
# ---------------------------------------------------------------------------
RISK_LOG = """# Project Meridian — Risk Log (Risk Review #4, Week 9)

- **Project**: Project Meridian
- **Session**: Fortnightly Risk Review #4
- **Facilitator**: Dana Whitfield, Project Manager

Each risk below records id, description, category, worded probability (High/Medium/Low),
worded impact (High/Medium/Low), owner, mitigation and status.

## Risk M-01 — Data quality
- Description: The legacy CRM contains roughly 6% duplicate and partially merged
  customer records, found during profiling.
- Category: Data
- Probability: High
- Impact: High
- Owner: Priya Nair (Data Lead)
- Mitigation: A deterministic de-duplication pass plus a hard validation gate that blocks
  migration if the duplicate rate exceeds 0.5%.
- Status: In progress

## Risk M-02 — Integration dependency
- Description: The contract for the third-party policy-rating API with Acme Ratings Ltd
  has not been finalised by the vendor.
- Category: Vendor
- Probability: Medium
- Impact: High
- Owner: Tom Becker (Integration Lead)
- Mitigation: Escalate to vendor account management and prepare a stub-based fallback so
  internal testing is not blocked.
- Status: Open

## Risk M-03 — Resourcing
- Description: Two senior engineers are shared 50/50 with the parallel Billing programme,
  reducing migration throughput.
- Category: Resource
- Probability: Medium
- Impact: Medium
- Owner: Dana Whitfield (Project Manager)
- Mitigation: A dedicated-allocation request has been submitted to the resourcing board.
- Status: Mitigating

## Risk M-04 — Security and compliance (GDPR)
- Description: Production PII is copied into lower test environments for realistic UAT.
- Category: Compliance
- Probability: Medium
- Impact: High
- Owner: Sade Okafor (Security Lead)
- Mitigation: Anonymise or pseudonymise all PII before it leaves the production
  environment.
- Status: Open

## Risk M-05 — Cutover and rollback
- Description: The Week-24 production cutover has a narrow weekend window and no rehearsed
  rollback.
- Category: Delivery
- Probability: Low
- Impact: High
- Owner: Tom Becker (Integration Lead)
- Mitigation: Add a Week-22 rollback rehearsal and a go/no-go checkpoint.
- Status: Open

## Risk M-06 — User adoption and training
- Description: Front-line agents have had no exposure to the new platform UI.
- Category: Change
- Probability: Medium
- Impact: Medium
- Owner: Rita Lindqvist (Change Lead)
- Mitigation: Phased training from Week 16 plus floor-walker support at go-live.
- Status: Not started

## Risk M-07 — Budget and scope
- Description: Stakeholders are requesting additional custom reports beyond the agreed
  scope.
- Category: Scope
- Probability: Medium
- Impact: Medium
- Owner: Dana Whitfield (Project Manager)
- Mitigation: Route all new requests through formal change control.
- Status: Mitigating
"""


# 104-03 live-UAT fix: encode the actual reporting week in the FILENAME (not the
# ambiguous "w1"/"w2") — the publish judge cites by filename and read "w2" as "Week 2",
# flagging a false period mismatch against a Week-9 report. "week8"/"week9" are
# unambiguous and match each doc's "Week N of 24" header.
DOCS = {
    "project-charter-source.md": PROJECT_CHARTER_SOURCE,
    "weekly-meeting-notes-week8.md": WEEKLY_MEETING_NOTES_W1,
    "weekly-meeting-notes-week9.md": WEEKLY_MEETING_NOTES_W2,
    "sprint-task-log.md": SPRINT_TASK_LOG,
    "risk-log.md": RISK_LOG,
}


def build() -> list[Path]:
    OUT.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for name, body in DOCS.items():
        path = OUT / name
        path.write_text(body, encoding="utf-8")
        written.append(path)
    return written


if __name__ == "__main__":
    made = build()
    print(f"wrote {len(made)} markdown corpus docs to {OUT}:")
    for p in made:
        words = len(p.read_text(encoding="utf-8").split())
        print(f"  - {p.name}  ({words} words)")
