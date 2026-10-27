"""Phase 292.1 SC#2 (F7) — the MEASURED harmony-style text tool calls, verbatim.

Measured 2026-10-24 on the local DB (forced-pending board, 292.1 VALIDATION §6): an
``openai / gpt-5.6-luna`` run reached the forced-final round, where the request carries NO tools,
and wrote its pending call(s) as plain text in the harmony response format with the special tokens
decoded away. Each constant is the full ``messages.content`` the run saved and served on reload,
copied by script from the row (round-trip checked), never retyped:

* ``H1_ed030690`` — run ed030690 / msg 41bc33f5: a stuttered recipient
  (``to=functions.X code to=functions.X  (json)``) and one recipient with NO namespace
  (``to=search_documents``), then trailing prose.
* ``H2_2b7c16a0`` — run 2b7c16a0 / msg b43547aa: garbage content-type tokens
  (``code_WORDRY <Georgian>-vesm``), ten calls, then garbage + a real answer.
* ``H3_f1c46597`` — run f1c46597 / msg 96d311f3: ``(analysis code)`` / ``(commentary)`` headers
  and a comma between two calls; fifteen calls, nothing after them.
* ``H4_34748d7c`` — main board run 34748d7c / msg 5fb71dfa: one call, then ``jing\\xef``.

Grammar (harmony docs/format.md §"Receiving tool calls"):
``<|start|>assistant<|channel|>commentary to=functions.NAME <|constrain|>json<|message|>{...}<|call|>``
— the recipient may also sit in the role section. Imported by the 292.1 tests, never collected.
"""
from __future__ import annotations

H1_ed030690 = (
    ' to=functions.search_documents code \u0431\u0438\u043b\u0434\u04af\u0440\u0434\u0438json\n'
    '{"query":"milestones phased roadmap Phase 0 Preparation Authorization Days 1-10 Phas'
    'e 1"}\n'
    ' to=functions.search_documents code'
    ' to=functions.search_documents  (json) \n'
    '{"query":"milestones phased roadmap Phase 0 Preparation Authorization Days 1-10 Phas'
    'e 1"}'
    ' to=functions.search_documents code'
    ' to=functions.search_documents  code:\n'
    '{"query":"milestones phased roadmap Phase 0 Preparation Authorization Days 1-10 Phas'
    'e 1"}'
    ' to=functions.search_documents  (json) code:\n'
    '{"query":"milestones phased roadmap Phase 0 Preparation Authorization Days 1-10 Phas'
    'e 1"}'
    ' to=functions.search_documents code:\n'
    '{"query":"milestones phased roadmap Phase 0 Preparation Authorization Days 1-10 Phas'
    'e 1"}'
    ' to=functions.search_documents  code:\n'
    '{"query":"milestones phased roadmap Phase 0 Preparation Authorization Days 1-10 Phas'
    'e 1"}'
    ' to=functions.search_documents code:\n'
    '{"query":"milestones phased roadmap Phase 0 Preparation Authorization Days 1-10 Phas'
    'e 1"}'
    ' to=functions.search_documents code:\n'
    '{"query":"milestones"}'
    ' to=functions.search_documents code:\n'
    '{"query":"milestones named in project plan"}'
    ' to=functions.search_documents\n'
    '{"query":"milestones named in project plan"}'
    ' to=search_documents code:\n'
    '{"query":"milestones named in project plan"}'
    ' to=functions.search_documents code:\n'
    '{"query":"milestones"}'
    ' to=functions.execute_code code:\n'
    '{"description":"Compute milestone counts per quarter","code":"print({})","libraries"'
    ':[]}I\u2019m unable to complete the requested tool-call sequence because the document too'
    'ls stopped responding after the first call.'
)

H2_2b7c16a0 = (
    ' to=functions.search_documents code_WORDRY \u10d0\u10da\u10d8\u10e1-vesm\n'
    '{"query":"milestones"}'
    ' to=functions.search_documents code_WORDRY \u4ee3\n'
    '{"query":"owners"}'
    ' to=functions.search_documents code_WORDRY \u4ee3\n'
    '{"query":"risks"}'
    ' to=functions.search_documents code_WORDRY \u4ee3\n'
    '{"query":"milestones"}'
    ' to=functions.search_documents code_WORDRY \u4ee3\n'
    '{"query":"Phase 0 Preparation and Authorization milestone Days 1-10 PMO"}\n'
    ' to=functions.search_documents code_WORDRY \u4ee3\n'
    '{"query":"Phase 1 Foundation and Design milestone PMO governance"}\n'
    ' to=functions.search_documents code_WORDRY \u4ee3\n'
    '{"query":"Phase 2 Pilot and Early Implementation milestone PMO governance"}\n'
    ' to=functions.search_documents code_WORDRY \u4ee3\n'
    '{"query":"Phase 3 Full Implementation milestone PMO governance"}\n'
    ' to=functions.execute_code code_WORDRY \u4ee3\n'
    '{"description":"Counting milestones per quarter","code":"from collections import Cou'
    "nter\\nmilestones = [\\n    ('Phase 0: Preparation & Authorization', 'Q1'),\\n    ('Pha"
    "se 1: Foundation & Design', 'Q1'),\\n    ('Phase 2: Pilot & Early Implementation', 'Q"
    "1'),\\n    ('Phase 3: Full Implementation', 'Q2'),\\n]\\ncounts = Counter(q for _, q in"
    ' milestones)\\nprint(dict(sorted(counts.items())))"}'
    ' to=functions.execute_code code_WORDRY \u4ee3\n'
    '{"description":"Drawing milestone count bar chart","code":"import os\\nfrom collectio'
    "ns import Counter\\nimport matplotlib.pyplot as plt\\n\\nmilestones = [\\n    ('Phase 0:"
    " Preparation & Authorization', 'Q1'),\\n    ('Phase 1: Foundation & Design', 'Q1'),\\n"
    "    ('Phase 2: Pilot & Early Implementation', 'Q1'),\\n    ('Phase 3: Full Implementa"
    "tion', 'Q2'),\\n]\\nquarters = ['Q1', 'Q2']\\ncounts = Counter(q for _, q in milestones"
    ")\\nvalues = [counts[q] for q in quarters]\\n\\nos.makedirs('/sandbox/output', exist_ok"
    "=True)\\nplt.figure(figsize=(6, 4))\\nplt.bar(quarters, values, color=['#2F75B5', '#70"
    "AD47'])\\nplt.title('Milestones per Quarter')\\nplt.xlabel('Quarter')\\nplt.ylabel('Mil"
    "estone count')\\nplt.ylim(0, max(values) + 1)\\nfor i, v in enumerate(values):\\n    pl"
    "t.text(i, v + 0.05, str(v), ha='center')\\nplt.tight_layout()\\nout = '/sandbox/output"
    '/milestones_per_quarter.png\'\\nplt.savefig(out, dpi=160)\\nprint(out)"}amen\u9c81\u591c\u591c\u556a\n'
    '\n'
    '## Milestones per quarter\n'
    '\n'
    'Based on the PMO implementation roadmap\u2019s four phased milestones [4]:\n'
    '\n'
    '| Quarter | Milestones |\n'
    '|---|---:|\n'
    '| Q1 | 3 |\n'
    '| Q2 | 1 |\n'
    '\n'
    '- **Q1:** Preparation & Authorization; Foundation & Design; Pilot & Early Implementa'
    'tion  \n'
    '- **Q2:** Full Implementation  \n'
    '\n'
    'The bar chart has been created as `milestones_per_quarter.png`.'
)

H3_f1c46597 = (
    ' to=functions.search_documents  code\n'
    '{"query":"milestones Phase 0 Preparation Authorization Executive Proposal PMO Govern'
    'ance"}'
    ' to=functions.search_documents  code\n'
    '{"query":"milestones Phase 0 Preparation Authorization Executive Proposal PMO Govern'
    'ance"}'
    ' to=functions.search_documents  (analysis code)\n'
    '{"query":"milestones Phase 0 Preparation Authorization Executive Proposal PMO Govern'
    'ance"},'
    ' to=functions.search_documents  code\n'
    '{"query":"milestones Phase 0 Preparation Authorization Executive Proposal PMO Govern'
    'ance"}'
    ' to=functions.search_documents  code\n'
    '{"query":"milestones"}'
    ' to=functions.search_documents  code\n'
    '{"query":"milestones"}'
    ' to=functions.search_documents  code\n'
    '{"query":"milestones"}'
    ' to=functions.search_documents  code\n'
    '{"query":"milestones named in project plan"}'
    ' to=functions.search_documents  (commentary)\n'
    '{"query":"milestones"}'
    ' to=functions.search_documents  code\n'
    '{"query":"milestones"}'
    ' to=functions.execute_code  code\n'
    '{"description":"Computing milestone counts per quarter","code":"from collections imp'
    'ort Counter\\nmilestones = []\\ncounts = Counter()\\nfor m in milestones:\\n    counts[m'
    '.get(\'quarter\')] += 1\\nprint(dict(counts))","output_files":[],"libraries":[]}'
    ' to=functions.search_documents  code\n'
    '{"query":"owners of milestones"}'
    ' to=functions.search_documents  code\n'
    '{"query":"risks attached to milestones"}'
    ' to=functions.execute_code  code\n'
    '{"description":"Computing milestone counts per quarter","code":"from collections imp'
    'ort Counter\\nmilestones = []\\ncounts = Counter()\\nfor item in milestones:\\n    count'
    's[item[\'quarter\']] += 1\\nprint(dict(counts))","output_files":[],"libraries":[]}'
    ' to=functions.execute_code  code\n'
    '{"description":"Drawing milestone counts by quarter","code":"import matplotlib.pyplo'
    't as plt\\ncounts = {}\\nquarters = list(counts.keys())\\nvalues = list(counts.values()'
    ")\\nplt.figure(figsize=(8,5))\\nplt.bar(quarters, values)\\nplt.xlabel('Quarter')\\nplt."
    "ylabel('Number of milestones')\\nplt.title('Milestones per Quarter')\\nplt.tight_layou"
    "t()\\nplt.savefig('/sandbox/output/milestones_per_quarter.png')\\nprint('Saved /sandbo"
    'x/output/milestones_per_quarter.png\')","output_files":["/sandbox/output/milestones_p'
    'er_quarter.png"],"libraries":["matplotlib"]}'
)

H4_34748d7c = (
    ' to=functions.search_documents  code:\n'
    '{"query":"project plan"} jing\xef'
)
