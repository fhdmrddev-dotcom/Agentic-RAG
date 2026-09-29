"""269 — text-shape fence for the starter Expert seed SQL (PACK-26, D-269-06/07, D-269-P2).

Today it pins ``.planning/phases/269-starter-expert-library/269-candidate-bundles.sql`` — the
STAGING artifact (RESEARCH Pattern 2) that holds the four starter bundle rows and the Financial
Analyzer copy fix in the exact statement shape migration 198 will use. 269-04 promotes only the
rows proven live, VERBATIM, into ``supabase/migrations/198_*.sql`` and applies
``assert_starter_seed_shape`` to that file too, so the same checks guard both.

What is pinned (TEXT only — the applied rows are measured after the operator's paste):

* the body is four single-row ``INSERT INTO public.expert_bundles`` statements plus one
  Financial Analyzer ``UPDATE`` — no GRANT / CREATE / ALTER / DROP / DELETE / TRUNCATE / DO block
  (T-269-06: data only, nothing that can widen a privilege);
* every row is org-portable (``org_id NULL``, sentinel author) and no UUID literal outside the
  declared set appears anywhere in the file (T-269-05, the mig 188/193 lesson);
* every row is a plain Install card: restricted, no member skills, no required connections, no
  folder ids, public, enabled, a closed-map icon (D-269-06);
* ``prompt_suggestions`` parse as 2-3 ``{title, prompt}`` objects; Pydantic length ceilings hold;
* ``example_output`` cites ONLY the Starter Contract figures for its row (T-269-08 / M-10), and
  the Financial Analyzer's uncitable ``24.3%`` / ``$412M`` / quarter-over-quarter copy is gone.

The cross-check against the corpus BYTES is 269-04's (the corpora are authored in 269-01).
"""

from __future__ import annotations

import json
import re
from pathlib import Path

from tests.unit.test_269_no_expert_specific_code import (
    MIGRATIONS,
    PLANNING,
    REPO_ROOT,
    SENTINEL_AUTHOR,
    eval_text,
    parse_insert,
    parse_update,
    split_sql,
)

STARTER_IDS = {
    "contract-reviewer": "00000000-0000-0000-0000-000000002691",
    "hr-policy-advisor": "00000000-0000-0000-0000-000000002692",
    "security-compliance": "00000000-0000-0000-0000-000000002693",
    "operations-analyst": "00000000-0000-0000-0000-000000002694",
}
FINANCIAL_ANALYZER_ID = "00000000-0000-0000-0000-000000000259"
ALLOWED_UUIDS = set(STARTER_IDS.values()) | {FINANCIAL_ANALYZER_ID, SENTINEL_AUTHOR}

# frontend/src/components/experts/expertIcon.tsx — the CLOSED map; an unknown key renders Sparkles.
ICON_KEYS = {
    "chart", "scale", "shield", "briefcase", "truck", "terminal",
    "cpu", "database", "book", "file-text", "sparkles",
}

# Starter Contract — the ONLY figures each row's example_output may cite (M-10).
MAY_CITE = {
    "contract-reviewer": ["$2.35M", "75 days"],
    "hr-policy-advisor": ["18 weeks", "23 days"],
    "security-compliance": ["36 hours", "14 of 16"],
    "operations-analyst": ["94.7%", "38 days"],
    "financial-analyzer": ["30.8%", "+380 bps", "$29.1M", "~42%"],
}

UPSERT_SET_COLUMNS = [
    "name", "description", "scope_mode", "prompt_suggestions", "visibility",
    "is_enabled", "icon", "category", "when_to_use", "example_output",
]
CEILINGS = {"name": 120, "slug": 120, "category": 64, "when_to_use": 500, "example_output": 4000, "description": 8000}
TEXT_COLUMNS = ["name", "slug", "description", "category", "when_to_use", "example_output", "prompt_suggestions"]

_FIGURE = re.compile(r"(?<![\w-])[~+]?\$?\d[\d,]*(?:\.\d+)?(?:%|M\b)?")
_UUID_ANY = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")


def candidate_sql() -> Path:
    matches = sorted(PLANNING.rglob("269-candidate-bundles.sql"))
    assert len(matches) == 1, [str(m) for m in matches]
    return matches[0]


def _figures(text: str) -> set[str]:
    return set(_FIGURE.findall(text))


def _suggestions(expr: str) -> list[dict]:
    raw = eval_text(expr)
    assert raw is not None, f"prompt_suggestions is not a literal: {expr[:120]}"
    data = json.loads(raw)
    assert isinstance(data, list) and 2 <= len(data) <= 3, data
    for item in data:
        assert isinstance(item, dict) and set(item) == {"title", "prompt"}, item
        assert item["title"].strip() and item["prompt"].strip(), item
    return data


def _check_literal_hygiene(col: str, text: str) -> None:
    # Pitfall 6: a `--` or `;` inside a literal breaks naive comment-stripping / statement splitting.
    assert "--" not in text, f"{col} carries '--' inside a string literal"
    assert ";" not in text, f"{col} carries ';' inside a string literal"


def _check_example_output(slug: str, text: str) -> None:
    allowed_phrases = MAY_CITE[slug]
    allowed = set().union(*(_figures(p) for p in allowed_phrases))
    stray = _figures(text) - allowed
    assert not stray, f"{slug} example_output cites figures outside the Starter Contract: {sorted(stray)}"
    for phrase in allowed_phrases:
        assert phrase in text, f"{slug} example_output does not cite {phrase!r}"


def _fa_187_suggestions() -> list[dict]:
    for stmt in split_sql((MIGRATIONS / "187_expert_bundles.sql").read_text(encoding="utf-8")):
        row = parse_insert(stmt)
        if row is not None and eval_text(row["slug"]) == "financial-analyzer":
            return json.loads(eval_text(row["prompt_suggestions"]))
    raise AssertionError("financial-analyzer INSERT not found in migration 187")


def assert_starter_seed_shape(path: Path, expected_insert_ids: set[str]) -> None:
    """Every shape rule for the starter seed. Reused by 269-04 on migration 198."""
    text = path.read_text(encoding="utf-8")
    stmts = split_sql(text)
    body = [s for s in stmts if s.upper() not in ("BEGIN", "COMMIT")]

    # --- only data statements, nothing else ---------------------------------------------------
    for s in body:
        assert s.startswith("INSERT INTO public.expert_bundles (") or s.startswith(
            "UPDATE public.expert_bundles SET "
        ), f"non-seed statement in {path.name}: {s[:160]}"
        assert not re.search(r"\b(GRANT|CREATE|ALTER|DROP|DELETE|TRUNCATE)\b", s, flags=re.I) or _only_in_literals(s), s
        assert not re.search(r"\bDO\s*\$", s), f"DO block in {path.name}"

    inserts = [r for r in (parse_insert(s) for s in body) if r is not None]
    updates = [u for u in (parse_update(s) for s in body) if u is not None]
    fa_updates = [u for u in updates if u[1] == "slug = 'financial-analyzer' AND is_system = true"]
    assert len(inserts) == len(expected_insert_ids), f"expected {len(expected_insert_ids)} INSERTs, got {len(inserts)}"
    assert len(fa_updates) == 1 and len(updates) == 1, [u[1] for u in updates]
    assert len(body) == len(inserts) + 1, body

    # --- org-portability: no UUID outside the declared set, anywhere in the file --------------
    stray_uuids = {u.lower() for u in _UUID_ANY.findall(text)} - ALLOWED_UUIDS
    assert not stray_uuids, f"UUID literal(s) outside the declared set: {sorted(stray_uuids)}"

    # --- each INSERT is a plain, org-portable Install card -------------------------------------
    seen_ids: list[str] = []
    for row in inserts:
        bid = eval_text(row["id"])
        slug = eval_text(row["slug"])
        assert slug in STARTER_IDS, f"unexpected starter slug {slug!r}"
        assert bid == STARTER_IDS[slug], (slug, bid)
        seen_ids.append(bid)
        assert row["org_id"].upper() == "NULL", (slug, row["org_id"])
        assert eval_text(row["created_by"]) == SENTINEL_AUTHOR, (slug, row["created_by"])
        assert eval_text(row["scope_mode"]) == "restricted", slug
        assert row["member_skills"] == "'{}'::text[]", (slug, row["member_skills"])
        assert row["required_connections"] == "'{}'::text[]", (slug, row["required_connections"])
        assert row["knowledge_folder_ids"] == "'{}'::uuid[]", (slug, row["knowledge_folder_ids"])
        assert eval_text(row["visibility"]) == "public", slug
        assert row["is_system"].lower() == "true" and row["is_enabled"].lower() == "true", slug
        assert eval_text(row["icon"]) in ICON_KEYS, (slug, row["icon"])

        for col in TEXT_COLUMNS:
            val = eval_text(row[col])
            assert val is not None and val.strip(), f"{slug}.{col} is empty or not a literal"
            _check_literal_hygiene(f"{slug}.{col}", val)
            if col in CEILINGS:
                assert len(val) <= CEILINGS[col], f"{slug}.{col} is {len(val)} chars > {CEILINGS[col]}"
        _suggestions(row["prompt_suggestions"])
        _check_example_output(slug, eval_text(row["example_output"]))

        tail = row["__tail__"]
        assert tail.startswith("ON CONFLICT (slug) WHERE is_system = true DO UPDATE SET "), (slug, tail[:120])
        set_list = [a.strip() for a in tail[len("ON CONFLICT (slug) WHERE is_system = true DO UPDATE SET ") :].split(",")]
        assert set_list[-1] == "updated_at = now()", (slug, set_list)
        assert set_list[:-1] == [f"{c} = EXCLUDED.{c}" for c in UPSERT_SET_COLUMNS], (slug, set_list)

    assert sorted(seen_ids) == sorted(expected_insert_ids), (seen_ids, expected_insert_ids)

    # --- the Financial Analyzer copy fix (D-269-P2) --------------------------------------------
    sets, _ = fa_updates[0]
    assert set(sets) == {"example_output", "prompt_suggestions", "updated_at"}, sorted(sets)
    assert sets["updated_at"] == "now()"
    fa_out = eval_text(sets["example_output"])
    assert fa_out is not None and len(fa_out) <= CEILINGS["example_output"]
    _check_literal_hygiene("financial-analyzer.example_output", fa_out)
    assert "30.8%" in fa_out and "$29.1" in fa_out, fa_out
    assert "24.3%" not in fa_out and "$412M" not in fa_out, fa_out
    _check_example_output("financial-analyzer", fa_out)

    fa_sugg = _suggestions(sets["prompt_suggestions"])
    _check_literal_hygiene("financial-analyzer.prompt_suggestions", eval_text(sets["prompt_suggestions"]))
    assert fa_sugg[:2] == _fa_187_suggestions()[:2], "the first two 187 suggestions must stay VERBATIM"
    assert fa_sugg[2] == {
        "title": "Compare Year-over-Year Results",
        "prompt": "Compare Q3 2026 with Q3 2025 for total revenue, gross profit and operating income in a table, citing the report.",
    }, fa_sugg[2]

    # --- no uncitable quarter-over-quarter prompt anywhere -------------------------------------
    for u_sets, _ in updates:
        assert "quarter-over-quarter" not in (eval_text(u_sets["prompt_suggestions"]) or "").lower()
    for row in inserts:
        assert "quarter-over-quarter" not in eval_text(row["prompt_suggestions"]).lower()


def _only_in_literals(stmt: str) -> bool:
    """True when every forbidden keyword in ``stmt`` sits inside a string literal (prose copy)."""
    stripped = re.sub(r"'(?:[^']|'')*'", "''", stmt)
    stripped = re.sub(r"(\$[A-Za-z_0-9]*\$).*?\1", "''", stripped, flags=re.S)
    return not re.search(r"\b(GRANT|CREATE|ALTER|DROP|DELETE|TRUNCATE)\b", stripped, flags=re.I)


# ---------------------------------------------------------------------------------------------


def test_candidate_sql_matches_the_starter_seed_shape():
    assert_starter_seed_shape(candidate_sql(), set(STARTER_IDS.values()))


# 269-04 operator lock (269-UAT-LOG.md, "Operator lock (269-04 Task 1)"): ~~the three LOCKed new
# Experts. security-compliance (…2693) was HELD BACK on a refusal FAIL (D-269-09) and must NOT be
# in 198.~~ CORRECTED by the 269 re-drive (after the BUG-260929-01 fix): security-compliance's
# install, cited and refusal turns all PASSED (evidence/11-security-compliance-*.txt), so it is
# promoted and 198 seeds ALL FOUR candidate INSERTs. assert_starter_seed_shape pins the INSERT count
# and every id, so this set is exact, not a floor. REQUIRED, not "if present": 198 missing is a
# failure here, never a skip.
LOCKED_INSERT_SLUGS = ("contract-reviewer", "hr-policy-advisor", "security-compliance", "operations-analyst")


def migration_198() -> Path:
    matches = sorted(MIGRATIONS.glob("198_*.sql"))
    assert len(matches) == 1, f"expected exactly one supabase/migrations/198_*.sql, got {matches}"
    return matches[0]


def test_migration_198_matches_the_starter_seed_shape():
    assert_starter_seed_shape(migration_198(), {STARTER_IDS[s] for s in LOCKED_INSERT_SLUGS})


def test_migration_198_seeds_every_candidate_insert_once():
    """Replaces the held-back fence: after the re-drive nothing is held, so 198's INSERT ids must be
    exactly the candidate's (a dropped or duplicated promoted row fails here)."""
    text = migration_198().read_text(encoding="utf-8")
    code = "\n".join(line for line in text.splitlines() if not line.lstrip().startswith("--"))
    assert set(LOCKED_INSERT_SLUGS) == set(STARTER_IDS), (LOCKED_INSERT_SLUGS, sorted(STARTER_IDS))
    for slug in LOCKED_INSERT_SLUGS:
        assert code.count(f"'{STARTER_IDS[slug]}'::uuid") == 1, f"{slug} id not seeded exactly once by 198"
        assert code.count(f"'{slug}'") == 1, f"{slug} slug not seeded exactly once by 198"


def test_migration_198_has_no_forbidden_statement_keyword_even_in_copy():
    code = "\n".join(
        line for line in migration_198().read_text(encoding="utf-8").splitlines() if not line.lstrip().startswith("--")
    )
    assert not re.search(r"GRANT|CREATE |ALTER |DROP |DELETE |TRUNCATE", code, flags=re.I)
    assert not re.search(r"24\.3%|412M|quarter-over-quarter", code)


def test_candidate_sql_is_a_staging_artifact_outside_migrations():
    path = candidate_sql()
    assert MIGRATIONS not in path.parents, path
    assert REPO_ROOT / ".planning" in path.parents, path


def test_candidate_sql_has_no_forbidden_statement_keyword_even_in_copy():
    """Belt and braces for the plan's grep: the copy itself avoids the DDL words entirely."""
    code = "\n".join(
        line for line in candidate_sql().read_text(encoding="utf-8").splitlines() if not line.lstrip().startswith("--")
    )
    assert not re.search(r"GRANT|CREATE |ALTER |DROP |DELETE |TRUNCATE", code, flags=re.I)
    assert not re.search(r"24\.3%|412M|quarter-over-quarter", code)


def test_shape_helper_is_not_vacuous(tmp_path):
    """The helper REJECTS a planted org id and a planted uncitable figure (both drawn from real traps)."""
    good = candidate_sql().read_text(encoding="utf-8")

    planted_org = good.replace(
        "'00000000-0000-0000-0000-000000002691'::uuid,\n    NULL,",
        "'00000000-0000-0000-0000-000000002691'::uuid,\n    'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'::uuid,",
        1,
    )
    assert planted_org != good, "plant anchor not found — update the test with the file"
    p = tmp_path / "planted_org.sql"
    p.write_text(planted_org, encoding="utf-8")
    try:
        assert_starter_seed_shape(p, set(STARTER_IDS.values()))
    except AssertionError as exc:
        assert "UUID literal" in str(exc) or "org_id" in str(exc) or "aaaaaaaa" in str(exc)
    else:
        raise AssertionError("a hardcoded org id passed the shape helper")

    planted_fig = good.replace("30.8%", "24.3%", 1)
    assert planted_fig != good
    q = tmp_path / "planted_fig.sql"
    q.write_text(planted_fig, encoding="utf-8")
    try:
        assert_starter_seed_shape(q, set(STARTER_IDS.values()))
    except AssertionError:
        pass
    else:
        raise AssertionError("the uncitable 24.3% passed the shape helper")
