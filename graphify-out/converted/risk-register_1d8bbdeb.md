<!-- converted from risk-register.docx -->

Risk Register
Project: {{ project_name.value }}
Reporting Period: {{ reporting_period.value }}

| Risk ID | Description | Category | Probability | Impact | Score | Owner | Mitigation | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| {%tr for r in rows %} |  |  |  |  |  |  |  |  |
| {{ r.id.value }} | {{ r.description.value }} | {{ r.category.value }} | {{ r.probability.value }} | {{ r.impact.value }} | {{ ({'low':1,'medium':2,'med':2,'high':3}.get((r.probability.value or '')|trim|lower, 0)) * ({'low':1,'medium':2,'med':2,'high':3}.get((r.impact.value or '')|trim|lower, 0)) }} | {{ r.owner.value }} | {{ r.mitigation.value }} | {{ r.status.value }} |
| {%tr endfor %} |  |  |  |  |  |  |  |  |