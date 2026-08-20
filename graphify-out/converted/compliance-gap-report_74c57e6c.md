<!-- converted from compliance-gap-report.docx -->

Compliance Gap Report
Report Title: {{ report_title.value }}
Report Date: {{ report_date.value }}
Scope: {{ scope.value }}

| Requirement | Source Clause | Current State | Gap | Severity | Owner |
| --- | --- | --- | --- | --- | --- |
| {%tr for r in rows %} |  |  |  |  |  |
| {{ r.requirement.value }} | {{ r.source_clause.value }} | {{ r.current_state.value }} | {{ r.gap.value }} | {{ r.severity.value }} | {{ r.owner.value }} |
| {%tr endfor %} |  |  |  |  |  |