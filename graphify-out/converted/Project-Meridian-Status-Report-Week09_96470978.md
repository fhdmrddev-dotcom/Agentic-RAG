<!-- converted from Project-Meridian-Status-Report-Week09.docx -->

Project Meridian — Weekly Status Report
Project: Meridian (Legacy CRM → Cloud Platform Migration)
Reporting period: Week 9 of 24
Prepared by: Dana Whitfield, Project Manager
Overall RAG status: AMBER
# 1. Executive Summary
Project Meridian is migrating Brightline Insurance's on-premise legacy CRM to a cloud-hosted platform over a 24-week programme. We are at the end of Week 9. Foundation infrastructure is provisioned and the data-profiling pass is complete, but two risks have escalated this week and the programme RAG status has moved from Green to Amber. The critical path now runs through the data-migration validation gate and the third-party policy-rating API integration.
# 2. Progress This Week
- Cloud landing zone provisioned and security-hardened (sign-off received).
- Legacy data profiling complete: 412,000 customer records, 38,000 policies.
- Identified ~6% duplicate customer records in the legacy CRM during profiling.
- Drafted the cutover runbook (v0.3) for review at the next steering committee.
# 3. Upcoming Milestones
- Week 11 — Data migration dress rehearsal (dependent on dedup completion).
- Week 13 — Integration test entry for the policy-rating API.
- Week 18 — User Acceptance Testing begins.
- Week 24 — Production cutover and legacy decommission.
# 4. Key Risks and Issues
Risk M-01 (Data quality). Profiling found roughly 6% duplicate and partially merged customer records in the legacy CRM. If these are migrated as-is, the event is corrupted or duplicated customer records in the new platform, with the effect of mis-routed policy correspondence and a loss of customer trust. Likelihood is assessed High and impact High. Owner: Priya Nair (Data Lead). Mitigation: a deterministic de-duplication pass plus a validation gate that blocks migration if the duplicate rate exceeds 0.5%. Status: in progress.
Risk M-02 (Integration dependency). The contract for the third-party policy-rating API has not been finalised by the vendor, Acme Ratings Ltd. The event is that integration testing in Week 13 cannot start on time; the effect is a direct slip to the UAT entry date. Likelihood Medium, impact High. Owner: Tom Becker (Integration Lead). Mitigation: escalate to vendor account management and prepare a stub-based fallback so internal testing is not blocked. Status: open and escalating.
Risk M-03 (Resourcing). Two senior engineers are currently shared 50/50 with the parallel Billing programme. The cause is an unresolved allocation conflict; the event is reduced migration throughput; the effect is a potential two-week schedule slip. Likelihood Medium, impact Medium. Owner: Dana Whitfield (PM). Mitigation: a dedicated-allocation request has been submitted to the resourcing board. Status: mitigating.
# 5. Decisions Needed
Steering committee approval is requested for the dedicated allocation of the two senior engineers (see Risk M-03) and for the stub-based integration fallback budget (see Risk M-02).