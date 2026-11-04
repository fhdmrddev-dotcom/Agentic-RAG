/**
 * Phase 308-05 (HOOK-01, HOOK-04, HOOK-06; D-12, D-13, D-20, D-21, D-24, D-29, D-30) — the ONE
 * string home of Settings → Webhooks and Org admin → API keys → Webhooks.
 *
 * A TRUE LEAF: it imports nothing and exports one frozen object of strings. The components spell no
 * copy of their own, so the wording of both surfaces changes in one diff, and the suites sweep the
 * strings (never "enabled", "disabled", "rotated" or "revoked" on screen — an endpoint is turned on
 * and off, a secret is rolled).
 *
 * Source: 308-UI-SPEC §Copywriting Contract (the `webhooksCopy.ts` tables), copied verbatim. Keys
 * follow the spec's dotted names. Templates use `{slot}`s filled by the shipped `fillCopy` from
 * `apiKeys/apiKeysCopy.ts` — imported by the components, never re-declared here. "I've saved the
 * secret" is the 304 words, imported from `API_KEYS_COPY.once.done`, never retyped.
 */

export const WEBHOOKS_COPY = Object.freeze({
  tab: {
    title: "Webhooks",
    count: "{N} of 10",
    description:
      "Syrel tells your own systems when a run finishes, a run waits on you, or a document is ingested. Each message is signed and carries ids, a status and a link — never document text.",
    scope: "Endpoints in {org}. Each one gets events from {org} only.",
    add: "Add endpoint",
    capReached: "You have 10 endpoints in {org}, the most allowed. Delete one to add another.",
    loading: "Loading your webhooks…",
    loadFailed: "Couldn't load your webhooks.",
    retry: "Retry",
    empty: "No endpoints yet. Add an https address your system listens on, pick the events, and send a test.",
    otherOrg: "The endpoint Syrel turned off is in {org}.",
    switchTo: "Switch to {org}",
    deletedReceipt: "✎ {host} deleted · recorded",
  },

  status: {
    on: "On",
    offFailing: "Off — kept failing",
    offGone: "Off — the receiver said it is gone",
    offAdmin: "Off — turned off by an org admin",
    off: "Off",
    offOwnerRemoved: "Off — the owner left {org}",
  },

  meta: {
    lastDelivered: "Last delivered {time}",
    nothingYet: "Nothing delivered yet",
    turnedOff: "Turned off {time}",
  },

  notice: {
    failing:
      "Turned off after 5 deliveries in a row failed. Fix the receiver, then turn it back on. Nothing is sent while it is off.",
    gone: "The receiver answered 410 Gone, so Syrel stopped sending. Turn it back on only if the address is live again.",
    admin: "Turned off by an org admin. Ask them to turn it back on.",
    self: "Off. Nothing is sent and new events for it are not kept. Turn it on to start again.",
  },

  act: {
    test: "Send test",
    testing: "Sending…",
    testOffWhy: "Turn the endpoint on to send a test.",
    roll: "Roll secret",
    off: "Turn off",
    on: "Turn on",
    edit: "Edit",
    delete: "Delete",
    onAdminWhy: "Only an org admin can turn this back on.",
    /** `{verb}`: turn off / turn on. */
    failed: "Couldn't {verb} the endpoint. {detail} Nothing changed.",
    verbOff: "turn off",
    verbOn: "turn on",
  },

  aria: {
    test: "Send a test to {host}",
    roll: "Roll the secret for {host}",
    off: "Turn off {host}",
    on: "Turn on {host}",
    edit: "Edit {host}",
    delete: "Delete {host}",
    toggle: "{host}",
  },

  receipt: {
    off: "✎ Turned off · recorded",
    on: "✎ Turned on · recorded",
    edited: "✎ Changes saved · recorded",
    rolled: "✎ Secret rolled · recorded",
  },

  verdict: {
    ok: "Delivered — your receiver answered {code} in {latency}. It is in the log below.",
    http: "Your receiver answered {code} in {latency}, so the test counts as failed. It is in the log below.",
    timeout: "Your receiver didn't answer within 10 seconds. It is in the log below.",
    connect: "Syrel couldn't connect to your receiver. It is in the log below.",
    refused: "That address can't be reached from the internet, so Syrel won't send to it.",
    rateLimited: "You've sent several tests in a row. Try again in a minute.",
    failed: "Couldn't send the test. {detail}",
    whereLog: "It is in the log below.",
    whereOnce: "It is in this endpoint's log.",
  },

  form: {
    titleAdd: "Add an endpoint",
    titleEdit: "Edit endpoint",
    address: "Address",
    addressHint: "https only. Must be reachable from the internet.",
    addressPlaceholder: "https://hooks.example.com/syrel",
    events: "Events",
    ev: {
      finished: "A run you started finished, failed or was stopped.",
      waiting: "A run you started is waiting on a person in the app.",
      ingested: "A document you can see finished ingesting.",
    },
    description: "Description",
    descriptionHint: "Optional, for you. Up to 100 characters.",
    descriptionPlaceholder: "e.g. Ops alerts",
    counter: "{n}/100",
    save: "Save endpoint",
    saveEdit: "Save changes",
    saving: "Checking the address…",
    discard: "Discard",
    discardEdit: "Discard changes",
    needAddress: "Enter the address your system listens on.",
    needEvent: "Pick at least one event.",
    notUrl: "That isn't a web address.",
    userinfo: "Take out the name and password before the @. If your receiver needs a token, put it in the query instead.",
    fragment: "Take out the part after #.",
    refused: "That address can't be reached from the internet, so Syrel won't send to it.",
    noCipher:
      "This Syrel deployment can't store a signing secret yet, so it can't add webhooks. Ask the person who runs it to set up secret encryption.",
    saveFailed: "Couldn't save the endpoint. {detail} Your changes are kept; try again.",
  },

  once: {
    title: "Signing secret — shown once",
    warning: "⚠ Copy it into your receiver now. Syrel can't show it again; roll it to get a new one.",
    warningRoll: "⚠ Copy the new secret into your receiver now. Syrel can't show it again.",
    overlap:
      "Until {time}, every message carries both the old and the new signature, so your receiver keeps working while you swap it in.",
    copySecret: "Copy the signing secret",
    how: "How to check the signature",
    python: "Python",
    node: "Node",
    copyPython: "Copy the Python check",
    copyNode: "Copy the Node check",
    rawBody: "Check the raw body exactly as it arrived. Parsing the JSON first changes the bytes and the check fails.",
    dedupe: "Retries and resends reuse the same webhook-id, so ignore an id you have already handled.",
  },

  roll: {
    title: "Roll the signing secret?",
    sub: "A new secret is made and shown once. For the next 24 hours every message carries both signatures, so your receiver keeps working while you swap it in.",
    factAfter: "After 24 hours the old secret stops working.",
    factAgain: "Rolling again within 24 hours ends the current overlap early.",
    factOverlapNow:
      "A roll from {time} is still in its overlap. Rolling now ends it, and the secret before that stops working at once.",
    kept: "Deliveries keep flowing; nothing is paused.",
    keep: "Keep this secret",
    confirm: "Roll secret",
    busy: "Rolling…",
    failed: "Couldn't roll the secret. {detail} The current secret still works.",
  },

  del: {
    title: "Delete this endpoint?",
    factPending: "Pending and retrying deliveries to it are dropped.",
    factLog: "Its delivery log is deleted.",
    kept: "Your other endpoints are not touched.",
    keep: "Keep it",
    confirm: "Delete endpoint",
    busy: "Deleting…",
    failed: "Couldn't delete the endpoint. {detail} It is still there.",
  },

  keptMark: "✓",

  log: {
    title: "Deliveries",
    refresh: "Refresh",
    refreshAria: "Refresh deliveries for {host}",
    col: {
      event: "Event",
      about: "About",
      status: "Status",
      tries: "Tries",
      http: "HTTP",
      latency: "Latency",
      when: "When",
      resend: "Resend",
    },
    aboutRun: "run {id}…",
    aboutDoc: "document {id}…",
    aboutTest: "test",
    aboutGone: "no longer visible",
    st: {
      pending: "Queued",
      sending: "Sending",
      retrying: "Retrying",
      sent: "Sent",
      failed: "Failed",
      redaction: "Not sent — the redaction check failed",
      skippedOff: "Not sent — endpoint off",
      skippedHidden: "Not sent — you can no longer see it",
      notSent: "Not sent",
    },
    err: {
      timeout: "timed out",
      connect: "no connection",
      tls: "TLS error",
      refused: "address refused",
      redirect: "redirect refused",
      other: "error",
    },
    none: "—",
    next: "{time} · next {next}",
    ms: "{n} ms",
    s: "{n} s",
    resend: "Resend",
    resending: "Resending…",
    resendAria: "Resend this {event} delivery",
    resendOff: "Resend works when the endpoint is on.",
    resendRefused: "You've resent several deliveries in a row. Try again in a minute.",
    older: "Show older",
    footnote: "Shows the receiver's status code and how long it took. The reply itself is never stored.",
    loading: "Loading deliveries…",
    loadFailed: "Couldn't load deliveries.",
    empty: "No deliveries yet. Send a test, or wait for an event you picked.",
  },

  admin: {
    heading: "Webhooks in {org}",
    count: "{N} endpoint(s) · {M} member(s)",
    description:
      "Every webhook endpoint a member of {org} has added. Turning one off stops its deliveries; only an admin can turn it back on. Addresses show the host only — the path and query may hold a receiver's password.",
    col: {
      owner: "Owner",
      address: "Address",
      events: "Events",
      status: "Status",
      last: "Last delivered",
      failed: "Failed in a row",
    },
    you: "(you)",
    never: "Never",
    // CR-01 / D-59: the address cell names what it hides; it never shows a path.
    pathHidden: "path hidden",
    queryHidden: "query hidden",
    pathQueryHidden: "path and query hidden",
    off: "Turn off",
    on: "Turn on",
    delete: "Delete",
    offAria: "Turn off {owner}'s endpoint {host}",
    onAria: "Turn on {owner}'s endpoint {host}",
    deleteAria: "Delete {owner}'s endpoint {host}",
    receiptOff: "✎ You turned off {owner}'s endpoint {host} · recorded",
    receiptOn: "✎ You turned on {owner}'s endpoint {host} · recorded",
    receiptDeleted: "✎ You deleted {owner}'s endpoint {host} · recorded",
    loading: "Loading the org's webhooks…",
    loadFailed: "Couldn't load the org's webhooks.",
    empty: "No webhook endpoints in {org}.",
    delTitle: "Delete {owner}'s endpoint?",
    delFactStops: "{owner}'s system stops getting events from {org}.",
    delFactLog: "Pending deliveries and the log are deleted.",
    delFactSees: "{owner} sees it gone; the audit log records you.",
    delKept: "{owner}'s other endpoints and orgs are not touched.",
    unknownOwner: "A former member",
  },
} as const)
