# Project Meridian — Weekly Meeting Notes (Week 9 of 24)

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
