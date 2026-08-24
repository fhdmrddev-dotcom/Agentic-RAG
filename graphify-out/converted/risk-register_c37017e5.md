<!-- converted from risk-register.docx -->

# Risk Register
Project: {{ project_name.value }}
Date: {{ report_date.value }}

| Risk ID | Cause | Event | Effect | P | I | Score | Response | Owner | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| {%tr for r in rows %} |  |  |  |  |  |  |  |  |  |
| {{ r.risk_id.value }} | {{ r.cause.value }} | {{ r.event.value }} | {{ r.effect.value }} | {{ r.probability.value }} | {{ r.impact.value }} | {{ r.score }} | {{ r.response_strategy.value }} | {{ r.owner.value }} | {{ r.status.value }} |
| {%tr endfor %} |  |  |  |  |  |  |  |  |  |