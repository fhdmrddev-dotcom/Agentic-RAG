/**
 * Phase 307-03 (OAUTH-04; UI-SPEC §"New oauthCopy.ts — consent" and §1b) — every word the consent
 * page says. An import-free leaf: it imports NOTHING, so any file may read it and no test has to mock
 * it. `{name}` slots are filled by `fillCopy` (`apiKeysCopy.ts`); `(s)` pluralises on `{N}`.
 *
 * ⚠ The 304 sentences the page reuses (a switched-off org, a switched-off deployment, the four Allow
 *   blockers) are NOT retyped here: the components read them from `MCP_KEY_COPY`, their one home.
 *
 * ⚠ SECURITY DECISION (307-03, recorded for /gsd:secure-phase; T-307-07 / D-35). The UI-SPEC's
 *   `why.dcrSeeded` row omitted the clause "Only allow it if you just started connecting from {host}."
 *   It is appended to EVERY web why-line here — DCR on the seeded host, DCR on any other host, and
 *   CIMD. The seeded claude.ai / claude.com host is precisely the realistic consent-phishing case: any
 *   client can self-register with claude.ai's redirect and a convincing name, and a victim sent the
 *   authorize link would otherwise read only reassurance. The clause costs one sentence and names the
 *   one check the member can actually make.
 */
export const OAUTH_COPY = {
  consent: {
    tabTitle: "Connect an app · Syrel",
    title: "Connect an app",
    subhead: "An app wants to use Syrel as you.",
    callsItself: "calls itself",
    tagVerified: "verified",
    tagUnchecked: "name not checked",
    tagThisComputer: "this computer",
    publishedAt: "Details published at {host}",
    why: {
      loopback:
        "It will send you back to an app on this computer. Only allow it if you just started connecting in Claude Code or another tool yourself.",
      cimd: "Its details are published by {publisher}, so this name belongs to that address. Only allow it if you just started connecting from {host}.",
      dcrSeeded:
        "This app registered itself, so Syrel can't check its name. It will send you back to {host}, which this deployment allows. Only allow it if you just started connecting from {host}.",
      dcrOther:
        "This app registered itself, so Syrel can't check its name. It will send you back to {host}, which this deployment allows. Only allow it if you just started connecting from {host}.",
    },
    signingInAs: "Signing in as {email}",
    otherAccount: "Use another account",
    orgField: "Organisation",
    summary:
      "This app will {can} in {where}, as you. {cannot} It stops working if you leave {org}, and you can disconnect it any time in Settings → API keys.",
    can: {
      read: "search and read",
      ask: "search, read and ask the agent",
      run: "search, read, ask the agent and run your published workflows",
      custom: "use {N} tool(s)",
    },
    where: {
      all: "everything you can see in {org}",
      only: "{N} folder(s) in {org}",
      noExternal: ", not mail or synced sources",
      external: ", including mail and synced sources",
    },
    cannot: {
      read: "It can't ask the agent or run workflows.",
      ask: "It can't run workflows.",
    },
    deny: "Deny access",
    allow: "Allow access",
    connecting: "Connecting…",
    goingBack: "Going back…",
    needOrg: "MCP access is switched off in every organisation you belong to. Ask an admin to switch it on.",
    fine: "Allowing sends you back to {host}. If this app isn't used for 90 days, it disconnects itself. Syrel never shows the app your password.",
    fineLoopback:
      "Allowing sends you back to the app on this computer. If this app isn't used for 90 days, it disconnects itself. Syrel never shows the app your password.",
    loading: "Loading the sign-in request…",
    loadFailed: "Couldn't load this sign-in request. Check your connection and try again.",
    tryAgain: "Try again",
    submitFailed: "Couldn't finish connecting the app. {detail} Your choices are kept; try again.",
    done: {
      title: "Connected",
      subhead: "Taking you back to {host}…",
      subheadLoopback: "Taking you back to the app on this computer…",
      body: "If nothing happens in a few seconds, close this tab and go back to the app.",
      undo: "Disconnect it any time in Settings → API keys → Connected apps.",
    },
    denied: {
      title: "Not connected",
      subhead: "Taking you back to {host}…",
      subheadLoopback: "Taking you back to the app on this computer…",
      body: "The app gets no access to Syrel.",
    },
    expired: {
      title: "This sign-in request has expired",
      subhead: "Nothing was connected.",
      body: "Sign-in requests work once and only for a few minutes. Go back to the app and start connecting again.",
    },
    refused: {
      title: "This app can't sign in here",
      subhead: "You have not been sent anywhere.",
      hostNotAllowed: "It asked to send you back to {host}, which this Syrel deployment doesn't allow.",
      hostNotAllowedHelp:
        "If you expected this to work, ask the person who runs this Syrel deployment to allow {host} in Control Room → AI tool sign-in.",
      notRegistered: "It asked to send you back to an address it didn't register, so Syrel won't send you there.",
      unknownClient: "Syrel doesn't know this app. Go back to it and connect again; it will register itself.",
      metadataUnreadable: "Syrel couldn't read this app's published details at {host}. Try connecting again in a minute.",
      /** A host the server could not name (an unparseable redirect). */
      unknownHost: "an address it didn't name",
    },
    deploymentOff: {
      title: "AI tool access is switched off",
      subhead: "Nothing was connected.",
    },
    goBack: "Go back to the app",
    framed: {
      title: "This page can't be shown here",
      subhead: "Open it in its own tab.",
      body: "For your safety, Syrel's sign-in page only works in its own browser tab.",
    },
  },

  // ── 307-05 (UI-SPEC §"connected apps (member and admin)"). An app is connected and disconnected;
  //    "Revoke" stays the verb for keys only (A-23). `notUsedYet` is read from MCP_KEY_COPY. ──
  apps: {
    title: "Connected apps",
    description:
      "Apps you signed in to with your Syrel account, such as Claude.ai, Claude Desktop or Claude Code. Each one acts as you, only in the organisation, folders and tools you picked. Disconnect one and its next call is refused.",
    addressLead: "To connect one, add Syrel as a custom connector with this address:",
    copyAddress: "Copy the connector address",
    loading: "Loading your connected apps…",
    loadFailed: "Couldn't load your connected apps.",
    retry: "Retry",
    empty:
      "No apps connected. When you add Syrel as a connector in Claude.ai, Claude Desktop or Claude Code and sign in, the app shows up here with what it can reach and a Disconnect button.",
    disconnect: "Disconnect",
    disconnectAria: "Disconnect {name} ({host})",
    metaActsIn: "acts in {org}",
    metaConnected: "connected {date}",
    metaLastUsed: "last used {time}",
    metaLapses: "disconnects itself if unused by {date}",
    receipt: "✎ {name} ({host}) disconnected · recorded",
    chipConnectedApp: "Connected app",
    metaOwner: "owner {name}",
    /** 307-05 authored: a grant whose redirect host the server could not parse. */
    unknownHost: "an unknown address",
    metaSep: " · ",
  },
  sheet: {
    title: "Disconnect {name} ({host})?",
    subOwn: "Its next call to Syrel is refused. To use it again, add Syrel in the app and sign in again.",
    subAdmin: "This disconnects {owner}'s app. Its next call to Syrel is refused.",
    factOrg: "Acts in {org}",
    factReach: "Can use {tools} on {folders}",
    factReachExternal: " and mail & synced sources",
    factLastUsed: "Last used {time}",
    factConnected: "Connected {date}",
    kept: "Your chats, documents and API keys are not touched.",
    keep: "Keep it",
    confirm: "Disconnect {name}",
    busy: "Disconnecting…",
    failed: "Couldn't disconnect {name}. {detail} It is still connected.",
  },
  org: {
    heading: "Connected apps in {org}",
    description: "Apps members signed in to through Syrel's sign-in page. Disconnect all doesn't touch API keys.",
    empty: "No connected apps in {org}.",
    /** 307-05 authored (UI-SPEC 3a: "the shipped tab's loading line and alert row, with connected apps words"). */
    loading: "Loading the connected apps…",
    loadFailed: "Couldn't load the connected apps.",
    all: "Disconnect all connected apps",
    allTitle: "Disconnect all connected apps in {org}?",
    allSub: "Every app members signed in to through Syrel in {org} stops on its next call. Members can connect again afterwards.",
    allFactApps: "connected app(s)",
    allFactMembers: "member(s)",
    allNamesMore: ", and {K} more",
    allNamesSep: ", ",
    allConsequence: "Their sign-ins from Claude.ai, Claude Desktop, Claude Code and any other app end in {org}.",
    allKeptKeys: "API keys, AI tool and workflow, are not touched",
    allKeptOrgs: "Other organisations are not touched",
    allKeptMark: "✓",
    allKeep: "Keep them",
    allConfirm: "Disconnect {N} app(s)",
    allFailed: "Couldn't disconnect the apps. {detail} They are still connected.",
    allReceipt: "✎ You disconnected {N} connected app(s) in {org} · recorded",
    /** A member with no name on file (the 304 fallback shape). */
    unknownOwner: "a member",
  },
} as const
