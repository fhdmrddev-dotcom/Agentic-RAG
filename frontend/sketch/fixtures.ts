/**
 * ⚠ THROWAWAY — SKETCH 202 ONLY. Delete the whole `frontend/sketch/` directory at teardown.
 * `src/__tests__/no-sketch-surface.test.ts` FAILS while this directory outlives its sketch,
 * so the teardown obligation is executable rather than a note in a README (sketch 179's dev
 * route was torn down correctly, but nothing could have reported it if it had not been).
 *
 * ⚠ IT LIVES OUTSIDE `src/` ON PURPOSE, AND THAT IS A MEASURED FIX RATHER THAN TIDINESS.
 * The first attempt put it at `src/dev/` and turned `RunReceipt.test.tsx` RED — that suite
 * sweeps `import.meta.glob(/src/**)` and asserts EXACTLY ONE importer of `RunReceipt`
 * (199-02's refusal). A sketch under `src/` is production surface as far as a shipped fence
 * is concerned. A sibling directory is invisible to that glob and can still import the real
 * components through `@/`, so the fence keeps its full strictness and the sketch keeps real
 * mounts.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────
 * EVERY VALUE BELOW WAS READ OUT OF THE LIVE LOCAL DB ON 2026-08-23. Nothing is invented.
 * Four real runs, chosen because between them they cover all four deliverable arms:
 *
 *   both      bef870ba  completed  5 steps  1 file + an answer
 *   answer    13691156  completed  3 steps  0 files, an answer, 38 citations on step 1
 *   failed    d8f87920  failed     5 steps  NEITHER — step 1 failed, four left pending
 *   cancelled c353ff78  cancelled  5 steps  NEITHER — step 1 cancelled, four left pending
 *
 * Passages are truncated to 420 chars and citation lists to the first 6 entries, because a
 * sketch fixture is a rendering aid; the COUNTS below are the real full counts.
 *
 * ⚠ `phase_type` WAS `null` ON EVERY ROW IN THE FIRST GENERATION, AND THAT WAS A FIXTURE
 * DEFECT, NOT A FACT ABOUT THE DATA. The generator read `phase["phase_type"]` off the
 * definition, which does not exist. The server reads `phase["config"]["phase_type"]`
 * (`api/workflow_runs.py:308`), and it is populated on every real row:
 * `llm_agent` · `llm_single` · `llm_emit` · `llm_human_input`.
 *
 * The wrong fixture produced a wrong CONCLUSION, which is why this is recorded rather than
 * quietly fixed: the sketch reported that *"nothing on the wire marks a gate"* and used a
 * slug heuristic instead. There IS a clean signal, the shipped `runAnswer` already uses it,
 * and `200.2-CONTEXT.md`'s D-06 discussion must be corrected on that point.
 */
import type { WorkflowRunPhase } from "@/lib/api"
import type { Citation } from "@/types"

export type ArmKey = "both" | "answer" | "failed" | "cancelled"

export interface SketchFile {
  id: string
  path: string
  size_bytes: number | null
  mime_type: string | null
  created_at: string | null
}

export interface SketchRun {
  id: string
  status: string
  created_at: string
  updated_at: string
  workflowName: string
  /** The page owns the join and the name — exactly as `RunTranscriptProps.titleOf` requires. */
  names: Record<string, string>
  phases: WorkflowRunPhase[]
  /** First 6 real citations per slug. `citationTotals` carries the REAL total. */
  citations: Record<string, Citation[]>
  citationTotals: Record<string, number>
  files: SketchFile[]
}

const BOTH_RUN: SketchRun = {
  "id": "bef870ba-dbdc-4442-ab5c-b0153d30bdb9",
  "status": "completed",
  "created_at": "2026-08-20T20:31:23.412203+00:00",
  "updated_at": "2026-08-20T20:34:02.861528+00:00",
  "workflowName": "Quarterly Business Review — Northwind Logistics",
  "names": {
    "gather-usage": "Pull usage and adoption data",
    "gather-support": "Pull support history",
    "gather-commercial": "Pull commercial position and meeting notes",
    "synthesize": "Synthesize the QBR narrative",
    "emit-qbr": "Fill the QBR template"
  },
  "phases": [
    {
      "slug": "gather-usage",
      "phase_index": 0,
      "status": "completed",
      "phase_type": "llm_agent",
      "started_at": "2026-08-20T20:31:23.452134+00:00",
      "completed_at": "2026-08-20T20:31:50.119511+00:00",
      "step_count": 15,
      "step_noun": "sources",
      "deliverable_text": "## Northwind Logistics — Q3 2026 (Jul–Sep) Usage & Adoption Summary\n\n**Source found:** Yes — the knowledge base contains a dedicated report, *Northwind Logistics — Product Usage, Q3 2026 (Jul–Sep)* (prepared by Customer Success Operations, data extracted 2 Oct 2026), plus corroborating QBR, support, and commercial documents [1][3][4].\n\n### Product usage metrics (headline adoption)\n\n| Metric | Q2 2026 | Q3 2026 | Change |\n|---|---|---|---|\n| Licensed seats | 605 | 605 | flat |\n| Seats active in period | 388 | 412 | +24 |\n| Seat utilisation | 64% | 68% | +4 pts |\n| Weekly active users (avg) | 271 | 309 | +38 |\n| Depot rollups generated | 1,044 | 1,187 | +143 |\n| Document searches | 22,410 | 31,668 | +41% |\n| Fuel reconciliation exports | 12 | 14 | +2 |\n\n[1]\n\n### Feature adoption trends\n\n- **Document search is the standout gainer** — up 41% QoQ, the largest single jump since onboarding. It directly follows Northwind's July compliance training push, when **96 depot supervisors were onboarded in a two-week window** [1]. In the Q3 QBR, Head of Compliance Sian Okoro attributed a **DVSA audit passed with zero documentation findings** (Aug 2026) to document search [3].\n- **Depot rollups are now fully self-serve**: 6 of 7 depots generated their own weekly pack without Customer Success involvement; the **Hull depot** remains the exception, still requesting manual assistance roughly fortnightly [1].\n- **Fuel reconciliation is under-adopted relative to value**: only 14 exports in the quarter vs a theoretical 39 (13 weeks × 3 finance users). Finance still re-keys part of the output — the stated reason is open ticket **SUP-9902** (fuel export column ordering changes between runs) [1][4].\n- **Saved views have poor discovery**: only **9%** of active users have opened the feature, despite it being the most-requested item in the Q1 2026 review; a permissions issue (SUP-10014) means saved views are not visible to the depot supervisor role [1][4].\n- **Engagement quality**: NPS **41** (up from 33 in Q2; 14 responses from 605 seats); average session length 11 min 40 s [1].\n\n### Expansion signals\n\n- **Freight Analytics module (~£62,000/yr at Northwind's volume) is the only live opportunity that grows the account.** Marcus Feld (Ops Director) asked for it unprompted in the Q2 review and again informally in September — the rare item both operations and finance want, for different reasons [2].\n- It is **gated on closing SUP-9902** — selling analytics to a finance team that doesn't trust the current export would fail on first contact [2].\n- Recommended net position if it lands with a 500-seat band: ~£296,500 ARR vs £284,000 today, with a materially stickier account; commercial proposal due **14 Nov 2026** per QBR action 4 [2][3].\n- Operational wins Northwind called out themselves support stickiness: \"six hours of somebody's Monday… has just gone,\" and 96 supervisors onboarded with zero training escalations [3].\n\n### Risk signals to flag (not expansion)\n\n- **Utilisation at 68% means ~193 licensed seats are unused** — the single most likely target for commercial reduction at renewal; finance has asked for a seat-level usage export **twice** this quarter [1].\n- Renewal risk is assessed **AMBER** — value-compression risk rather than churn; Gareth Pryce (Finance Controller) asked what a 500-seat contract would cost and stated intent to \"test the market\" [2][3].\n- **INC-4471** (12 Aug 2026): a 6h12m Sev-1 outage on depot rollup generation caused by queue-worker exhaustion after the July onboarding surge — Northwind's principal concern and the reason a **written capacity review is required before any future seat expansion** [3][4].\n- Support ticket volume rose 23% QoQ, tracking the onboarding rather than stability issues [4].\n\n**Data caveat:** All metrics come from the Q3 2026 usage report dated 2 Oct 2026 [1]; no separate/additional Q3 2026 usage telemetry source exists in the knowledge base beyond the documents cited above.\n\n**Sources:** [1] northwind-usage-q3-2026.md · [2] northwind-commercials-renewal.md · [3] northwind-qbr-notes-sept-2026.md · [4] northwind-support-q3-2026.md"
    },
    {
      "slug": "gather-support",
      "phase_index": 1,
      "status": "completed",
      "phase_type": "llm_agent",
      "started_at": "2026-08-20T20:31:50.132674+00:00",
      "completed_at": "2026-08-20T20:32:13.448480+00:00",
      "step_count": 20,
      "step_noun": "sources",
      "deliverable_text": "# Northwind Logistics — Support History, Q3 2026 (Jul–Sep)\n\n**Source found: Yes.** The knowledge base contains a dedicated report, *Northwind Logistics — Support Summary, Q3 2026* (prepared by Support Lead Aoife Brennan, dated 30 Sep 2026), which is corroborated by the September QBR notes, the Q3 usage report, and the commercial renewal note [1][2][4][3].\n\n## Ticket volumes\n\n| Metric | Q2 2026 | Q3 2026 |\n|---|---|---|\n| Tickets raised | 71 | **87** |\n| Resolved within SLA | 68 | **82** |\n| SLA breaches | 3 | **5** |\n| Reopened tickets | 4 | **2** |\n\nVolume rose **23% QoQ**, attributed to the 96 new supervisor accounts onboarded in July rather than any decline in stability [1]. Only 2 tickets were reopened (down from 4), and 82 of 87 tickets were resolved within SLA [1].\n\n## Resolution times (improved)\n\n- **Median first response:** 38 min (down from 47 min in Q2) [1].\n- **Median time to resolve:** 7h 51m (down from 9h 05m in Q2) [1].\n\nBoth metrics improved quarter-over-quarter [1].\n\n## Severity & incidents\n\n- **INC-4471 — Sev-1 (the one that matters):** depot rollup generation unavailable on **12 Aug 2026**, duration **6h 12m (08:14–14:26 BST)**. Impacted **all seven depots**, delaying Monday operating packs by a full working day. Cause: **queue-worker exhaustion** triggered by the July onboarding surge — the concurrency ceiling had not been raised alongside seat growth. Resolution: worker pool raised from 4 to 12, with an autoscaling threshold added [1].\n- This is the **only Sev-1 incident Northwind has experienced in 30 months** as a customer [1].\n- **The four other SLA breaches** were all **Sev-3** documentation/how-to questions that aged past the 48-hour target during the August holiday period; none had operational impact. Holiday cover has since been adjusted [1].\n\n## Escalations\n\n- **Marcus Feld (Ops Director) escalated INC-4471 the same morning** (12 Aug) and requested a root-cause analysis [1].\n- The RCA was delivered **19 Aug — one day later than the five-working-day commitment** [1].\n- At the 24 Sep QBR, Marcus opened with INC-4471, pressing that the concurrency ceiling had not been reviewed when 96 users were added (\"you knew we were adding people, because you onboarded them\"), and asked for a **written capacity review ahead of any future seat expansion** — a commitment made in the room [2].\n- Notably, onboarding of the 96 supervisors in two weeks completed **without a single training escalation** [2].\n\n## Recurring issues (open at quarter end)\n\n- **SUP-9902 — fuel export column ordering changes between runs.** Open **41 days** at quarter end; root cause identified, fix scheduled. This is finance's stated reason for continuing to re-key data, and it gates the Freight Analytics expansion opportunity (selling analytics to a finance team that doesn't trust the export would fail) [1][3][4].\n- **SUP-10014 — saved views not visible to the depot supervisor role.** Open **12 days**; likely a permissions mapping issue rather than a defect [1]. It explains the poor 9% discovery of saved views among active users [4].\n\n## Key takeaway\n\nThe quarter's support story is one of **volume growth driven by onboarding, not instability**: response/resolution times improved, reopen rates halved, and the sole Sev-1 in 30 months (INC-4471) was a capacity-planning miss that Northwind's Ops Director escalated and has made a condition for any future seat expansion [1][2]. The two open tickets (SUP-9902, SUP-10014) are the recurring themes feeding both the fuel-reconciliation re-keying complaint and the saved-views discovery gap, and SUP-9902 specifically is treated as a gate for the account's only expansion opportunity [1][3][4].\n\n**Sources:** [1] northwind-support-q3-2026.md · [2] northwind-qbr-notes-sept-2026.md · [3] northwind-commercials-renewal.md · [4] northwind-usage-q3-2026.md"
    },
    {
      "slug": "gather-commercial",
      "phase_index": 2,
      "status": "completed",
      "phase_type": "llm_agent",
      "started_at": "2026-08-20T20:32:13.459031+00:00",
      "completed_at": "2026-08-20T20:32:51.461880+00:00",
      "step_count": 20,
      "step_noun": "sources",
      "deliverable_text": "## Northwind Logistics — Q3 2026 Commercial Position & Meeting Notes\n\n**Source found: Yes.** The knowledge base contains a dedicated commercial document, *Northwind Logistics — Commercials & Renewal Position* (last updated 2 Oct 2026, owner Priya Raghunathan) [1], and the Q3 2026 meeting notes, *Northwind Logistics — QBR Preparation Notes, September 2026* (QBR held 24 Sep 2026, Leeds) [2]. A June 2025 account profile corroborates the account context [3].\n\n---\n\n### Contract value & renewal timing\n\n- **ARR: £284,000**; **605 licensed seats** at an effective **£469/seat/year** [1].\n- **Contract start:** 4 March 2024; **current term ends 31 January 2027** [1].\n- **No auto-renew — active renewal required.** Payment is annual in advance, with a **60-day notice period, i.e. notice must be given by 2 December 2026** [1].\n\n### Expansion vs. churn risk\n\n- **Renewal risk assessed AMBER — the risk is value compression, not churn.** The account is described as \"not at risk of churn\" because operational dependency is deep (the Monday operating pack is load-bearing for seven depots) [1].\n- **The main risk is a seat reduction:** at 68% utilisation, finance has a \"defensible case\" to cut to ~500 seats; at current per-seat pricing that would drop ARR from £284,000 to **£234,500 — a £49,500 reduction** [1]. Finance Controller Gareth Pryce has stated intent to \"test the market,\" which the note reads as leverage \"rather than genuine displacement intent\" [1].\n- **The only live expansion opportunity is the Freight Analytics module (~£62,000/year at Northwind's volume)** — requested unprompted by Ops Director Marcus Feld in the Q2 review and again informally in September [1]. It is **gated on closing support ticket SUP-9902**, since selling analytics to a finance team that doesn't trust the current export \"would fail on first contact\" [1].\n- **Net position if both land (500 seats + Freight Analytics): ≈ £296,500 ARR** — slightly up on today with a \"materially stickier account\" [1].\n- **Recommended strategy:** lead voluntarily with a 500-seat band (converting a concession into a gesture) and attach Freight Analytics in the same conversation; **commercial proposal due 14 November 2026** per QBR action 4 [1][2].\n\n### Key points from the Q3 2026 meeting notes (24 Sep 2026 QBR, Leeds)\n\nAttendees: Northwind — Marcus Feld (Ops Director), Sian Okoro (Head of Compliance), Gareth Pryce (Finance Controller); us — Priya Raghunathan, Tomas Lindqvist [2].\n\n**Wins Northwind called out themselves:**\n1. **The Monday pack is no longer a job** — Marcus Feld verbatim: \"Six hours of somebody's Monday, every Monday, has just gone\" [2].\n2. **DVSA audit passed with zero documentation findings** (Aug 2026), attributed by Sian Okoro directly to document search [2].\n3. **96 supervisors onboarded in two weeks** with no training escalations — described by Northwind's L&D team as unprecedented [2].\n\n**Concerns raised (in order):**\n1. **INC-4471** — Marcus opened with it; his concern was that the concurrency ceiling wasn't reviewed when 96 users were added (\"you knew we were adding people, because you onboarded them\"). He asked for a **written capacity review ahead of any future seat expansion — a commitment made in the room** [2].\n2. **Seat utilisation (68%)** — Gareth Pryce asked what a 500-seat contract would cost and was explicit he intends to \"test the market\" before the January renewal; Priya did not counter-offer in the room [2].\n3. **Fuel reconciliation re-keying** — Gareth: \"the reason my team still doesn't quite believe the numbers\"; linked to SUP-9902 [2].\n4. **Saved views invisible to supervisors** — identified on the spot as a permissions mapping issue [2].\n\n**Agreed actions (owner / due):** written capacity review before any seat expansion (Tomas Lindqvist, 31 Oct 2026); close SUP-9902 (Aoife Brennan, 15 Nov 2026); fix supervisor visibility of saved views (Tomas Lindqvist, 10 Oct 2026); commercial proposal covering seat banding + Freight Analytics (Priya Raghunathan, **14 Nov 2026**); Hull depot enablement session (Priya Raghunathan, 28 Nov 2026) [2].\n\n**Priya's post-meeting read:** \"The relationship is strong at operations level and genuinely at risk at finance level. Marcus will advocate for renewal; Gareth will not block it but will squeeze it. If we arrive in January without a seat-banding answer and a closed SUP-9902, we will renew at a lower number. The Freight Analytics conversation is the only thing on the table that grows the account rather than defending it\" [2].\n\n### Corroborating context\nThe June 2025 account profile notes Northwind's **finance team as the sceptical stakeholder** that has questioned per-seat pricing at each of the last two reviews, Marcus Feld as the internal champion, and that **Freight Analytics is not enabled** — cross-referencing the commercials note [3].\n\n---\n\n### What could NOT be found (stated explicitly)\n- **No copy of the actual signed contract / order form** exists in the knowledge base — the contract value, term end (31 Jan 2027), and notice deadline (2 Dec 2026) come solely from the Commercials & Renewal Position note [1].\n- **No Q2 2026 meeting notes** — the Q2 review is referenced (where Marcus first asked for Freight Analytics) but its notes were not found [1][2].\n- **No formal commercial proposal document yet** — it is scheduled, not delivered (due 14 Nov 2026) [1][2].\n- The **account profile is dated June 2025** (older context), not Q3 2026 [3].\n\n**Sources:** [1] northwind-commercials-renewal.md (Commercials & Renewal Position, 2 Oct 2026) · [2] northwind-qbr-notes-sept-2026.md (QBR notes, 24 Sep 2026) · [3] northwind-account-profile.md (account profile, 11 Jun 2025)"
    },
    {
      "slug": "synthesize",
      "phase_index": 3,
      "status": "completed",
      "phase_type": "llm_single",
      "started_at": "2026-08-20T20:32:51.473728+00:00",
      "completed_at": "2026-08-20T20:33:22.977571+00:00",
      "step_count": null,
      "step_noun": null,
      "deliverable_text": "# Northwind Logistics — Executive Steering Committee QBR\n\n| | |\n|---|---|\n| **Client** | Northwind Logistics |\n| **Account Owner** | Priya Raghunathan — named owner of the Commercials & Renewal Position and commercial lead at the 24 Sep QBR. No document in the knowledge base carries the explicit title \"Account Owner,\" so this is the best-supported attribution. |\n| **Review Period** | Q3 2026 (1 Jul – 30 Sep 2026); QBR held 24 Sep 2026, Leeds |\n| **Overall Health Status** | **AMBER** — deepening operational execution and adoption momentum (DVSA audit pass, zero-escalation onboarding, NPS +8) are offset by genuine renewal risk: **68% seat utilisation gives finance a defensible case for a reduction**, the only expansion path is gated on an open support ticket, and a Sev-1 incident this quarter has made the client's key stakeholder condition future growth on a capacity review. Risk is **value compression, not churn** — the account is deeply operationally embedded (Monday operating pack is load-bearing across 7 depots). |\n\n---\n\n## Wins This Quarter\n1. **DVSA audit passed with zero documentation findings (Aug 2026)** — Head of Compliance Sian Okoro attributed this directly to document search.\n2. **96 depot supervisors onboarded in two weeks with zero training escalations** — described by Northwind's L&D team as unprecedented.\n3. **Monday operating pack is no longer a manual job** — Ops Director Marcus Feld, verbatim: *\"Six hours of somebody's Monday, every Monday, has just gone.\"* 6 of 7 depots now generate rollups fully self-serve (Hull is the exception).\n4. **Document search usage up 41% QoQ** to 31,668 searches — the largest single feature jump since onboarding.\n5. **Support efficiency improved** — median first response down to 38 min (from 47), median resolution down to 7h 51m (from 9h 05m), reopen rate halved.\n\n## Adoption Summary\n- **Seats:** 605 licensed; **412 active (68%, up 4 pts)**; avg 309 weekly active users (+38). NPS **41** (up from 33; 14 responses); avg session 11m 40s.\n- **Depot rollups:** 1,187 generated (+143); fully self-serve except Hull (manual assistance ~fortnightly).\n- **Document search:** 31,668 searches (+41%), driven by the July compliance-training ramp.\n- **Fuel reconciliation — under-adopted:** 14 exports vs a theoretical 39 (13 weeks × 3 finance users); finance continues re-keying output, citing open ticket **SUP-9902**.\n- **Saved views — poor discovery:** only 9% of active users have opened the feature despite it being the most-requested item at Q1 2026; a permissions issue (**SUP-10014**) blocks visibility for the depot supervisor role.\n\n## Support Summary\n- **Volume:** 87 tickets (+23% QoQ), driven by the July onboarding surge rather than instability; 82 resolved within SLA; 5 breaches.\n- **INC-4471 (Sev-1, 12 Aug):** 6h 12m outage on depot rollup generation, all 7 depots impacted. Cause: queue-worker exhaustion — the concurrency ceiling was not raised alongside the 96-seat onboarding. Sole Sev-1 in Northwind's 30-month history. Escalated same day by Marcus Feld; RCA delivered one day late (19 Aug). Marcus made a **written capacity review a condition for any future seat expansion** — agreed in the room (due 31 Oct).\n- **Other 4 SLA breaches:** Sev-3 documentation queries ageing out during August holiday cover; no operational impact.\n- **Open at quarter end:** SUP-9902 (fuel export column ordering; open 41 days — **gates the Freight Analytics expansion**) and SUP-10014 (saved views invisible to supervisors; open 12 days).\n\n## Commercial Summary\n- **ARR £284,000**; 605 seats at ~£469/seat/yr. Contract ends **31 Jan 2027**; **no auto-renew**; 60-day notice required, i.e. **decision by 2 Dec 2026**. (Note: no signed order form exists in the knowledge base; terms come from the Commercials & Renewal Position note.)\n- **Renewal risk: AMBER — seat reduction, not churn.** At ~500 seats, ARR drops to ~£234,500 (−£49,500). Finance Controller Gareth Pryce has asked what a 500-seat contract costs and stated intent to \"test the market\" — read as leverage rather than genuine displacement.\n- **Only live expansion: Freight Analytics (~£62,000/yr at Northwind's volume),** requested unprompted by Marcus Feld and desired by both operations and finance — **but gated on closing SUP-9902.**\n- **Net position if both land (500-seat band + Freight Analytics): ~£296,500 ARR** with a materially stickier account. Recommended approach: voluntarily lead with the 500-seat band, attach Freight Analytics in the same conversation; **commercial proposal due 14 Nov 2026**.\n\n## Risks and Watchouts\n1. **Seat reduction at renewal** — ~193 seats unused (68% utilisation); finance requested seat-level usage exports twice this quarter.\n2. **INC-4471 recurrence** — if the capacity review (due 31 Oct) is not delivered before any seat expansion, the client's principal stakeholder has signalled this is a blocker.\n3. **SUP-9902 open 41 days** — keeps finance distrustful of fuel data, sustains the re-keying complaint, and **blocks the only expansion opportunity**.\n4. **2 Dec 2026 notice deadline** — no auto-renew; commercial position must be settled before year-end.\n5. **SUP-10014** — pinned as the cause of poor saved-views discovery, a Q1-priority feature that is effectively invisible to the supervisor role.\n\n## Next-Quarter Priorities\n| Priority | Owner | Due |\n|---|---|---|\n| Deliver written capacity review before any seat expansion | Tomas Lindqvist | 31 Oct 2026 |\n| Fix supervisor visibility of saved views (SUP-10014) | Tomas Lindqvist | 10 Oct 2026 |\n| Close SUP-9902 (fuel export stability) | Aoife Brennan | 15 Nov 2026 |\n| Commercial proposal: 500-seat banding + Freight Analytics | Priya Raghunathan | 14 Nov 2026 |\n| Hull depot enablement session | Priya Raghunathan | 28 Nov 2026 |\n| Confirm renewal position ahead of 60-day notice date | Priya Raghunathan | By 2 Dec 2026 |\n\n**Knowledge-base gaps (stated plainly):** no signed contract/order form on file; no Q2 2026 meeting notes (the Q2 review is referenced but absent); no commercial proposal document yet (scheduled); the most recent account profile predates this period (June 2025)."
    },
    {
      "slug": "emit-qbr",
      "phase_index": 4,
      "status": "completed",
      "phase_type": "llm_emit",
      "started_at": "2026-08-20T20:33:22.992190+00:00",
      "completed_at": "2026-08-20T20:34:02.848384+00:00",
      "step_count": 2,
      "step_noun": "fields",
      "deliverable_text": "Produced the filled deliverable: /Northwind-QBR-Template.docx"
    }
  ],
  "citations": {
    "gather-usage": [
      {
        "document_id": "c86576b5-b1bb-4397-a81c-68bfa3ea40af",
        "filename": "northwind-usage-q3-2026.md",
        "chunk_index": 0,
        "passage": "# Northwind Logistics — Product Usage, Q3 2026 (Jul–Sep)\n\n**Reporting period:** 1 July 2026 – 30 September 2026\n**Prepared by:** Customer Success Operations\n**Data source:** platform telemetry, extracted 2 October 2026\n\n## Headline adoption\n\n| Metric | Q2 2026 | **Q3 2026** | Change |\n|---|---|---|---|\n| Licensed seats | 605 | **605** | — |\n| Seats active in period | 388 | **412** | +24 |\n| **Seat utilisation** | 64%",
        "similarity": 0.752016105380209,
        "is_full_doc": false
      },
      {
        "document_id": "c86576b5-b1bb-4397-a81c-68bfa3ea40af",
        "filename": "northwind-usage-q3-2026.md",
        "chunk_index": 1,
        "passage": "active users (avg) | 271 | **309** | +38 |\n| Depot rollups generated | 1,044 | **1,187** | +143 |\n| Document searches | 22,410 | **31,668** | +41% |\n| Fuel reconciliation exports | 12 | **14** | +2 |\n\n## What moved\n\n**Document search grew 41% quarter on quarter** — the largest single jump since onboarding.\nIt follows the compliance training push Northwind ran in July, when 96 depot supervisors\nwere onboarded to the p",
        "similarity": 0.7220208005869179,
        "is_full_doc": false
      },
      {
        "document_id": "c86576b5-b1bb-4397-a81c-68bfa3ea40af",
        "filename": "northwind-usage-q3-2026.md",
        "chunk_index": 2,
        "passage": "rter against a theoretical 39 (13 weeks × 3 finance users). Finance continues to\nre-key part of the output into their own spreadsheet, which Tomas Lindqvist has flagged\nas a solvable integration gap.\n\n## Engagement quality\n\n- **NPS: 41** (up from 33 in Q2). 14 responses from 605 seats.\n- Average session length: 11 min 40 s.\n- Feature discovery: only **9%** of active users have opened the saved-views feature,\n  despit",
        "similarity": 0.7011513740153948,
        "is_full_doc": false
      },
      {
        "document_id": "c32a2e0d-9cbe-4dd1-8c18-495543f9e8e2",
        "filename": "northwind-account-profile.md",
        "chunk_index": 2,
        "passage": "l process every Monday.\n2. **Driver compliance document search** — tachograph records, licence checks, training certs.\n3. **Fuel reconciliation exports** — feeds their finance team's month-end close.\n\n## Deployment notes\n\n- Single tenant, EU-West region.\n- SSO via Azure AD, enforced since 11 June 2025.\n- Two integrations live: their TMS (Paragon) and their fuel card provider (Allstar).\n- The Freight Analytics module ",
        "similarity": 0.6079653381592505,
        "is_full_doc": false
      },
      {
        "document_id": "c32a2e0d-9cbe-4dd1-8c18-495543f9e8e2",
        "filename": "northwind-account-profile.md",
        "chunk_index": 0,
        "passage": "# Northwind Logistics — Account Profile\n\n**Account ID:** ACC-2291\n**Customer since:** 4 March 2024\n**Segment:** Mid-market — Transport & Logistics\n**Headquarters:** Leeds, United Kingdom\n**Employees:** ~1,900\n\n## Account team\n\n| Role | Person |\n|---|---|\n| Account Owner | **Priya Raghunathan** |\n| Solutions Architect | Tomas Lindqvist |\n| Support Lead | Aoife Brennan |\n| Executive Sponsor (Northwind side) | **Marcus ",
        "similarity": 0.5833899309421473,
        "is_full_doc": false
      },
      {
        "document_id": "c86576b5-b1bb-4397-a81c-68bfa3ea40af",
        "filename": "northwind-usage-q3-2026.md",
        "chunk_index": 0,
        "passage": "# Northwind Logistics — Product Usage, Q3 2026 (Jul–Sep)\n\n**Reporting period:** 1 July 2026 – 30 September 2026\n**Prepared by:** Customer Success Operations\n**Data source:** platform telemetry, extracted 2 October 2026\n\n## Headline adoption\n\n| Metric | Q2 2026 | **Q3 2026** | Change |\n|---|---|---|---|\n| Licensed seats | 605 | **605** | — |\n| Seats active in period | 388 | **412** | +24 |\n| **Seat utilisation** | 64%",
        "similarity": 0.6725903593356566,
        "is_full_doc": false
      }
    ],
    "gather-support": [
      {
        "document_id": "f6534185-5747-4caf-b731-37c4f873bdee",
        "filename": "northwind-support-q3-2026.md",
        "chunk_index": 0,
        "passage": "# Northwind Logistics — Support Summary, Q3 2026\n\n**Reporting period:** 1 July 2026 – 30 September 2026\n**Support Lead:** Aoife Brennan\n\n## Ticket volume\n\n| | Q2 2026 | **Q3 2026** |\n|---|---|---|\n| Tickets raised | 71 | **87** |\n| Resolved within SLA | 68 | **82** |\n| **SLA breaches** | 3 | **5** |\n| Median first response | 47 min | **38 min** |\n| Median time to resolve | 9h 05m | **7h 51m** |\n| Reopened tickets | 4",
        "similarity": 0.7193236431693747,
        "is_full_doc": false
      },
      {
        "document_id": "f6534185-5747-4caf-b731-37c4f873bdee",
        "filename": "northwind-support-q3-2026.md",
        "chunk_index": 1,
        "passage": "* |\n| Reopened tickets | 4 | **2** |\n\nResponse and resolution times both improved. Volume rose 23%, which tracks the 96 new\nsupervisor accounts onboarded in July rather than any decline in stability.\n\n## The incident that matters\n\n**INC-4471 — depot rollup generation unavailable, 12 August 2026.**\n\n- **Duration: 6 hours 12 minutes** (08:14–14:26 BST).\n- **Impact:** all seven depots; Monday operating packs delayed by ",
        "similarity": 0.6914575835657769,
        "is_full_doc": false
      },
      {
        "document_id": "f6534185-5747-4caf-b731-37c4f873bdee",
        "filename": "northwind-support-q3-2026.md",
        "chunk_index": 2,
        "passage": "perienced in 30 months as a customer,\nbut it landed on their single most business-critical workflow, on their busiest day of the\nweek. It is referenced in the Q3 QBR notes as their principal concern.\n\n## The four other SLA breaches\n\nAll four were Sev-3 documentation or how-to questions that aged past the 48-hour target\nduring the August holiday period. None had operational impact. Aoife Brennan has since\nadjusted hol",
        "similarity": 0.6579437812669292,
        "is_full_doc": false
      },
      {
        "document_id": "c86576b5-b1bb-4397-a81c-68bfa3ea40af",
        "filename": "northwind-usage-q3-2026.md",
        "chunk_index": 0,
        "passage": "# Northwind Logistics — Product Usage, Q3 2026 (Jul–Sep)\n\n**Reporting period:** 1 July 2026 – 30 September 2026\n**Prepared by:** Customer Success Operations\n**Data source:** platform telemetry, extracted 2 October 2026\n\n## Headline adoption\n\n| Metric | Q2 2026 | **Q3 2026** | Change |\n|---|---|---|---|\n| Licensed seats | 605 | **605** | — |\n| Seats active in period | 388 | **412** | +24 |\n| **Seat utilisation** | 64%",
        "similarity": 0.5919373709481046,
        "is_full_doc": false
      },
      {
        "document_id": "c86576b5-b1bb-4397-a81c-68bfa3ea40af",
        "filename": "northwind-usage-q3-2026.md",
        "chunk_index": 2,
        "passage": "rter against a theoretical 39 (13 weeks × 3 finance users). Finance continues to\nre-key part of the output into their own spreadsheet, which Tomas Lindqvist has flagged\nas a solvable integration gap.\n\n## Engagement quality\n\n- **NPS: 41** (up from 33 in Q2). 14 responses from 605 seats.\n- Average session length: 11 min 40 s.\n- Feature discovery: only **9%** of active users have opened the saved-views feature,\n  despit",
        "similarity": 0.5835340348805071,
        "is_full_doc": false
      },
      {
        "document_id": "f6534185-5747-4caf-b731-37c4f873bdee",
        "filename": "northwind-support-q3-2026.md",
        "chunk_index": 0,
        "passage": "# Northwind Logistics — Support Summary, Q3 2026\n\n**Reporting period:** 1 July 2026 – 30 September 2026\n**Support Lead:** Aoife Brennan\n\n## Ticket volume\n\n| | Q2 2026 | **Q3 2026** |\n|---|---|---|\n| Tickets raised | 71 | **87** |\n| Resolved within SLA | 68 | **82** |\n| **SLA breaches** | 3 | **5** |\n| Median first response | 47 min | **38 min** |\n| Median time to resolve | 9h 05m | **7h 51m** |\n| Reopened tickets | 4",
        "similarity": 0.6431431493060766,
        "is_full_doc": false
      }
    ],
    "gather-commercial": [
      {
        "document_id": "1ef08790-c1bb-44c1-b5ad-1e3156c21926",
        "filename": "northwind-commercials-renewal.md",
        "chunk_index": 0,
        "passage": "# Northwind Logistics — Commercials & Renewal Position\n\n**Last updated:** 2 October 2026\n**Owner:** Priya Raghunathan\n\n## Current contract\n\n| | |\n|---|---|\n| **Annual recurring revenue** | **£284,000** |\n| Contract start | 4 March 2024 |\n| Current term ends | **31 January 2027** |\n| Licensed seats | 605 |\n| Effective price per seat / year | £469 |\n| Payment terms | Annual, in advance |\n| Auto-renew | **No** — active ",
        "similarity": 0.7338767079267848,
        "is_full_doc": false
      },
      {
        "document_id": "1ef08790-c1bb-44c1-b5ad-1e3156c21926",
        "filename": "northwind-commercials-renewal.md",
        "chunk_index": 1,
        "passage": "s | 605 |\n| Effective price per seat / year | £469 |\n| Payment terms | Annual, in advance |\n| Auto-renew | **No** — active renewal required |\n| Notice period | 60 days (i.e. **by 2 December 2026**) |\n\n## Renewal risk assessment\n\n**Overall: AMBER.**\n\nThe account is not at risk of churn — operational dependency is deep and the Monday\noperating pack is now load-bearing for seven depots. The risk is **value compression**",
        "similarity": 0.7031534547406327,
        "is_full_doc": false
      },
      {
        "document_id": "1ef08790-c1bb-44c1-b5ad-1e3156c21926",
        "filename": "northwind-commercials-renewal.md",
        "chunk_index": 2,
        "passage": "current per-seat rate, ARR falls to **£234,500 — a £49,500 reduction**.\nGareth Pryce has stated an intent to test the market, which we should read as leverage\nrather than genuine displacement intent.\n\n## The expansion counter-position\n\n**Freight Analytics module — approximately £62,000 / year at Northwind's volume.**\n\nThis is the only live opportunity that grows the account. Qualification notes:\n\n- Marcus Feld asked ",
        "similarity": 0.6957502444512894,
        "is_full_doc": false
      },
      {
        "document_id": "1ef08790-c1bb-44c1-b5ad-1e3156c21926",
        "filename": "northwind-commercials-renewal.md",
        "chunk_index": 3,
        "passage": "ot\n  trust the current export would fail on first contact.\n\n**Net position if both land:** 500 seats + Freight Analytics ≈ **£296,500**, i.e. slightly\nup on today, with a materially stickier account.\n\n## Commercial recommendation\n\nLead with seat banding voluntarily rather than being asked for it. Offering a 500-seat band\nbefore finance demands it converts a concession into a gesture, and buys the room to attach\nFreig",
        "similarity": 0.6866127044441132,
        "is_full_doc": false
      },
      {
        "document_id": "650e0845-aab2-4c91-9fab-05bcbccee1c9",
        "filename": "northwind-qbr-notes-sept-2026.md",
        "chunk_index": 4,
        "passage": "ndqvist | 10 Oct 2026 |\n| 4 | Commercial proposal covering seat banding + Freight Analytics | Priya Raghunathan | 14 Nov 2026 |\n| 5 | Hull depot enablement session | Priya Raghunathan | 28 Nov 2026 |\n\n## Priya's own read, recorded after the meeting\n\n> The relationship is strong at operations level and genuinely at risk at finance level.\n> Marcus will advocate for renewal; Gareth will not block it but will squeeze it.",
        "similarity": 0.601285918867122,
        "is_full_doc": false
      },
      {
        "document_id": "650e0845-aab2-4c91-9fab-05bcbccee1c9",
        "filename": "northwind-qbr-notes-sept-2026.md",
        "chunk_index": 0,
        "passage": "# Northwind Logistics — QBR Preparation Notes, September 2026\n\n**Meeting:** Q3 2026 Quarterly Business Review\n**Date held:** 24 September 2026, Leeds (in person)\n**Attending (Northwind):** Marcus Feld (Ops Director), Sian Okoro (Head of Compliance),\nGareth Pryce (Finance Controller)\n**Attending (us):** Priya Raghunathan, Tomas Lindqvist",
        "similarity": 0.7908759209933592,
        "is_full_doc": false
      }
    ]
  },
  "citationTotals": {
    "gather-usage": 15,
    "gather-support": 20,
    "gather-commercial": 20
  },
  "files": [
    {
      "id": "33836a12-614b-447d-a5db-cceaabce7133",
      "path": "/Northwind-QBR-Template.docx",
      "size_bytes": 39204,
      "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "created_at": "2026-08-20T20:34:02.822289+00:00"
    }
  ]
}

const ANSWER_RUN: SketchRun = {
  "id": "13691156-773e-4c41-b301-f25369b770d7",
  "status": "completed",
  "created_at": "2026-08-20T18:14:22.425967+00:00",
  "updated_at": "2026-08-20T18:19:09.759148+00:00",
  "workflowName": "Doc Q&A (098 UAT — Weekly reports scoped)",
  "names": {
    "draft": "draft",
    "confirm": "confirm",
    "finalize": "finalize"
  },
  "phases": [
    {
      "slug": "draft",
      "phase_index": 0,
      "status": "completed",
      "phase_type": "llm_agent",
      "started_at": "2026-08-20T18:14:22.481228+00:00",
      "completed_at": "2026-08-20T18:15:04.731217+00:00",
      "step_count": 38,
      "step_noun": "sources",
      "deliverable_text": "I've gathered all the weekly report data from the knowledge base. Here's the **draft** summary, structured per the report template [1]. Please review and approve before I finalise the Word document.\n\n---\n\n# 📋 Weekly Report — DRAFT (Week of April 7–11, 2026)\n\n| Field | Value |\n|---|---|\n| Report Period | April 7 – April 11, 2026 |\n| Prepared By | AI Report System |\n| Date Prepared | 11/04/2026 |\n| Department | All Departments |\n| Reviewed By | Pending Review |\n| Report Status | **Draft** |\n\n## Section 1 — Executive Summary\nA strong week across product, revenue, and engineering. DAU grew 5.5% to 8,420 and MRR rose 4.9% to $284,500, driven by three new enterprise contracts [4]. Delivery momentum continued — API Gateway rate limiting shipped two weeks early and the Cloudflare CDN migration completed, cutting global latency from 210ms to 145ms [3][4]. The iOS release remains **at risk** with the App Store submission pushed to April 21 [3].\n\n## Section 2 — Metrics Table\n| Metric | Value | Change |\n|---|---|---|\n| Daily Active Users (DAU) | 8,420 | +5.5% ↑ |\n| Weekly Active Users (WAU) | 21,300 | +6.0% ↑ |\n| New Signups | 312 | +8.7% ↑ |\n| Churn Rate | 1.8% | -0.3% ↓ |\n| API Uptime | 99.94% | +0.07% ↑ |\n\n*(All figures from the business metrics document) [4]*\n\n## Section 3 — Completed This Week\n- Rate limiting middleware deployed to staging for API Gateway (handles 10,000 req/min) [3]\n- OAuth 2.0 token refresh flow implemented and unit tested (94% coverage) [3]\n- Push notification system integrated with Firebase for iOS [3]\n- Resolved App Store rejection — privacy manifest now Apple-compliant [3]\n- CDN migration to Cloudflare fully complete — global latency down from 210ms to 145ms [4]\n\n## Section 4 — In Progress\n- Alpha Dashboard redesign — migration in progress (ETA April 15) [3]\n- Dark mode implementation — 60% complete, blocked on design token finalization [3]\n- JWT validation service refactor — 70% complete [3]\n- Final QA pass on iPhone 15 Pro — 2 open bugs remaining [3]\n\n## Section 5 — Blockers\n| Description | Owner | Status |\n|---|---|---|\n| Design token finalization delayed — awaiting Brand team approval (requested April 8) | Sarah Mitchell | Open |\n| iPhone 15 Pro crash on startup when location permissions denied — fix in review | Priya Sharma | Open |\n| QA resource shared with Alpha Dashboard — capacity constraint | Priya Sharma | Open |\n\n*(Blockers pulled from all projects) [3]*\n\n## Section 6 — Decisions\n- Approved v3.0 Roadmap (F-01 to F-10); engineering kickoff April 14 [4]\n- Enterprise pricing increases from $2,500/mo to $3,200/mo from May 1 (existing customers grandfathered 12 months) [4]\n- Paused Android app development for Q2 [4]\n- Replaced Datadog with Grafana + Prometheus (saves ~$2,100/mo; migration target May 15) [4]\n- Also: dropped IE11 support; chose Recharts over Victory.js; iOS release pushed April 14 → April 21 [3]\n\n## Section 7 — Team Highlights\n- **New hires:** Omar Hassan joined Data Engineering (April 7); Lena Kovač starts April 14 as Product Designer [5]\n- **Recognition:** James Okafor nominated for Quarterly Excellence Award; Sarah Mitchell's team commended by the CTO after the April 9 stakeholder demo [5]\n- **Training:** 4 engineers completed AWS Solutions Architect certification (David Park, Aisha Nwosu, Carlos Mendez, Fatima Al-Rashid) [5]\n\n## Section 8 — Next Week Priorities\n- v3.0 engineering kickoff (April 14) [4]\n- iOS App Store submission preparation — release April 21 [3][4]\n- API Gateway load testing with k6 (April 14) [3]\n- Tom Reyes backfill job posting goes live (April 14) [4][5]\n\n## Section 9 — Sign-Off\n- Prepared by: AI Report System | Date: 11/04/2026\n- Reviewed by: **Pending Review** | Status: **Draft**\n\n---\n\n⚠️ **Notes for your approval:**\n- The template calls for exactly 5 metrics; I used DAU, WAU, New Signups, Churn Rate, and API Uptime per the skill config [2]. Other tracked metrics (session duration, NPS, support tickets, MRR) can be swapped in if preferred [4].\n- Section 4 (In Progress) has more than 4 candidate items — I selected the 4 most significant; I can add the remainder on request.\n- Blockers table is capped at 3 rows per the template; the API Gateway project reported no blockers [3].\n\n**Would you like to approve this draft as-is, or request changes** (e.g., different metrics, add/remove bullets, adjust wording)? Once you approve, I'll generate and finalise the Word document."
    },
    {
      "slug": "confirm",
      "phase_index": 1,
      "status": "completed",
      "phase_type": "llm_human_input",
      "started_at": "2026-08-20T18:15:04.764447+00:00",
      "completed_at": "2026-08-20T18:18:12.514106+00:00",
      "step_count": null,
      "step_noun": null,
      "deliverable_text": "Does this draft answer your question? Add any corrections."
    },
    {
      "slug": "finalize",
      "phase_index": 2,
      "status": "completed",
      "phase_type": "llm_single",
      "started_at": "2026-08-20T18:18:12.537917+00:00",
      "completed_at": "2026-08-20T18:19:09.727609+00:00",
      "step_count": null,
      "step_noun": null,
      "deliverable_text": "Approved with **one correction** before finalising:\n\n**Section 1 — Executive Summary:**  \nChange:\n\n> “API Gateway rate limiting shipped two weeks early”\n\nto:\n\n> “API Gateway rate limiting middleware was deployed to staging two weeks early”\n\nThis aligns Section 1 with Section 3, which correctly specifies the item was deployed to staging rather than shipped to production.\n\nEverything else is approved as-is. Please update that line, mark the report as **Final**, fill in the reviewer, and generate the Word document."
    }
  ],
  "citations": {
    "draft": [
      {
        "document_id": "ab31cc1a-203c-4092-b64f-2622169874a7",
        "filename": "weekly_report_structure.md",
        "chunk_index": 0,
        "passage": "# Weekly Report Template Structure\r\n\r\n## Placeholders Reference\r\n\r\nHEADER TABLE:\r\n{{report_subtitle}}\r\n{{report_period}}\r\n{{prepared_by}}\r\n{{date_prepared}}\r\n{{department}}\r\n\r\nSECTION 1 - Executive Summary:\r\n{{executive_summary}}\r\n\r\nSECTION 2 - Metrics Table (5 rows):\r\n{{metric_1_name}}, {{metric_1_value}}, {{metric_1_change}}\r\n{{metric_2_name}}, {{metric_2_value}}, {{metric_2_change}}\r\n{{metric_3_name}}, {{metric_3_",
        "similarity": 0.5788053979136989,
        "is_full_doc": false
      },
      {
        "document_id": "ecd36ab7-9225-4ef2-9271-5f9100f23d24",
        "filename": "SKILL_INSTRUCTIONS.md",
        "chunk_index": 2,
        "passage": "numbers, or table structure\n\n──────────────────────────────────────────\nSTEP 3 — FILL PLACEHOLDERS (strict rules)\n──────────────────────────────────────────\nMap KB content to placeholders as follows:\n\n{{report_subtitle}}     → \"Week of [Monday date] – [Friday date], [Year]\"\n{{report_period}}       → Same as subtitle\n{{prepared_by}}         → \"AI Report System\"\n{{date_prepared}}       → Today's date in DD/MM/YYYY form",
        "similarity": 0.5326549261045417,
        "is_full_doc": false
      },
      {
        "document_id": "ecd36ab7-9225-4ef2-9271-5f9100f23d24",
        "filename": "SKILL_INSTRUCTIONS.md",
        "chunk_index": 6,
        "passage": "aphs, replacements)\n\nfilename = f\"Weekly_Report_{datetime.now().strftime('%Y-%m-%d')}.docx\"\ndoc.save(f\"/sandbox/output/{filename}\")\nprint(f\"Report ready: {filename}\")\n─────────────────────────────────\n\n──────────────────────────────────────────\nSTEP 5 — CONFIRM OUTPUT\n──────────────────────────────────────────\nAfter the file is generated, tell the user:\n\"✅ Your weekly report is ready: [filename]\n Sections filled: Exe",
        "similarity": 0.4997442200167407,
        "is_full_doc": false
      },
      {
        "document_id": "ecd36ab7-9225-4ef2-9271-5f9100f23d24",
        "filename": "SKILL_INSTRUCTIONS.md",
        "chunk_index": 0,
        "passage": "# Weekly Report Writer — Skill Configuration\n\n## What to enter in the Skills UI\n\n---\n\n### Name\nWeekly Report Writer\n\n---\n\n### Description\nActivated when the user asks to generate, write, or create a weekly report, \nweekly status update, or weekly summary. Also activated when user says \n\"write my report\", \"generate this week's report\", or \"weekly update\".\n\n---\n\n### Instructions (copy this exactly into the Instructions",
        "similarity": 0.44047922729995626,
        "is_full_doc": false
      },
      {
        "document_id": "ab31cc1a-203c-4092-b64f-2622169874a7",
        "filename": "weekly_report_structure.md",
        "chunk_index": 1,
        "passage": "3 rows):\r\n{{blocker_1_desc}}, {{blocker_1_owner}}, {{blocker_1_status}}\r\n{{blocker_2_desc}}, {{blocker_2_owner}}, {{blocker_2_status}}\r\n{{blocker_3_desc}}, {{blocker_3_owner}}, {{blocker_3_status}}\r\n\r\nSECTION 6 - Decisions (bullets):\r\n{{decision_1}} through {{decision_4}}\r\n\r\nSECTION 7 - Team Highlights (bullets):\r\n{{team_highlight_1}} through {{team_highlight_3}}\r\n\r\nSECTION 8 - Next Week Priorities (bullets):\r\n{{prio",
        "similarity": 0.5699599891859118,
        "is_full_doc": false
      },
      {
        "document_id": "ecd36ab7-9225-4ef2-9271-5f9100f23d24",
        "filename": "SKILL_INSTRUCTIONS.md",
        "chunk_index": 3,
        "passage": "ng point.\n\nMetrics table (fill from the metrics/business document):\n{{metric_1_name}}  → \"Daily Active Users (DAU)\"\n{{metric_1_value}} → value from KB\n{{metric_1_change}} → change % with ↑ or ↓ symbol\n\n{{metric_2_name}}  → \"Weekly Active Users (WAU)\"  [continue same pattern]\n{{metric_3_name}}  → \"New Signups\"\n{{metric_4_name}}  → \"Churn Rate\"\n{{metric_5_name}}  → \"API Uptime\"\n\nCompleted items → pull from ALL projects",
        "similarity": 0.5447307112566814,
        "is_full_doc": false
      }
    ]
  },
  "citationTotals": {
    "draft": 38
  },
  "files": []
}

const FAILED_RUN: SketchRun = {
  "id": "d8f87920-108d-4337-a4d9-9074bb72aa10",
  "status": "failed",
  "created_at": "2026-08-15T14:10:12.135586+00:00",
  "updated_at": "2026-08-15T14:10:29.580218+00:00",
  "workflowName": "Quarterly Business Review — Northwind Logistics",
  "names": {
    "gather-usage": "Pull usage and adoption data",
    "gather-support": "Pull support history",
    "gather-commercial": "Pull commercial position and meeting notes",
    "synthesize": "Synthesize the QBR narrative",
    "emit-qbr": "Fill the QBR template"
  },
  "phases": [
    {
      "slug": "gather-usage",
      "phase_index": 0,
      "status": "failed",
      "phase_type": "llm_agent",
      "started_at": null,
      "completed_at": null,
      "step_count": null,
      "step_noun": null,
      "deliverable_text": null
    },
    {
      "slug": "gather-support",
      "phase_index": 1,
      "status": "pending",
      "phase_type": "llm_agent",
      "started_at": null,
      "completed_at": null,
      "step_count": null,
      "step_noun": null,
      "deliverable_text": null
    },
    {
      "slug": "gather-commercial",
      "phase_index": 2,
      "status": "pending",
      "phase_type": "llm_agent",
      "started_at": null,
      "completed_at": null,
      "step_count": null,
      "step_noun": null,
      "deliverable_text": null
    },
    {
      "slug": "synthesize",
      "phase_index": 3,
      "status": "pending",
      "phase_type": "llm_single",
      "started_at": null,
      "completed_at": null,
      "step_count": null,
      "step_noun": null,
      "deliverable_text": null
    },
    {
      "slug": "emit-qbr",
      "phase_index": 4,
      "status": "pending",
      "phase_type": "llm_emit",
      "started_at": null,
      "completed_at": null,
      "step_count": null,
      "step_noun": null,
      "deliverable_text": null
    }
  ],
  "citations": {},
  "citationTotals": {},
  "files": []
}

const CANCELLED_RUN: SketchRun = {
  "id": "c353ff78-1b7e-45c2-a5f8-2b10d9c3b77c",
  "status": "cancelled",
  "created_at": "2026-08-16T17:46:55.348645+00:00",
  "updated_at": "2026-08-16T17:47:05.303703+00:00",
  "workflowName": "Quarterly Business Review — Northwind Logistics",
  "names": {
    "gather-usage": "Pull usage and adoption data",
    "gather-support": "Pull support history",
    "gather-commercial": "Pull commercial position and meeting notes",
    "synthesize": "Synthesize the QBR narrative",
    "emit-qbr": "Fill the QBR template"
  },
  "phases": [
    {
      "slug": "gather-usage",
      "phase_index": 0,
      "status": "cancelled",
      "phase_type": "llm_agent",
      "started_at": null,
      "completed_at": null,
      "step_count": null,
      "step_noun": null,
      "deliverable_text": null
    },
    {
      "slug": "gather-support",
      "phase_index": 1,
      "status": "pending",
      "phase_type": "llm_agent",
      "started_at": null,
      "completed_at": null,
      "step_count": null,
      "step_noun": null,
      "deliverable_text": null
    },
    {
      "slug": "gather-commercial",
      "phase_index": 2,
      "status": "pending",
      "phase_type": "llm_agent",
      "started_at": null,
      "completed_at": null,
      "step_count": null,
      "step_noun": null,
      "deliverable_text": null
    },
    {
      "slug": "synthesize",
      "phase_index": 3,
      "status": "pending",
      "phase_type": "llm_single",
      "started_at": null,
      "completed_at": null,
      "step_count": null,
      "step_noun": null,
      "deliverable_text": null
    },
    {
      "slug": "emit-qbr",
      "phase_index": 4,
      "status": "pending",
      "phase_type": "llm_emit",
      "started_at": null,
      "completed_at": null,
      "step_count": null,
      "step_noun": null,
      "deliverable_text": null
    }
  ],
  "citations": {},
  "citationTotals": {},
  "files": []
}
export const SKETCH_RUNS: Record<ArmKey, SketchRun> = {
  both: BOTH_RUN,
  answer: ANSWER_RUN,
  failed: FAILED_RUN,
  cancelled: CANCELLED_RUN,
}

/** What each arm is FOR, shown in the sketch's own chrome so a viewer knows what they are looking at. */
export const ARM_LABEL: Record<ArmKey, string> = {
  both: "both — a file AND an answer",
  answer: "answer only — no file",
  failed: "neither — the run failed at step 1",
  cancelled: "neither — the run was cancelled at step 1",
}
