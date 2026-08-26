# 2026-08-26 live-connectors session — FINDINGS INDEX

**Session:** enable `live_connectors` in production, then get one real email out through the
Gmail SMTP connector. **Observed against production** (`api.superrag.cloud`) at commit `386b5a4`.
**Nothing in the app was changed** — the only production writes were one governed-flag flip and
one schedule row, both listed below.

## What actually happened

| # | Step | Outcome |
|---|---|---|
| 1 | Turn `live_connectors` on | ✅ done via `PUT /admin/visibility` (audited, 204) — **no UI exists for it** → BUG-04 |
| 2 | Add a Gmail SMTP connection | ✅ saved; Check reached `smtp.gmail.com:465`, TLS + egress guard passed |
| 3 | First Check | ❌ `5.7.9 Application-specific password required` — user error (account password, not an App Password) |
| 4 | Run the workflow | ❌ `the 'to' recipient must be a string, got NoneType` → **BUG-01, the headline finding** |
| 5 | Look for where to set the recipient | ❌ no such field anywhere in the UI → BUG-01 |
| 6 | Workaround via a scheduled run's `inputs` | ❌ trigger 500'd, browser reported it as CORS → BUG-03 |

The connector itself is sound: the transport reached Gmail, negotiated TLS, and was rejected only
on credentials. What is missing is the last mile — nothing can tell the step who to email.

## The five reports

| id | severity | one line |
|---|---|---|
| [BUG-260826-01](BUG-260826-01-send-email-arguments-unreachable-from-every-launch-path.md) | **blocking** | A `send_email` step can never receive `to`/`subject` from any UI launch path |
| [BUG-260826-02](BUG-260826-02-publish-gauntlet-does-not-validate-adapter-argument-satisfiability.md) | major | Publish certifies a send step whose required arguments nothing can supply |
| [BUG-260826-03](BUG-260826-03-schedule-trigger-500-when-org-id-null.md) | major | Manual schedule trigger 500s on a NULL `org_id`; the browser blames CORS |
| [BUG-260826-04](BUG-260826-04-live-connectors-has-no-control-room-card.md) | major | The OFF banner points at a Control Room card that does not exist (`D-190-DEF-09`) |
| [BUG-260826-05](BUG-260826-05-run-failed-reason-empty-for-external-action-failure.md) | minor | The panel says the failure reason is missing while chat displays it |

## Suggested order of work

1. **BUG-01** — the smallest credible fix is to have `_adapter_args` merge
   `phase.config.tool_args` for native capabilities, exactly as the MCP branch already does
   (`phase_types.py:2506`). The field exists, is validated and is persisted; only the native
   branch ignores it. Then give the step panel real `To` / `Subject` fields on top of it.
   Decide deliberately between author-time arguments and launch-time inputs — the observed step
   ("Email the briefing to **the requester**") implies the author wanted the latter.
2. **BUG-02** — write the satisfiability gate *against whatever shape BUG-01 takes*, so sequence
   it second, never first.
3. **BUG-04** — its own phase. It is a user-facing capability, so under **G-7** it must not be
   folded into a gap-closure round.
4. **BUG-03** and **BUG-05** — small; fold into whichever phase next touches the scheduler and the
   harness failure path respectively.

## Two things confirmed NOT to be defects

- **The golden run's send-skip is correct.** Gate 2 (D-16) skips the send during publish so a
  golden run cannot fire a real email. That is why BUG-01 is invisible to the gauntlet — the
  behaviour is right, the missing check (BUG-02) is what is wrong.
- **`workflow_runs.inputs` stored as a JSON *string* rather than an object** is a **known,
  recorded, deliberately-left** defect (`db/workflows.py:388-435`, measured at 230/230 rows) with
  its own re-open trigger. The reader `json.loads` it back
  (`harness_engine.py:2560-2570`), so it does not block the schedule-inputs path. Do not
  re-discover it as new — but note its re-open trigger is *"the next phase that touches `inputs`
  on the write path"*, which BUG-01's fix may well be.

## Production state left behind

| Change | Where | Reversible by |
|---|---|---|
| `live_connectors` → `everyone` | `app_settings.feature_visibility` | same PUT with `"audience":"off"` |
| Gmail SMTP connection "Gmail (test)" | `connector_connections` | delete/disable in Settings → Connections |
| Schedule `75886bcb-ae3c-4d65-a158-739119cffb80` (`is_active: false`) | `workflow_schedules` | `DELETE FROM workflow_schedules WHERE id = '75886bcb-…'` |

⚠ **Live sending is ON in production.** Every published workflow with an `external_action` step
now sends for real on its next run, at most once, with no retry and no queue (D-18). Each such
step still stops for human approval — that checkpoint cannot be switched off.
