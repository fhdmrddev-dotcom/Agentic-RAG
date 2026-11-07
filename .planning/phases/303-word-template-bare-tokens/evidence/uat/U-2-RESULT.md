# 303 U-2 — published pm-pack template unchanged (2026-11-06)

## Exact: pre-303 runs replayed through TODAY's sandbox driver  ✅ PASS
`u2_replay.py <run_id> <dir>` (run from `backend/` with `PYTHONPATH=.`) takes the run's OWN stored
field map and the shipped `weekly-status-report.docx`, renders through `_RENDER_DRIVER_SRC`, and
compares with the document that run delivered.

| pre-303 run | date | model | text lines | word/*.xml parts |
|---|---|---|---|---|
| `9854abae-8dd4-4fdb-8f89-fa85d5c4e773` | 2026-06-20 | gpt-5.4-mini | 19/19 identical | 8/8 byte-identical |
| `397432ff-879f-423b-9394-caee41d7f42f` | 2026-06-15 | gpt-4o | 19/19 identical | 8/8 byte-identical |

## Live: the published Weekly Status Report run through the app  ✅ PASS
Run **`f125d3e5-feab-4217-9837-79fb64539971`** (def `…1040a0`, deepseek-v4-flash, thread
`6f0aa540-…`): `completed`, `residual_clean: true`, 8 fields. Against pre-303 run `9854abae`:
17/17 paragraphs, the 9 fixed (non-token) lines identical, 8/8 token lines filled, 0 record text,
0 leftover `{{`. Values differ only because the model wrote new text.
