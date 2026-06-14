# Project Meridian — Project Charter (Source Excerpt)

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
