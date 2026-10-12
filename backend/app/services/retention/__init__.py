"""Phase 275 — Retention & Legal Hold (RET-01..04).

The Python half of migrations 204/205. Each module here is a thin seam the hot files call in one
line (D-31, D-32, D-33): ``hold_guard`` explains a hold refusal before anything is touched; the
database triggers are the backstop on every path.
"""
