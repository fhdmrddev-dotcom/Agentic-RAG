/* Sketch 157/158/159 — shared realistic dataset.
   Grounded in the SHIPPED shapes:
     - phase glyphs = the 7 real phase_types (soulData.ts PHASE_GLYPHS):
       programmatic=gear, llm_single=memo, llm_agent=compass,
       llm_batch_agents=handshake, llm_human_input=raised-hand,
       llm_emit=package, external_action=outbox-tray
     - tier = STRICT 🔒 / MIDDLE ◐ / LOOSE ○ (deriveTier.ts TierId), DERIVED never stored
     - state = starter | published | draft (the three shipped shelves)
     - purpose = business_requirement (the soul's hero atom)
     - needs = entry input_keys
     - produces = soulDeliverable (file label, or "answer in chat")
   Names are real-shaped for an org-scale B2B tenant (Legal / HR / Finance /
   Compliance / Ops) — NOT lorem, NOT four seed demos. */

const GLYPH = {
  programmatic: "⚙️",
  llm_single: "📝",
  llm_agent: "🧭",
  llm_batch_agents: "🤝",
  llm_human_input: "✋",
  llm_emit: "📦",
  external_action: "📤",
};

const TYPE_WORD = {
  programmatic: "server step",
  llm_single: "AI writes",
  llm_agent: "AI researches",
  llm_batch_agents: "runs in parallel",
  llm_human_input: "waits for you",
  llm_emit: "produces a file",
  external_action: "sends outside",
};

const PROJECTS = [
  "Legal & Contracts",
  "People Ops",
  "Finance",
  "Risk & Compliance",
  "Customer Success",
  "(no project)",
];

const OWNERS = ["You", "D. Okafor", "M. Lindqvist", "R. Haddad", "S. Petrova", "T. Nakamura"];

/* base — 34 hand-written, realistic org workflows */
const BASE = [
  ["Vendor risk portfolio review", "Pull the latest vendor assessments, analyse each vendor, and render one cited risk report for the quarterly review.", "Risk & Compliance", "published", "STRICT", ["programmatic","llm_agent","llm_batch_agents","llm_emit"], ["kickoff_prompt"], "vendor-risk-review.docx", 4, "2 days ago", 61],
  ["Contract clause review", "Read an uploaded agreement and flag every clause that departs from our standard positions, with the source paragraph quoted.", "Legal & Contracts", "published", "STRICT", ["llm_agent","llm_human_input","llm_emit"], ["kickoff_prompt","contract_file"], "clause-review.docx", 7, "yesterday", 143],
  ["NDA turnaround", "Draft a counterparty NDA from our template and route it for a single legal sign-off.", "Legal & Contracts", "published", "MIDDLE", ["llm_single","llm_human_input","llm_emit"], ["counterparty_name"], "nda-draft.docx", 3, "4 hours ago", 208],
  ["DPA gap assessment", "Compare a supplier's data-processing addendum against GDPR Article 28 and list the gaps.", "Legal & Contracts", "published", "STRICT", ["llm_agent","llm_emit"], ["kickoff_prompt","contract_file"], "dpa-gaps.docx", 2, "last week", 34],
  ["Compliance gap report", "Assess our controls against the named framework and produce a gap report a regulator could read.", "Risk & Compliance", "starter", "STRICT", ["programmatic","llm_batch_agents","llm_emit"], ["framework"], "compliance-gaps.docx", 1, "—", 0],
  ["Risk register refresh", "Re-score every open risk from the latest incident data and re-issue the register.", "Risk & Compliance", "starter", "MIDDLE", ["programmatic","llm_single","llm_emit"], ["quarter"], "risk-register.xlsx", 1, "—", 0],
  ["Weekly status report", "Gather the week's activity and write the status note the leadership team reads on Monday.", "Customer Success", "starter", "LOOSE", ["llm_agent","llm_single"], ["week_of"], null, 1, "—", 0],
  ["SOC 2 evidence pull", "Collect the evidence artefacts for each in-scope control and package them for the auditor.", "Risk & Compliance", "published", "STRICT", ["programmatic","llm_batch_agents","llm_human_input","llm_emit"], ["audit_period"], "soc2-evidence.zip", 5, "3 days ago", 19],
  ["Incident post-mortem", "Reconstruct the incident timeline from the logs and draft a blameless post-mortem.", "Risk & Compliance", "published", "MIDDLE", ["llm_agent","llm_single","llm_emit"], ["incident_id"], "post-mortem.docx", 2, "last week", 27],
  ["Policy exception review", "Read an exception request, weigh it against policy, and record a reasoned decision.", "Risk & Compliance", "draft", "MIDDLE", ["llm_agent","llm_human_input"], ["request_id"], null, 1, "—", 0],
  ["Offer letter pack", "Assemble the offer letter, benefits summary and start-day checklist for a new hire.", "People Ops", "published", "MIDDLE", ["llm_single","llm_human_input","llm_emit"], ["candidate_name","role"], "offer-pack.docx", 6, "today", 312],
  ["Onboarding packet", "Build the first-week packet for a named role from the current handbook.", "People Ops", "published", "LOOSE", ["llm_agent","llm_emit"], ["role"], "onboarding.docx", 3, "yesterday", 96],
  ["Job description refresh", "Rewrite an ageing job description against the current levelling guide.", "People Ops", "published", "LOOSE", ["llm_single"], ["role"], null, 2, "5 days ago", 44],
  ["Performance review summary", "Summarise a review cycle's feedback into one calibrated narrative per person.", "People Ops", "draft", "MIDDLE", ["llm_batch_agents","llm_single"], ["cycle"], null, 1, "—", 0],
  ["Leaver offboarding checklist", "Produce the access-revocation and handover checklist for a departing employee.", "People Ops", "published", "MIDDLE", ["programmatic","llm_single","external_action"], ["employee_id"], null, 4, "2 days ago", 71],
  ["Headcount plan variance", "Compare approved headcount against actual hires and explain each variance.", "People Ops", "draft", "LOOSE", ["programmatic","llm_single"], ["quarter"], null, 1, "—", 0],
  ["Monthly close checklist", "Walk the close steps, flag anything unreconciled, and issue the close summary.", "Finance", "published", "STRICT", ["programmatic","llm_agent","llm_human_input","llm_emit"], ["period"], "close-summary.xlsx", 8, "today", 88],
  ["Expense policy audit", "Sample the month's expenses and flag every claim that breaches policy.", "Finance", "published", "STRICT", ["programmatic","llm_batch_agents","llm_emit"], ["month"], "expense-audit.xlsx", 3, "yesterday", 52],
  ["Budget variance narrative", "Explain each material budget variance in the language the board expects.", "Finance", "published", "MIDDLE", ["programmatic","llm_single","llm_emit"], ["period"], "variance.docx", 2, "last week", 39],
  ["Invoice dispute pack", "Assemble the evidence for a disputed invoice and draft the response.", "Finance", "draft", "MIDDLE", ["llm_agent","llm_emit"], ["invoice_id"], "dispute-pack.docx", 1, "—", 0],
  ["Procurement threshold check", "Check a purchase request against the approval matrix and route it.", "Finance", "published", "MIDDLE", ["programmatic","llm_human_input","external_action"], ["request_id"], null, 3, "3 days ago", 127],
  ["Revenue recognition memo", "Draft the rev-rec memo for a non-standard contract, citing the policy sections applied.", "Finance", "draft", "STRICT", ["llm_agent","llm_emit"], ["contract_id"], "revrec-memo.docx", 1, "—", 0],
  ["QBR narrative", "Turn the account's usage and support history into the quarterly business review story.", "Customer Success", "published", "LOOSE", ["llm_agent","llm_single","llm_emit"], ["account_id"], "qbr.pptx", 4, "yesterday", 63],
  ["Churn-risk brief", "Read the account's recent signals and write the save-play brief.", "Customer Success", "published", "MIDDLE", ["llm_agent","llm_single"], ["account_id"], null, 2, "today", 156],
  ["Escalation summary", "Summarise an escalation for the exec sponsor without losing the technical detail.", "Customer Success", "published", "LOOSE", ["llm_single"], ["ticket_id"], null, 1, "4 hours ago", 231],
  ["Renewal readiness check", "Assess whether an account is ready to renew and name what is missing.", "Customer Success", "draft", "MIDDLE", ["llm_agent","llm_human_input"], ["account_id"], null, 1, "—", 0],
  ["Customer reference request", "Draft and send the reference request once the account clears the criteria.", "Customer Success", "published", "LOOSE", ["llm_single","llm_human_input","external_action"], ["account_id"], null, 3, "last week", 22],
  ["RFP response draft", "Answer an RFP from our approved answer library and flag anything unanswered.", "(no project)", "published", "STRICT", ["programmatic","llm_batch_agents","llm_human_input","llm_emit"], ["rfp_file"], "rfp-response.docx", 6, "2 days ago", 47],
  ["Security questionnaire", "Fill a customer security questionnaire from our control documentation.", "(no project)", "published", "STRICT", ["llm_agent","llm_emit"], ["questionnaire_file"], "security-answers.xlsx", 3, "yesterday", 84],
  ["Board pack assembly", "Assemble the board pack sections from each function's latest inputs.", "(no project)", "draft", "MIDDLE", ["programmatic","llm_batch_agents","llm_emit"], ["meeting_date"], "board-pack.pptx", 1, "—", 0],
  ["Literature review", "Split a topic into subtopics, review each in parallel, and merge one integrated cited review.", "(no project)", "starter", "STRICT", ["programmatic","llm_batch_agents","llm_single"], ["topics"], null, 1, "—", 0],
  ["Meeting notes to actions", "Turn a meeting transcript into owned, dated actions.", "(no project)", "published", "LOOSE", ["llm_single"], ["transcript"], null, 1, "today", 402],
  ["Translation review", "Check a translated document against the source for meaning drift.", "(no project)", "draft", "LOOSE", ["llm_batch_agents","llm_single"], ["source_file"], null, 1, "—", 0],
  ["Data subject access request", "Locate every record for a named subject and produce the disclosure bundle.", "Legal & Contracts", "published", "STRICT", ["programmatic","llm_agent","llm_human_input","llm_emit"], ["subject_email"], "dsar-bundle.zip", 5, "last week", 12],
];

const REGIONS = ["EMEA", "AMER", "APAC", "UK", "DACH", "Nordics"];
const QUARTERS = ["FY25 Q1", "FY25 Q2", "FY25 Q3", "FY25 Q4", "FY26 Q1"];

function buildWorkflows(count) {
  const out = [];
  let i = 0;
  while (out.length < count) {
    const b = BASE[i % BASE.length];
    const cycle = Math.floor(i / BASE.length);
    let name = b[0];
    if (cycle === 1) name = b[0] + " — " + REGIONS[i % REGIONS.length];
    else if (cycle === 2) name = b[0] + " — " + QUARTERS[i % QUARTERS.length];
    else if (cycle >= 3) name = b[0] + " — " + REGIONS[(i + cycle) % REGIONS.length] + " " + QUARTERS[i % QUARTERS.length];
    out.push({
      id: "wf-" + i,
      name: name,
      purpose: b[1],
      project: b[2],
      state: cycle === 0 ? b[3] : (i % 5 === 0 ? "draft" : "published"),
      tier: b[4],
      phases: b[5],
      needs: b[6],
      produces: b[7],
      version: b[8],
      lastRun: cycle === 0 ? b[9] : (i % 3 === 0 ? "last week" : "never"),
      runs: cycle === 0 ? b[10] : Math.max(0, (b[10] - cycle * 17) | 0),
      owner: cycle === 0 ? (i % 3 === 0 ? "You" : OWNERS[i % OWNERS.length]) : OWNERS[i % OWNERS.length],
    });
    i++;
  }
  return out;
}

function chainHtml(phases, compact) {
  return phases
    .map(function (p, idx) {
      const arrow = idx > 0 ? '<span class="arrow">→</span>' : "";
      const label = compact ? "" : '<span class="pt">' + TYPE_WORD[p] + "</span>";
      return arrow + '<span class="ph t-' + p + '" title="' + TYPE_WORD[p] + '"><span class="pg">' + GLYPH[p] + "</span>" + label + "</span>";
    })
    .join("");
}

const TIER_GLYPH = { STRICT: "🔒", MIDDLE: "◐", LOOSE: "○" };
