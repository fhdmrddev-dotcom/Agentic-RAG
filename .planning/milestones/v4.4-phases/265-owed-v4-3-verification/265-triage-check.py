"""265-triage-check.py — Phase 265 plan 05 set check (a tool input, not product code).

Run from the repo root with the backend venv python:
    backend/venv/Scripts/python .planning/phases/265-owed-v4-3-verification/265-triage-check.py

Builds three sets and prints each in FULL (never a tail):
  A  review finding ids  — every `R265-<target>-NN` in the findings tables of 265-REVIEW-*.md
  B  non-PASS UAT ids    — every `UAT-265-*` id on a selected line (see SELECT) in: 265-UAT-LOG.md,
                           the frontmatter `result:` lines of the 256/257/258/261/263 VERIFICATION.md,
                           the `## Re-drive post-WR-08` section of 263-UAT.md, and the two bug reports
  C  triage ids          — first-column ids of 265-TRIAGE.md's table
A selected line carrying NO `UAT-265-*` id is printed as `UNTAGGED: <file>:<line>` (the second net).
Exit 1 if any UNTAGGED line exists, or A - C or B - C is non-empty; else prints `triage-check OK`.
"""
from __future__ import annotations

import glob
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PHASE = ROOT / ".planning/phases/265-owed-v4-3-verification"
MS = ROOT / ".planning/milestones/v4.3-phases"
BUGS = ROOT / ".planning/reported-bugs"

# The plan's markers (FAIL, ⛔, BLOCKED, HIDDEN, verdict word `fail`), widened with ❌ and the
# words the UAT log uses to raise a triage input ("Observation", "Finding"), so an observation
# that is not a FAIL still cannot slip past the net.
SELECT_CS = re.compile(r"FAIL|⛔|BLOCKED|HIDDEN|❌|Observation|\bFinding\b")
SELECT_CI = re.compile(r"\bfail\b", re.IGNORECASE)
UAT_ID = re.compile(r"UAT-265-[A-Za-z0-9-]+")
REVIEW_ID = re.compile(r"^\|\s*(R265-[A-Za-z0-9-]+)\s*\|")
TRIAGE_ID = re.compile(r"^\|\s*`?((?:R265|UAT-265)-[A-Za-z0-9-]+)`?\s*\|")


def selected(line: str) -> bool:
    return bool(SELECT_CS.search(line) or SELECT_CI.search(line))


def ids_in(line: str) -> list[str]:
    return [m.rstrip("-") for m in UAT_ID.findall(line)]


def frontmatter(lines: list[str]) -> list[tuple[int, str]]:
    out: list[tuple[int, str]] = []
    if not lines or lines[0].strip() != "---":
        return out
    for i, ln in enumerate(lines[1:], start=2):
        if ln.strip() == "---":
            break
        out.append((i, ln))
    return out


def main() -> int:
    # ---- A
    set_a: set[str] = set()
    for f in sorted(PHASE.glob("265-REVIEW-*.md")):
        for ln in f.read_text(encoding="utf-8").splitlines():
            m = REVIEW_ID.match(ln)
            if m:
                set_a.add(m.group(1))

    # ---- B
    sources: list[tuple[Path, list[tuple[int, str]]]] = []
    log = PHASE / "265-UAT-LOG.md"
    sources.append((log, list(enumerate(log.read_text(encoding="utf-8").splitlines(), start=1))))
    for p in ("256", "257", "258", "261", "263"):
        f = Path(glob.glob(str(MS / f"{p}-*" / f"{p}-VERIFICATION.md"))[0])
        fm = frontmatter(f.read_text(encoding="utf-8").splitlines())
        sources.append((f, [(n, l) for n, l in fm if l.strip().startswith("result:")]))
    uat263 = Path(glob.glob(str(MS / "263-*" / "263-UAT.md"))[0])
    lines263 = uat263.read_text(encoding="utf-8").splitlines()
    start = next(i for i, l in enumerate(lines263) if l.startswith("## Re-drive post-WR-08"))
    sources.append((uat263, [(i + 1, lines263[i]) for i in range(start, len(lines263))]))
    for name in ("BUG-260923-02-long-lists-need-pagination.md",
                 "expert-description-cap-1000-blocks-save-and-skill-body-draft.md"):
        f = BUGS / name
        sources.append((f, list(enumerate(f.read_text(encoding="utf-8").splitlines(), start=1))))

    set_b: set[str] = set()
    untagged: list[str] = []
    for f, numbered in sources:
        rel = f.relative_to(ROOT).as_posix()
        for n, ln in numbered:
            if not selected(ln):
                continue
            found = ids_in(ln)
            if not found:
                untagged.append(f"UNTAGGED: {rel}:{n}: {ln.strip()[:160]}")
            set_b.update(found)

    # ---- C
    set_c: set[str] = set()
    triage = PHASE / "265-TRIAGE.md"
    if triage.exists():
        for ln in triage.read_text(encoding="utf-8").splitlines():
            m = TRIAGE_ID.match(ln)
            if m:
                set_c.add(m.group(1))

    print(f"A (review ids) — {len(set_a)}:")
    for x in sorted(set_a):
        print(f"  {x}")
    print(f"B (non-PASS UAT ids) — {len(set_b)}:")
    for x in sorted(set_b):
        print(f"  {x}")
    print(f"C (triage ids) — {len(set_c)}")
    for u in untagged:
        print(u)
    a_c = sorted(set_a - set_c)
    b_c = sorted(set_b - set_c)
    print(f"A - C: {a_c}")
    print(f"B - C: {b_c}")
    print(f"C - (A|B) (extra triage rows, allowed): {sorted(set_c - set_a - set_b)}")
    if untagged or a_c or b_c:
        print(f"triage-check FAIL — untagged {len(untagged)}, A-C {len(a_c)}, B-C {len(b_c)}")
        return 1
    print("triage-check OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
