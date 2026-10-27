# Phase 287 Discussion Log

Autonomous session, 2026-10-19. The operator was away and asked for discuss → plan → execute end to end, so no AskUserQuestion turns were run. Gray areas were decided on the recommended option; reasons are in 287-CONTEXT.md.

| Area | Options considered | Chosen | Why |
|---|---|---|---|
| In-thread entry | composer control / slash command / header menu | composer control | user is already in the composer |
| Launch reuse | second form / reuse ChatLaunchForm | reuse + shared collect step | roadmap forbids a second form |
| Thread attach | reuse doRun / post to current thread | post to current thread | doRun always creates a thread |
| Required fields | keep mark only / block | block (shared helper) | 214.1-01 re-open trigger fires here |
| Block scope | chat only / chat + RunModal / all three | chat + RunModal, schedule deferred | same act, two doors; 293 owns schedule |
| Starters | engine code / data | data, 2+ new from existing phase types | Extension Contract |
| Gauntlet proof | assert / run | run, with planted-defect counterfactual | SC#3 says shown by running |
| G-2 sketch | run / skip | skipped, audited | operator away, no new visual element |

Deferred: schedule-form block, slash entry, starter updates to forks, agent-suggested workflows.
