> SAMPLE DATA: ACME Corporation is a fictional company and this policy is invented. For demonstration only.

# ACME Corporation - Security Incident Response Policy 2026

## Purpose and Scope

This policy defines how ACME Corporation detects, classifies, contains, and recovers from information security incidents affecting company systems, customer data, or manufacturing operations. It applies to all employees, contractors, and managed service providers with access to ACME systems.

## Severity Levels

| Severity | Definition | Initial response time |
| :--- | :--- | :--- |
| SEV-1 Critical | Confirmed compromise of customer data or a full outage of a production system | 15 minutes, 24x7 |
| SEV-2 High | Suspected compromise, or degraded service affecting many customers | 1 hour, 24x7 |
| SEV-3 Medium | Contained malware, policy violation, or a single affected workstation | 1 business day |
| SEV-4 Low | Suspicious activity with no confirmed impact | 3 business days |

## Notification Obligations

| Obligation | Deadline |
| :--- | :--- |
| Escalate a SEV-1 or SEV-2 to the Chief Information Security Officer | within 30 minutes of classification |
| Notify the executive leadership team of a SEV-1 | within 2 hours of classification |
| Notify affected customers after a confirmed incident | within 36 hours |
| Notify the lead data protection authority where personal data is affected | within 72 hours of awareness |
| Publish an internal post-incident review | within 10 business days of closure |

The customer notification deadline runs from the moment the incident is confirmed by the incident commander, not from first detection. Where a law or contract sets a shorter deadline, the shorter deadline applies.

## Recovery Objectives

| System tier | Recovery time objective (RTO) | Recovery point objective (RPO) |
| :--- | :--- | :--- |
| Tier A - order management and ERP | 6 hours | 15 minutes |
| Tier B - customer portal and support tooling | 16 hours | 2 hours |
| Tier C - internal collaboration tools | 48 hours | 24 hours |

Recovery objectives are tested twice a year through a documented failover exercise. Results are reported to the Audit Committee.

## Roles

The incident commander owns the response from classification to closure, decides on containment actions, and confirms when an incident is real. The communications lead drafts all customer, regulator, and employee notices and obtains Legal approval before release. The forensics lead preserves evidence, maintains the chain of custody, and determines root cause. The business liaison represents the affected department and approves any service interruption needed for containment.

## Evidence and Records

All incident tickets, timelines, and evidence are retained for seven years. Evidence is stored in a restricted repository with write-once retention and is accessible only to the incident response team and Legal.
