> SAMPLE DATA: ACME Corporation is a fictional company and these test results are invented. For demonstration only.

# ACME Corporation - Internal Control Test Results, Q3 2026

## Summary

| Measure | Result |
| :--- | :--- |
| Testing period | 2026-07-01 to 2026-09-30 |
| Controls in scope | 16 |
| Controls passed | 14 of 16 |
| Controls failed | 2 |
| Tested by | Internal Audit, IT Assurance team |
| Framework mapping | ISO/IEC 27001:2022 Annex A |

## Per-Control Results

| Control ID | Control | Result | Remediation owner | Due date |
| :--- | :--- | :--- | :--- | :--- |
| AC-01 | User access provisioned only with an approved ticket | Passed | - | - |
| AC-02 | Quarterly access review of privileged accounts | Failed | Director of IT Operations | 2026-11-14 |
| AC-03 | Multi-factor authentication on all remote access | Passed | - | - |
| AC-04 | Leaver accounts disabled within one business day | Passed | - | - |
| CM-01 | Production changes approved by a change board | Passed | - | - |
| CM-02 | Emergency changes reviewed retrospectively | Passed | - | - |
| BK-01 | Daily backups of Tier A systems completed | Passed | - | - |
| BK-02 | Quarterly restore test of Tier A backups | Passed | - | - |
| VM-01 | Critical vulnerabilities patched within 14 days | Failed | Head of Infrastructure Security | 2026-10-31 |
| VM-02 | External penetration test performed annually | Passed | - | - |
| LG-01 | Security logs retained and monitored centrally | Passed | - | - |
| LG-02 | Alerts triaged by the security operations centre | Passed | - | - |
| VN-01 | Vendor security assessment before onboarding | Passed | - | - |
| EN-01 | Laptop disk encryption enforced | Passed | - | - |
| TR-01 | Annual security awareness training completed | Passed | - | - |
| IR-01 | Incident response plan tested in a tabletop exercise | Passed | - | - |

## Findings

**AC-02 (failed).** The quarterly review of privileged accounts was not completed for the ERP database administrators group. Eleven privileged accounts were not reviewed within the quarter. Remediation: complete the outstanding review and add an automated reminder to the identity governance tool.

**VM-01 (failed).** Four critical vulnerabilities on manufacturing-floor workstations remained unpatched beyond 14 days because the patch window conflicted with a production run. Remediation: agree a standing monthly maintenance window with Manufacturing and add compensating network segmentation until patched.

## Next Testing Cycle

All 16 controls will be retested in Q4 2026. The two failed controls will receive an additional mid-quarter check.
