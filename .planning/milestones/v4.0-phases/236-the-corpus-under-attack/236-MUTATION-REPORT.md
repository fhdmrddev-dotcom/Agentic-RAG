# Phase 236: The Corpus Under Attack — Mutation Report (SC#2)

> **Requirement SC#2**: *The GA Gate — removing any of the 8 named defenses causes the test suite to fail loudly and name the missing defense.*
> Ratified by Operator Ruling on BUS-163 (pytest runtime monkeypatch fixture `--disable-defense=<name>`).

**Mutations Tested:** 8
**Mutations Caught Loudly:** 8 / 8
**Audit Status:** PASS (100% caught)

## Mutation Results Matrix

| Defense ID | Target Module | Mutation Mechanism | Test Outcome | Failure Caught |
|------------|---------------|-------------------|:------------:|----------------|
| `tool_dispatcher_trifecta` | `backend/app/services/tool_dispatcher.py` | Disabled via monkeypatch | 🛡️ CAUGHT (RED) | `test_llm01_indirect_01_tool_dispatcher_email_hijack` |
| `chat_tools_envelope` | `backend/app/services/connectors/chat_tools.py` | Disabled via monkeypatch | 🛡️ CAUGHT (RED) | `test_llm01_delim_01_chat_tools_isolation_envelope` |
| `service_tools_param_fence` | `backend/app/services/connectors/service_tools.py` | Disabled via monkeypatch | 🛡️ CAUGHT (RED) | `test_llm01_param_injection_refused` |
| `embedding_metadata_prompt` | `backend/app/services/embedding_service.py` | Disabled via monkeypatch | 🛡️ CAUGHT (RED) | `test_llm01_meta_extraction_prompt_boundary` |
| `eval_runner_evidence_prompt` | `backend/app/services/eval_runner_service.py` | Disabled via monkeypatch | 🛡️ CAUGHT (RED) | `test_llm01_judge_rubric_and_cap` |
| `phase_types_grounding_tag` | `backend/app/services/harness/phase_types.py` | Disabled via monkeypatch | 🛡️ CAUGHT (RED) | `test_llm01_ground_citation_spoofing` |
| `validator_kinds_grounded` | `backend/app/services/harness/validator_kinds.py` | Disabled via monkeypatch | 🛡️ CAUGHT (RED) | `test_llm01_valid_hallucination_refused` |
| `skill_proposer_evidence` | `backend/app/services/skill_proposer_service.py` | Disabled via monkeypatch | 🛡️ CAUGHT (RED) | `test_llm01_skill_proposer_evidence_isolation` |
## Invariants Verified
1. **Zero Kill-Switches in Production**: No runtime bypass env vars (`AGENTIC_DISABLE_DEFENSE`) or flags exist in production code.
2. **Strict Target Existence Fence**: `conftest.py` asserts that the patch target symbol exists on the target module before monkeypatching, preventing silent no-ops if symbols are renamed.
3. **Clean Tree Preservation**: Mutation drive uses in-process runtime fixtures, leaving the working tree byte-identical before, during, and after runs.

**SC#2 MUTATION AUDIT: PASS (8/8 mutations caught loudly)**
