---
title: Checks that must pass
slug: automate/workflows/checks
section: automate
audience: user
status: stub
release: shipped
covers: [C8, C9, C10, C11, C12, C13, C14, C15, C16, C17, check:citations_required, check:output_file_valid, check:structure_check, check:llm_judge_rubric, check:freshness, check:action_risk_approval, check:json_schema, check:regex_match, check:workspace_file_exists, check:programmatic]
summary: >-
  Ten checks a step can require: JSON schema, a pattern match, a file that must exist, a server
  check, citations, a valid output file, structure, a judge rubric, freshness and an approval
  checkpoint for risky actions. A failing check leads to a bounded retry, another step or a failed
  run. Until the full guide is written, start with What a workflow is.
nearest: automate/workflows/overview
---
