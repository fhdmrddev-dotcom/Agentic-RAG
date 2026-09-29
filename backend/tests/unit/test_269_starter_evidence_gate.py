"""269 SC#4 / D-269-09 — no starter Expert ships without its live PASS evidence.

The gate is STRUCTURAL: migration ``supabase/migrations/198_*.sql`` may seed a starter Expert only
when the phase evidence directory holds that Expert's newest install, cited and refusal transcripts
and each ends ``VERDICT: PASS``. Mock or fixture tests are never evidence (SC#4); this file reads the
transcripts 269-03 wrote from the live drive, it does not produce any.

What is pinned:

1. LOCATION IS DERIVED. The phase dir is found by ``rglob`` under ``.planning`` (it survives
   milestone archiving) and must be unique; 198 is found by glob and must be unique.
2. SEEDED SET IS DERIVED from 198 itself: every INSERT slug, plus ``financial-analyzer`` when 198
   UPDATEs it (D-269-P2 ships its copy fix, so its evidence is owed too). Collapse guard: >= 2.
3. EVIDENCE CONTRACT (269-03): for every seeded slug and kind, the file with the HIGHEST ``NN``
   prefix opens ``slug: <slug>`` / ``org_id: <uuid>``, carries exactly one ``VERDICT:`` line and it
   is ``VERDICT: PASS``; cited and refusal files carry ``web_search_calls: 0``; cited files carry at
   least one ``figure:`` line. A re-drive adds a higher NN and the failed file stays (D-269-09).
4. BIJECTION (M-12 / T-269-16): corpus directories == {financial-analyzer} | 198 INSERT slugs. No
   unseeded corpus is left behind, and no row ships whose Install would find no corpus (the
   Start-Chat-with-no-Install trap).
5. CITABLE COPY (M-10): every figure token in every 198 ``example_output`` occurs in the bytes of
   that slug's own corpus.
6. VERBATIM PROMOTION: every 198 statement (comments stripped, whitespace-normalised) is a
   statement of ``269-candidate-bundles.sql`` — the promoted rows are exactly the driven rows.

Driven RED in 269-04 twice: before 198 existed, and by moving one PASS refusal file of a seeded slug
aside (restored md5-identical) — see 269-04's record.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

from app.services.expert_corpus import CORPORA_ROOT, load_corpus
from tests.unit.test_269_no_expert_specific_code import (
    MIGRATIONS,
    PLANNING,
    eval_text,
    parse_insert,
    parse_update,
    split_sql,
)

PHASE_DIR_NAME = "269-starter-expert-library"
PINNED_SLUG = "financial-analyzer"  # shipped by mig 187; 198 may only UPDATE its copy
KINDS = ("install", "cited", "refusal")
FA_UPDATE_WHERE = "slug = 'financial-analyzer' AND is_system = true"

_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")
_NN = re.compile(r"^(\d+)-")

# Figure tokens an example_output may carry (M-10). The currency amount is captured WITHOUT its
# M/B unit: the reports state amounts in a "($M)" column, so "$29.1M" must be backed by "$29.1".
_FIGURE_PATTERNS = (
    re.compile(r"\$\d[\d,]*(?:\.\d+)?"),  # currency amount
    re.compile(r"\d[\d,]*(?:\.\d+)?%"),  # percentage
    re.compile(r"\d+ of \d+"),  # N of M
    re.compile(r"\d+ (?:days|weeks|hours)\b"),  # durations
    re.compile(r"\d+ bps\b"),  # basis points
)


# ---------------------------------------------------------------------------------------------
# Locators (derived, never constants)
# ---------------------------------------------------------------------------------------------


# The cited literals fixed BEFORE driving (269-03 Drive table). A new starter Expert must add its own
# entry here, so an evidence file cannot pass while quoting different figures than the ones promised.
STARTER_FIGURES: dict[str, set[str]] = {
    "financial-analyzer": {"30.8%", "$29.1"},
    "contract-reviewer": {"$2.35M", "75 days"},
    "hr-policy-advisor": {"18 weeks", "23 days"},
    "operations-analyst": {"94.7%", "38 days"},
}


def phase_dir() -> Path:
    matches = sorted(p for p in PLANNING.rglob(PHASE_DIR_NAME) if p.is_dir())
    assert len(matches) == 1, f"expected exactly one {PHASE_DIR_NAME} dir under .planning, got {matches}"
    return matches[0]


def evidence_dir() -> Path:
    d = phase_dir() / "evidence"
    assert d.is_dir(), f"evidence dir missing: {d}"
    return d


def migration_198() -> Path:
    matches = sorted(MIGRATIONS.glob("198_*.sql"))
    assert len(matches) == 1, f"expected exactly one supabase/migrations/198_*.sql, got {matches}"
    return matches[0]


def candidate_sql() -> Path:
    matches = sorted(PLANNING.rglob("269-candidate-bundles.sql"))
    assert len(matches) == 1, [str(m) for m in matches]
    return matches[0]


def _body(path: Path) -> list[str]:
    return [s for s in split_sql(path.read_text(encoding="utf-8")) if s.upper() not in ("BEGIN", "COMMIT")]


def insert_rows(path: Path) -> list[dict[str, str]]:
    return [r for r in (parse_insert(s) for s in _body(path)) if r is not None]


def insert_slugs(path: Path) -> set[str]:
    return {eval_text(r["slug"]) for r in insert_rows(path)}


def fa_updates(path: Path) -> list[dict[str, str]]:
    out = []
    for s in _body(path):
        u = parse_update(s)
        if u is not None and u[1] == FA_UPDATE_WHERE:
            out.append(u[0])
    return out


def seeded_slugs(path: Path) -> set[str]:
    seeded = set(insert_slugs(path))
    if fa_updates(path):
        seeded.add(PINNED_SLUG)
    return seeded


# ---------------------------------------------------------------------------------------------
# The evidence check — a pure function so its non-vacuity is itself tested
# ---------------------------------------------------------------------------------------------


def newest_evidence(ev_dir: Path, slug: str, kind: str) -> Path | None:
    files = [f for f in ev_dir.glob(f"*-{slug}-{kind}.txt") if _NN.match(f.name)]
    if not files:
        return None
    return max(files, key=lambda f: int(_NN.match(f.name).group(1)))


def evidence_problems(ev_dir: Path, slugs: set[str]) -> list[str]:
    problems: list[str] = []
    for slug in sorted(slugs):
        for kind in KINDS:
            f = newest_evidence(ev_dir, slug, kind)
            if f is None:
                problems.append(f"{slug}: no *-{slug}-{kind}.txt evidence file in {ev_dir}")
                continue
            lines = f.read_text(encoding="utf-8").splitlines()
            if len(lines) < 2 or lines[0] != f"slug: {slug}":
                problems.append(f"{f.name}: first line is not 'slug: {slug}'")
            if len(lines) < 2 or not lines[1].startswith("org_id: ") or not _UUID.match(lines[1][len("org_id: ") :]):
                problems.append(f"{f.name}: second line is not 'org_id: <uuid>'")
            verdicts = [ln for ln in lines if ln.startswith("VERDICT:")]
            if len(verdicts) != 1:
                problems.append(f"{f.name}: {len(verdicts)} VERDICT lines, expected exactly 1")
            elif verdicts[0] != "VERDICT: PASS":
                problems.append(f"{f.name}: newest attempt is not a PASS — {verdicts[0][:160]}")
            if kind in ("cited", "refusal") and "web_search_calls: 0" not in lines:
                problems.append(f"{f.name}: no 'web_search_calls: 0' line")
            if kind in ("cited", "refusal") and "out_of_folder_documents_retrieved_by_any_tool: 0" not in {ln.strip() for ln in lines}:
                problems.append(f"{f.name}: no 'out_of_folder_documents_retrieved_by_any_tool: 0' line")
            if kind == "refusal" and "sibling_literal_present: false" not in lines:
                problems.append(f"{f.name}: no 'sibling_literal_present: false' line")
            if kind == "cited":
                figures = {ln[len("figure: ") :] for ln in lines if ln.startswith("figure: ")}
                if not figures:
                    problems.append(f"{f.name}: no 'figure: ' line")
                elif slug not in STARTER_FIGURES:
                    problems.append(f"{f.name}: slug {slug} has no Starter Contract figures in STARTER_FIGURES")
                elif not STARTER_FIGURES[slug] <= figures:
                    problems.append(
                        f"{f.name}: figures {sorted(figures)} miss the Starter Contract {sorted(STARTER_FIGURES[slug] - figures)}"
                    )
    return problems


def figure_tokens(text: str) -> set[str]:
    out: set[str] = set()
    for rx in _FIGURE_PATTERNS:
        out |= set(rx.findall(text))
    return out


# ---------------------------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------------------------


def test_seeded_set_is_derived_from_198_and_not_collapsed():
    seeded = seeded_slugs(migration_198())
    assert PINNED_SLUG in seeded, "198 no longer carries the D-269-P2 Financial Analyzer UPDATE"
    assert len(seeded) >= 2, f"seeded set collapsed to {sorted(seeded)} — a gate over nothing is vacuous"


def test_every_seeded_expert_has_newest_pass_install_cited_and_refusal_evidence():
    problems = evidence_problems(evidence_dir(), seeded_slugs(migration_198()))
    assert not problems, "starter Expert(s) seeded without live PASS evidence (SC#4 / D-269-09):\n" + "\n".join(
        problems
    )


def test_corpus_directories_are_a_bijection_with_the_seeded_rows():
    on_disk = sorted(p.name for p in CORPORA_ROOT.iterdir() if p.is_dir())
    expected = sorted({PINNED_SLUG} | insert_slugs(migration_198()))
    assert on_disk == expected, (
        f"corpus dirs {on_disk} != financial-analyzer + 198 INSERT slugs {expected} — an unseeded corpus "
        "ships dead weight; a row with no corpus shows Start Chat with no Install (M-12)"
    )


def test_every_example_output_figure_is_in_that_slugs_own_corpus():
    path = migration_198()
    outputs: list[tuple[str, str]] = [(eval_text(r["slug"]), eval_text(r["example_output"])) for r in insert_rows(path)]
    outputs += [(PINNED_SLUG, eval_text(u["example_output"])) for u in fa_updates(path) if "example_output" in u]
    assert outputs, "no example_output found in 198"
    checked = 0
    for slug, text in outputs:
        assert text, f"{slug}: example_output is not a literal"
        corpus = b"\n".join(f.raw for f in load_corpus(slug).files)
        tokens = figure_tokens(text)
        assert tokens, f"{slug}: example_output carries no figure token — the regex set drifted from the copy"
        missing = sorted(t for t in tokens if t.encode("utf-8") not in corpus)
        assert not missing, f"{slug}: example_output cites {missing}, absent from its own corpus (M-10)"
        checked += len(tokens)
    assert checked >= 2 * len(outputs)


def test_every_198_statement_is_a_verbatim_candidate_statement():
    candidate = set(split_sql(candidate_sql().read_text(encoding="utf-8")))
    stray = [s[:160] for s in split_sql(migration_198().read_text(encoding="utf-8")) if s not in candidate]
    assert not stray, "198 carries statement(s) that were never driven as candidates:\n" + "\n".join(stray)


# --- non-vacuity: the evidence check rejects what it claims to reject ---------------------------


@pytest.fixture
def ev_copy(tmp_path: Path) -> Path:
    src = evidence_dir()
    for f in src.glob("*.txt"):
        (tmp_path / f.name).write_bytes(f.read_bytes())
    return tmp_path


def test_evidence_check_accepts_the_real_locked_set(ev_copy):
    assert evidence_problems(ev_copy, seeded_slugs(migration_198())) == []


def test_evidence_check_rejects_a_missing_file(ev_copy):
    slug = sorted(insert_slugs(migration_198()))[0]
    newest_evidence(ev_copy, slug, "refusal").unlink()
    problems = evidence_problems(ev_copy, {slug})
    assert any(f"-{slug}-refusal.txt" in p for p in problems), problems


def test_evidence_check_rejects_a_newest_fail_even_over_an_older_pass(ev_copy):
    slug = sorted(insert_slugs(migration_198()))[0]
    older = newest_evidence(ev_copy, slug, "cited")
    text = older.read_text(encoding="utf-8").replace("VERDICT: PASS", "VERDICT: FAIL — planted")
    (ev_copy / f"99-{slug}-cited.txt").write_text(text, encoding="utf-8")
    problems = evidence_problems(ev_copy, {slug})
    assert any("99-" in p and "not a PASS" in p for p in problems), problems


def test_evidence_check_rejects_the_held_back_expert():
    """security-compliance is HELD (refusal FAIL). The check must say so if anyone seeds it."""
    problems = evidence_problems(evidence_dir(), {"security-compliance"})
    assert any("security-compliance-refusal.txt" in p and "not a PASS" in p for p in problems), problems


def test_evidence_check_rejects_a_pass_verdict_over_a_measured_leak(ev_copy):
    """WR-01: a helper that wrote VERDICT: PASS over an out-of-folder hit must not pass the gate."""
    slug = sorted(insert_slugs(migration_198()))[0]
    f = newest_evidence(ev_copy, slug, "refusal")
    text = f.read_text(encoding="utf-8").replace(
        "out_of_folder_documents_retrieved_by_any_tool: 0", "out_of_folder_documents_retrieved_by_any_tool: 1"
    )
    f.write_text(text, encoding="utf-8")
    problems = evidence_problems(ev_copy, {slug})
    assert any("out_of_folder_documents_retrieved_by_any_tool: 0" in p for p in problems), problems


def test_evidence_check_rejects_a_present_sibling_literal_and_wrong_figures(ev_copy):
    slug = sorted(insert_slugs(migration_198()))[0]
    r = newest_evidence(ev_copy, slug, "refusal")
    r.write_text(r.read_text(encoding="utf-8").replace("sibling_literal_present: false", "sibling_literal_present: true"), encoding="utf-8")
    c = newest_evidence(ev_copy, slug, "cited")
    c.write_text(re.sub(r"(?m)^figure: .*$", "figure: 0.0%", c.read_text(encoding="utf-8")), encoding="utf-8")
    problems = evidence_problems(ev_copy, {slug})
    assert any("sibling_literal_present: false" in p for p in problems), problems
    assert any("miss the Starter Contract" in p for p in problems), problems
