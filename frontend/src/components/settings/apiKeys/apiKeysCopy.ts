/**
 * Phase 293-04 (START-02) — the ONE string home of the API keys surfaces: Settings → API keys
 * (member), the revoke sheet, Org admin → API keys, the workflow card's ⋯ menu item, and the
 * activity words for every call a key makes.
 *
 * A TRUE LEAF: it imports nothing and exports only strings and string-builders (the
 * `runLogVocabulary.ts` rule). The components spell no copy of their own, so the wording of this
 * whole surface changes in one diff, and the suites can sweep the `.tsx` files for stray literals.
 *
 * Source: 293-UI-SPEC §Copywriting Contract (Surfaces 1, 2, 3) and §"Activity reasons", copied
 * verbatim. The few sentences the spec did not write are marked `293-04 authored` below, in the
 * house voice, and recorded in the plan SUMMARY.
 *
 * Templates use `{name}` slots and `(s)` for a plural that follows the count, filled by
 * `fillCopy` (the `retentionCopy.ts` builder, re-declared here so this module stays a leaf).
 */

export type CopyVars = Record<string, string | number | null | undefined>

/** Fill `{slot}`s from `vars`; `(s)` becomes "" when `count` (or `vars.N`) is 1, else "s".
 *  A slot with no value is left as written, so a missing fact is visible, never blank. */
export function fillCopy(template: string, vars: CopyVars = {}, count?: number): string {
  const n = count ?? (typeof vars.N === "number" ? vars.N : undefined)
  return template
    .replace(/\(s\)/g, n === 1 ? "" : "s")
    .replace(/\{([^}]+)\}/g, (whole, key: string) => {
      const v = vars[key]
      return v === null || v === undefined ? whole : String(v)
    })
}

export const API_KEYS_COPY = {
  tab: {
    label: "API keys",
    title: "API keys",
    description:
      "Let another system start your published workflows and read the result. Each key starts only the workflows you pick, and its runs run as you.",
    limits: "Each key: {starts} starts and {reads} status reads a minute. Set by your operator.",
    loading: "Loading your keys…",
    loadFailed: "Couldn't load your API keys.",
    retry: "Retry",
    newKey: "New key",
    empty:
      "No keys yet. A key lets another system, such as n8n, a script or a scheduler elsewhere, start one of your published workflows and read its result.",
  },

  draft: {
    titlePlaceholder: "New key",
    tag: "draft · not created",
    fromMenu: "From the ⋯ menu of {workflow}. It is already picked.",
    fromMenuFile: "From the ⋯ menu of {workflow}. It needs a file upload, so a key can't start it yet.",
    labelField: "Label",
    labelPlaceholder: "e.g. n8n-prod",
    labelHint: "Shown in activity and the audit log. The secret never is.",
    workflowsField: "Workflows",
    workflowsHint: "Only published workflows are listed. {N} drafts are hidden until they are published.",
    workflowsHintNone: "Only published workflows are listed.",
    workflowsHintOne: "Only published workflows are listed. 1 draft is hidden until it is published.",
    workflowsLoading: "Loading your published workflows…",
    workflowsFailed: "Couldn't load your published workflows.",
    noInputs: "no inputs",
    fileUpload: "needs a file upload, not possible with a key yet",
    /** 293-04 authored: a non-file reason the server sent for a row that cannot be picked. */
    cannotPick: "can't be started with a key",
    noWorkflows: "You have no published workflows yet. Publish one on the Workflows page, then make a key for it.",
    expiresField: "Expires",
    expiresOptions: { 30: "30 days", 90: "90 days", 365: "365 days", never: "Never" },
    expiresHint: "You can revoke it any time before then.",
    expiresHintNever: "It works until you revoke it.",
    runsAsLead: "Runs started with this key ",
    runsAsBold: "run as you",
    runsAsTail:
      ": they search the folders you can search and appear in your chat history, one thread per run. Anyone holding the key can start the workflows above.",
    needLabel: "Add a label.",
    needWorkflow: "Pick at least one workflow.",
    create: "Create key",
    creating: "Creating…",
    discard: "Discard draft",
    createFailed: "Couldn't create the key. {sentence} Your choices are kept; try again.",
  },

  once: {
    tag: "● created",
    warning:
      "⚠ Copy the secret now. It is not stored and can't be shown again; if you lose it, revoke the key and make a new one.",
    copy: "Copy",
    copied: "✓ Copied",
    copyFailed: "Copy failed",
    copyFailedLine: "Couldn't copy. Select the text and copy it yourself.",
    copySecretLabel: "Copy the secret",
    copyStartLabel: "Copy the start command",
    copyStatusLabel: "Copy the status command",
    copiedAnnounce: "Copied.",
    startHeader: "Start {workflow}",
    startHeaderMore: "Start {workflow} (the other {N} work the same way)",
    statusHeader: "Read its status and result (poll until it finishes)",
    sample: "What a status read returns",
    done: "I've saved the secret",
    guide: "Guide: start a workflow from outside ↗",
    guideHref: "/docs/api/guides/start-a-workflow-from-outside",
  },

  card: {
    tagActive: "● active",
    tagRefused: "⚠ {N} workflow(s) refused",
    tagExpired: "expired",
    tagRevoked: "revoked",
    chipUnpublished: "⚠ {workflow} · no longer published",
    lineUnpublished: "{workflow} was unpublished, so calls to it are refused. Publish it again, or make a key without it.",
    chipDeleted: "⚠ {workflow} · deleted",
    lineDeleted: "{workflow} was deleted, so calls to it are refused. Make a key without it.",
    /** 293-04 authored: the owner can no longer run it (server state `cannot_run`). */
    chipCannotRun: "⚠ {workflow} · can't be run",
    lineCannotRun: "{workflow} can no longer be run by this key's owner, so calls to it are refused. Make a key without it.",
    /** 293-04 authored: it gained a file input after the key was made (server state `file_upload`). */
    chipFileUpload: "⚠ {workflow} · needs a file upload",
    lineFileUpload: "{workflow} now needs a file upload, which a key can't send, so calls to it are refused. Make a key without it.",
    metaOwner: "owner ",
    metaYou: " (you)",
    metaExpires: "expires ",
    metaLastUsed: "last used ",
    metaCreated: "created ",
    never: "never",
    neverExpires: "never expires",
    neverUsed: "never used",
    inDays: "in {N} day(s)",
    expiredDaysAgo: "expired {N} day(s) ago",
    expiredToday: "expired today",
    today: "today",
    revoke: "Revoke",
    revokeAria: "Revoke {label}",
    receiptYou: "✎ Revoked by you · {date} · recorded",
    receiptAdmin: "✎ Revoked by {name}, an admin · {date} · recorded",
    /** 293-04 authored: an admin reading a key its own owner revoked. */
    receiptOwner: "✎ Revoked by {name} · {date} · recorded",
    showActivity: "Show activity",
    hideActivity: "Hide activity",
  },

  strip: {
    caption: "last {N} call(s) · ",
    legendStart: "start",
    legendRead: "read",
    legendRefused: "refused",
    tapOne: " · tap one",
    noCalls: "no calls yet",
    groupLabel: "Recent calls with {label}",
  },

  activity: {
    header: "Recent calls · last used {when}",
    auditLink: "All in the audit log →",
    noCalls: "No calls yet. The first start will show here.",
    noCallsRevoked: "Revoked before any calls in the last 30 days.",
    colTime: "Time",
    colVerb: "Call",
    colWorkflow: "Workflow",
    colRun: "Run",
    colResult: "Result",
    run: "run {id}",
    noRun: "no run",
    noWorkflow: "—",
    separator: " · ",
  },

  sheet: {
    title: "Revoke {label}?",
    subOwn: "The next call with this key is refused.",
    subAdminLead: "This key belongs to ",
    subAdminTail: ". They will see that an admin revoked it.",
    factStarts: "Starts ",
    factAnd: " and ",
    factLastUsed: "Last used ",
    factCalls: " · {N} call(s) in the last 30 days",
    factOwner: "Owner ",
    factCreated: " · created {date}",
    unknownOwner: "an unknown member",
    keptLive:
      "Run {id} started with this key keeps going in the app, but the outside system can no longer read its result. Revoking can't be undone; a replacement is a new key with a new secret.",
    keptOther:
      "Runs already started keep their records in the app. Revoking can't be undone; a replacement is a new key with a new secret.",
    confirm: "Revoke {label}",
    keep: "Keep it",
    busy: "Revoking…",
    failed: "Couldn't revoke {label}. {detail} The key still works.",
  },

  admin: {
    tabLabel: "API keys",
    title: "API keys · whole organisation",
    description: "Every key in {org}. Runs started with a key run as the member who made it.",
    descriptionNoOrg: "Every key in this organisation. Runs started with a key run as the member who made it.",
    note: "You can see and revoke every member's keys. You can't see their secrets; nobody can.",
    empty: "No member of {org} has made an API key yet.",
    emptyNoOrg: "No member of this organisation has made an API key yet.",
    loading: "Loading the organisation's keys…",
    loadFailed: "Couldn't load the organisation's keys.",
  },

  menu: {
    newApiKey: "New API key…",
  },

  /** The "✓ …" and "✕ refused: …" words of a call (UI-SPEC §"Activity reasons"). */
  calls: {
    ok: "✓ {words}",
    refused: "✕ refused: {words}",
    refusedBare: "✕ refused",
    started: "started",
    running: "running",
    runningStep: "running · step {i} of {n}",
    waiting: "waiting for a person",
    waitingWho: "waiting for a person · {name}",
    paused: "paused",
    finished: "finished",
    finishedFiles: "finished · {N} file(s)",
    failed: "failed",
    stopped: "stopped",
    /** 293-04 authored: a read whose status the audit row did not record. */
    read: "read",
    revoked: "key revoked on {date}",
    revokedNoDate: "key revoked",
    expired: "key expired on {date}",
    expiredNoDate: "key expired",
    notMember: "{owner} is no longer a member of {org}",
    ownerFallback: "the key's owner",
    orgFallback: "this organisation",
    /** 293-04 authored: the owner's account is banned (reason `banned`). */
    banned: "{owner} is suspended from {org}",
    notOnKey: "not found: that workflow is not on this key",
    runNotFound: "not found: this key did not start that run",
    unpublished: "workflow is no longer published",
    cannotRun: "{owner} can no longer run this workflow",
    entitlement: "your organisation's plan doesn't include workflow runs",
    unknownInput: "unknown input: {names}",
    unknownInputBare: "unknown input",
    missingInput: "missing required input: {names}",
    missingInputBare: "missing required input",
    fileUpload: "needs a file upload, not possible with a key yet",
    /** 293-04 authored: the body was not a JSON object of text values (reason `invalid_body`). */
    invalidBody: "the inputs were not a JSON object of text values",
    /** 293-04 authored: the workflow's template is not bound yet (the scheduler's lint refusal). */
    noTemplate: "the workflow has no template set up yet",
    /** 293 UAT: the operator's Workflows kill switch is off (reason `workflows_disabled`, CR-01). */
    workflowsDisabled: "workflows are turned off by the administrator",
    /** 293 UAT: the limiter could not be reached, so the call was refused (reason `limiter_unavailable`). */
    limiterUnavailable: "the limit check was unavailable; try again shortly",
    overStarts: "over the limit: {N} starts a minute",
    overReads: "over the limit: {N} reads a minute",
    overBare: "over the limit",
  },

  /** 293-03 (D-14 / UI-SPEC Surface 6): the operator's per-key limits card in Settings →
   *  Integrations, verbatim from §"Rate limit control (operator)". */
  limits: {
    title: "API keys",
    description:
      "Limits for calls from other systems. Each key gets its own allowance; a call over it is refused and told when to try again.",
    startsLabel: "Starts per minute, per key",
    startsHint: "Default 10.",
    readsLabel: "Status reads per minute, per key",
    readsHint: "Default 120.",
    footer: "Applies to every key once you click Save Integrations.",
    loadFailed: "Couldn't load the current API key limits, so they can't be changed here right now.",
    retry: "Retry",
  },

  /** Date words for the en-GB formatting in `apiKeyFacts.ts` (it spells no string itself). */
  dates: {
    weekdays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
    yesterday: "Yesterday {time}",
  },
} as const
