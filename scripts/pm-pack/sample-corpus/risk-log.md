# Project Meridian — Risk Log (Risk Review #4, Week 9)

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
