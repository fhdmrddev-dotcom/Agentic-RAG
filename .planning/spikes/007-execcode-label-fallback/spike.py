"""
Spike 007 — Graceful label fallback when execute_code has NO description.

Spike 006 showed activity-derivation is semantically rich WHEN execute_code
carries a `description`. But the OpenAI run's execute_code calls had
`description: null` (it leaned on write_todos instead). So the derive path needs
a deterministic fallback: infer a human label from the CODE itself.

This validates: given description-less execute_code (real OpenAI code shapes),
a deterministic keyword/comment heuristic yields a meaningful label (not the
generic "Run code"). Label-source precedence overall:
    write_todos  >  execute_code.description  >  code-inferred  >  "Run code"

No network, no LLM, deterministic.
"""
import re

# Real OpenAI execute_code code bodies (description was null on these calls).
SAMPLES = [
    ("for i in range(1, 31):\n    print(i)", "print"),
    ("import numpy as np\nimport pandas as pd\n\nnp.random.seed(42)\nrows=100\n"
     "df = pd.DataFrame({'id': range(1, rows+1)})\ndf.to_csv('/sandbox/out/sample_data.csv', index=False)", "csv"),
    ("import numpy as np\nimport matplotlib.pyplot as plt\nx=np.arange(1,21)\ny=np.cumsum(np.random.normal(size=20))\n"
     "plt.plot(x,y, marker='o')\nplt.savefig('/sandbox/out/line_chart.png')", "chart"),
    ("# Build the quarterly report\nfrom docx import Document\ndoc=Document()\ndoc.save('report.docx')", "docx"),
    ("from pptx import Presentation\nprs=Presentation()\nprs.save('deck.pptx')", "pptx"),
    ("x = 2 + 2\nresult = x * 10", "generic"),  # nothing recognizable -> generic fallback
]

# Ordered deterministic rules (first match wins). Keyword scan of the code body.
RULES = [
    (re.compile(r"\.to_csv\(|\bcsv\b", re.I), "Create CSV file"),
    (re.compile(r"savefig|matplotlib|seaborn|plt\.", re.I), "Create chart"),
    (re.compile(r"from docx|Document\(|\.docx", re.I), "Create Word document"),
    (re.compile(r"from pptx|Presentation\(|\.pptx", re.I), "Create slides"),
    (re.compile(r"reportlab|\.pdf\b", re.I), "Create PDF"),
    (re.compile(r"to_excel|openpyxl|\.xlsx", re.I), "Create spreadsheet"),
    (re.compile(r"^\s*print\(", re.I | re.M), "Print output"),
]


def infer_label(code: str) -> str:
    # 1) a leading comment is the most honest label, if present
    for line in code.splitlines():
        s = line.strip()
        if s.startswith("#") and len(s) > 2:
            return s.lstrip("# ").strip().capitalize()
        if s:  # first non-empty, non-comment line -> stop looking for a header comment
            break
    # 2) keyword inference
    for rx, label in RULES:
        if rx.search(code):
            return label
    # 3) generic
    return "Run code"


def main():
    print("=== execute_code code -> inferred label (description absent) ===")
    ok = True
    expectations = {
        "print": "Print output",
        "csv": "Create CSV file",
        "chart": "Create chart",
        "docx": "Build the quarterly report",   # leading comment wins
        "pptx": "Create slides",
        "generic": "Run code",
    }
    for code, key in SAMPLES:
        label = infer_label(code)
        want = expectations[key]
        good = label == want
        ok = ok and good
        print(f"  [{'PASS' if good else 'FAIL'}] {key:8s} -> {label!r}  (want {want!r})")

    # The real point: every description-less call still gets a NON-generic label
    # except the genuinely-unrecognizable one.
    non_generic = sum(1 for code, key in SAMPLES if infer_label(code) != "Run code")
    print(f"\n  {non_generic}/{len(SAMPLES)} samples got a specific (non-'Run code') label")
    print(f"\nVERDICT: {'VALIDATED' if ok else 'PARTIAL'}")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
