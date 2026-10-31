/**
 * Phase 304-05 (KEY-01, KEY-03, KEY-04, KEY-05, KEY-06) — the ONE string home of the MCP key
 * surfaces: the kind choice, the MCP draft rows, the setup snippets' steps, the MCP key card, the
 * revoke sheet's MCP facts, the switched-off sentences and the org switch (304-06).
 *
 * A TRUE LEAF, like `apiKeysCopy.ts` (orchestrator resolution 1): it imports nothing and exports
 * only strings. `{slot}` templates are filled by `fillCopy` from `apiKeysCopy.ts`, imported by the
 * consumers, never here.
 *
 * Source: 304-UI-SPEC §Copywriting (the `kind` and `mcp` blocks), verbatim. The strings the spec
 * left to research or did not write are marked `304-05 authored`, in the house voice:
 *   · the per-client placement and reload sentences (`stepPlace.*`, `stepReload.*`), written from
 *     each client's own docs as read in 304-RESEARCH §"Client snippets (D-27)";
 *   · the Claude Desktop env step and the bridge-version line (D-45);
 *   · the words for the three 304 refusal reasons in the activity rows;
 *   · `offTileDeployment`, `sheetNFolders`, `orgFallback`.
 */

export const MCP_KEY_COPY = {
  kind: {
    question: "What is this key for?",
    mcpTitle: "For an AI tool (MCP)",
    mcpSub: "Claude Code, Cursor or VS Code searches and reads your knowledge as you.",
    workflowTitle: "For a workflow integration",
    workflowSub: "n8n, a script or a scheduler starts the published workflows you pick.",
    chooseFirst: "Choose what the key is for.",
    chipMcp: "AI tool · MCP",
    chipWorkflow: "Workflow",
  },

  /** 304-05 authored: the 293 header words, kept for a deployment where AI tool keys can't be made
   *  (D-30: there, the screen is 293's and must not advertise a kind nobody can create). */
  workflowOnly: {
    description:
      "Let another system start your published workflows and read the result. Each key starts only the workflows you pick, and its runs run as you.",
    empty:
      "No keys yet. A key lets another system, such as n8n, a script or a scheduler elsewhere, start one of your published workflows and read its result.",
  },

  mcp: {
    labelPlaceholder: "e.g. claude-code-laptop",
    orgField: "Organisation",
    orgHint:
      "The key acts as you in this organisation only. To use another organisation, switch to it and make a key there.",
    /** 304-05 authored: no active org is known to the screen. */
    orgFallback: "this organisation",
    toolsField: "Tools",
    presets: {
      read: "Read only",
      ask: "Read and ask",
      run: "Read, ask and run workflows",
      custom: "Choose tools",
    },
    groups: {
      read: "Read",
      ask: "Ask the agent",
      run: "Run workflows",
    },
    comesWith: "comes with {tool}",
    toolsHint:
      "Read only is the safe default. Ask lets the tool put questions to the agent as you. Run lets it start your published workflows as you.",
    toolsLoading: "Loading the tools…",
    toolsFailed: "Couldn't load the tools.",
    foldersField: "Folders",
    foldersAll: "All folders I can see in {org}",
    foldersOnly: "Only these folders",
    foldersAllHint:
      "Includes folders shared with the whole organisation. Mail and synced sources are left out unless you include them below.",
    foldersOnlyHint: "Subfolders are included, also ones made later.",
    foldersFilter: "Filter folders",
    foldersCount: "{N} folder(s) ticked",
    folderIncluded: "included",
    folderShared: "shared with the org",
    folderMail: "mail",
    folderSynced: "synced",
    folderNeedsExternal: "tick Include mail and synced sources first",
    foldersLoading: "Loading your folders…",
    foldersFailed: "Couldn't load your folders.",
    foldersNone: "You can't see any folders in {org} yet.",
    externalField: "Include mail and synced sources",
    externalSub: "Documents that arrived from a mailbox or a synced source. Left out unless you tick this.",
    expiresHint: "AI tool keys always expire. You can revoke it any time before then.",
    actsLead: "This key ",
    actsBold: "acts as you",
    actsTail:
      " in {org}. It sees what you see there, never more, and only within the folders and tools above. Anyone holding the key can do the same, so keep it in an environment variable, never in a file you share.",
    needTool: "Tick at least one tool.",
    needFolder: "Tick at least one folder, or choose All folders I can see.",
    waitTools: "Waiting for the tool list.",
    waitFolders: "Waiting for your folders.",

    connectHeading: "Connect a tool",
    clients: {
      claudeCode: "Claude Code",
      cursor: "Cursor",
      vscode: "VS Code",
      desktop: "Claude Desktop",
    },
    workaroundChip: "Workaround",
    desktopLead:
      "A developer workaround until Claude Desktop connects with sign-in. It needs Node.js and runs a small bridge on your computer.",
    stepEnv: "Put the secret in an environment variable named {env}.",
    /** 304-05 authored: Claude Desktop's config does not read the host environment (304-RESEARCH). */
    stepEnvDesktop:
      "Claude Desktop can't read environment variables, so the secret goes in its config file, in place of the placeholder below. Keep that file private.",
    /** 304-05 authored, from each client's own docs (304-RESEARCH §Client snippets). */
    stepPlace: {
      claudeCode: "Add this to .mcp.json in your project's folder, or run the command under it from that folder.",
      cursor: "Add this to .cursor/mcp.json in your project, or to ~/.cursor/mcp.json for every project.",
      vscode: "Add this to .vscode/mcp.json in your workspace.",
      desktop: "Add this to claude_desktop_config.json (Settings, Developer, Edit Config).",
    },
    stepReload: {
      claudeCode: "Start Claude Code again in that folder, approve the syrel server when it asks, then run /mcp to check it is connected.",
      cursor: "Restart Cursor, then check that syrel is switched on in Cursor's MCP settings.",
      vscode: "Click Start above syrel in mcp.json, or open a chat in agent mode and let VS Code start it.",
      desktop: "Quit Claude Desktop fully and open it again.",
    },
    /** 304-05 authored: the Claude Code terminal alternative's header. */
    cliHeading: "Or add it from the terminal, in your project's folder",
    /** 304-05 authored (D-45): shown on the Desktop tab only if the bridge version is not pinned. */
    desktopUnverified:
      "The bridge's version couldn't be checked, so no version is pinned. Check the mcp-remote package before you run it.",
    copySetup: "Copy the {client} setup",
    /** 304-05 authored: the Claude Code terminal form's Copy button. */
    copyCli: "Copy the {client} command",
    claudeAiWarning:
      "⚠ Don't paste this key into Claude.ai's organisation connector settings. Everyone in that Claude organisation would act as you. Claude.ai and Claude Desktop will connect with sign-in instead.",
    // 305 D-49: production refuses an unset, loopback or http base (mcp_public_base), so "set it" means https.
    noAddress:
      "This deployment doesn't have a public https address for AI tools yet, so the connection address can't be shown. Ask your operator to set it.",
    howToConnect: "How to connect",
    hideHowToConnect: "Hide how to connect",

    chipAllFolders: "All folders",
    chipNTools: "{N} tool(s)",
    chipMore: "+{N} more",
    chipExternal: "mail & synced sources",
    metaActsIn: "acts in ",
    notUsedYet: "Not used yet",
    tagOff: "⏸ switched off",
    offOrg: "MCP access is switched off for this organisation by an admin. This key works again when they switch it back on.",
    offDeployment:
      "MCP access is switched off for this deployment by the operator. This key works again when they switch it back on.",
    offTileOrg: "MCP access is switched off for this organisation by an admin.",
    /** 304-05 authored: the member header line when the deployment switch is off. */
    offTileDeployment: "MCP access is switched off for this deployment by the operator.",
    /** 304-REVIEW WR-02: the server could not read the switches (`mcp_off: "unknown"`) — every variant. */
    offUnknown: "Couldn't check whether AI tool access is on. Reload to try again.",
    offAdmin:
      "MCP access is switched off for {org}. Every member's AI tool key is refused until you switch it back on in the Settings tab.",

    sheetFact: "Can use {tools} on {folders}",
    sheetFactExternal: " and mail & synced sources",
    /** 304-05 authored: the folder count in the revoke sheet's first fact. */
    sheetNFolders: "{N} folder(s)",
    sheetKept:
      "Revoking can't be undone. Any AI tool using this key stops working on its next call; a replacement is a new key with a new secret.",

    orgSwitchTitle: "AI tool access (MCP)",
    orgSwitchSub: "Members can make personal keys that let Claude Code, Cursor or VS Code search and read as them in {org}.",
    orgSwitchOffTag: "off for {org}",
    orgSwitchImpact:
      "Every member's AI tool key in {org} is refused on its next call. Keys are kept; switching back on restores them.",
    orgSwitchFailed: "Couldn't change it. Try again.",
    orgSwitchLoading: "Loading…",
    orgSwitchLoadFailed: "Couldn't load this setting.",
  },

  /** 304-05 authored: the activity words for the refusal reasons 304-02 added (D-36). */
  calls: {
    wrongKind: "this kind of key can't make this call",
    mcpOffOrg: "MCP access is switched off for this organisation",
    mcpOffDeployment: "MCP access is switched off for this deployment",
    // 305-03 (UI-SPEC §Copywriting): one row per MCP call (D-53).
    answered: "answered",
    withheld: "✕ withheld: it couldn't be checked for personal data",
    failed: "✕ failed: the tool couldn't finish",
    // 305-REVIEW WR-04: the tool answered with an error (no such document, a stale cursor, no text yet).
    notAvailable: "✕ not available: nothing this key can read there",
    unknownOutcome: "✕ {outcome}",
    overSearches: "over the limit: {N} searches a minute",
    notGranted: "this key isn't allowed to use {tool}",
    notGrantedBare: "this key isn't allowed to use that tool",
  },

  /** 305-03 (UI-SPEC §Surface 3): an AI tool key's activity table and call strip. */
  activity: {
    colTool: "Tool",
    noTool: "—",
    noCalls: "No calls yet. The first search or read will show here.",
    legendOk: "answered",
    legendNotOk: "not answered",
  },

  /** 305-04 (UI-SPEC §Copywriting `pii` block, verbatim): the org's PII redaction card. The
   *  example in `sub` is the redactor's real email mask (backend `pii_redactor.MASKS`). */
  pii: {
    title: "Remove personal data from AI tool results",
    sub: "When on, search results and documents sent to members' AI tools in {org} have email addresses, phone numbers, card numbers, IBANs and secrets such as API keys replaced with a short note, like [email removed].",
    notCovered:
      "Names are not covered. If a result can't be checked, it is withheld rather than sent. Document ids, citations and Open in Syrel links are never changed.",
    onTag: "on for {org}",
    loading: "Loading…",
    loadFailed: "Couldn't load this setting.",
    failed: "Couldn't change it. Try again.",
  },
} as const
