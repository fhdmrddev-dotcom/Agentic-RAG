<!-- converted from Project-Meridian-Risk-Workshop-Notes.docx -->

Project Meridian — Risk Workshop Notes
Session: Fortnightly Risk Review #4
Date: Week 9, Thursday
Facilitator: Dana Whitfield (PM)
Attendees: P. Nair (Data), T. Becker (Integration), S. Okafor (Security), R. Lindqvist (Change), M. Alvarez (Sponsor delegate)
The team reviewed the open risk register and identified new risks. Each entry below records cause, event, effect, likelihood, impact, owner and the proposed response strategy (avoid / reduce / transfer / accept).

Action: M-05 rollback rehearsal to be added to the plan; M-04 anonymisation approach to be confirmed with the Data Protection Officer before Week 12.
| Risk ID | Category | Cause | Event | Effect | Likelihood | Impact | Owner | Response strategy | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| M-01 | Data quality | Legacy CRM contains ~6% duplicate/merged customer records (carried from Week 8). | Duplicate or corrupted records are migrated into the cloud platform. | Mis-routed correspondence, compliance exposure, rework. | High | High | Priya Nair (Data Lead) | Reduce — dedup pass + a hard validation gate at 0.5% duplicate threshold. | In progress |
| M-02 | Integration dependency | Policy-rating API contract with Acme Ratings Ltd not finalised. | Integration test entry (Week 13) cannot begin on schedule. | UAT start slips; downstream cutover date at risk. | Medium | High | Tom Becker (Integration Lead) | Reduce — vendor escalation + stub-based fallback for internal testing. | Open |
| M-04 | Security / compliance (GDPR) | Production PII is copied into lower test environments for realistic UAT. | A data breach or unauthorised access in a less-controlled environment. | Regulatory fine, reputational damage, mandatory breach notification. | Medium | High | Sade Okafor (Security Lead) | Reduce — anonymise/pseudonymise all PII before it leaves production. | Open |
| M-05 | Cutover / rollback | The Week-24 production cutover has a narrow weekend window and no rehearsed rollback. | Cutover fails partway and the team cannot cleanly revert to legacy. | Extended outage of customer-facing CRM during business hours. | Low | High | Tom Becker (Integration Lead) | Reduce — add a Week-22 rollback rehearsal and a go/no-go checkpoint. | Open |
| M-06 | User adoption / training | Front-line agents have had no exposure to the new platform UI. | Agents struggle at go-live and revert to manual workarounds. | Productivity dip, data captured outside the system, support load spike. | Medium | Medium | Rita Lindqvist (Change Lead) | Reduce — phased training from Week 16 plus floor-walker support at go-live. | Not started |
| M-07 | Budget / scope | Stakeholders are requesting additional custom reports beyond the agreed scope. | Uncontrolled scope creep consumes contingency budget. | Budget overrun and distraction from critical-path migration work. | Medium | Medium | Dana Whitfield (PM) | Reduce — route all new requests through formal change control. | Mitigating |