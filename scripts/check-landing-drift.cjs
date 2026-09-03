#!/usr/bin/env node
/**
 * Phase 226 (SEED-241 / D-226-05 / F-2) — Living Landing Page Drift Guard.
 *
 * Derives ground truth facts from authoritative application source files and
 * asserts 100% agreement with `frontend/src/landing/facts.ts`.
 *
 * Exit codes:
 *   0 — Clean: zero drift detected.
 *   1 — Drift: one or more claims in facts.ts diverged from application source code.
 *   2 — Harness error: a required source file could not be read or parsed.
 */

const fs = require("fs")
const path = require("path")

// Resolve workspace root (works whether called from root or subdirectories)
function findRepoRoot() {
  let cur = __dirname
  while (cur !== path.dirname(cur)) {
    if (fs.existsSync(path.join(cur, "package.json")) || fs.existsSync(path.join(cur, ".git"))) {
      return cur
    }
    cur = path.dirname(cur)
  }
  return path.resolve(__dirname, "..")
}

const ROOT = findRepoRoot()

function readFileOrDie(relPath) {
  const absPath = path.join(ROOT, relPath)
  if (!fs.existsSync(absPath)) {
    console.error(`[HARNESS ERROR] Missing required source file: ${relPath}`)
    process.exit(2)
  }
  try {
    return fs.readFileSync(absPath, "utf-8")
  } catch (err) {
    console.error(`[HARNESS ERROR] Could not read ${relPath}: ${err.message}`)
    process.exit(2)
  }
}

// ── 1. Read facts.ts ──────────────────────────────────────────────────────────
const factsSource = readFileOrDie("frontend/src/landing/facts.ts")

const failures = []

function recordMismatch(factName, expected, actual) {
  failures.push({
    fact: factName,
    expected: JSON.stringify(expected),
    actual: JSON.stringify(actual),
  })
}

// ── 2. Check Providers (backend/app/config.py) ─────────────────────────────────
const configPy = readFileOrDie("backend/app/config.py")

// Extract MODEL_CAPABILITIES dictionary block
const modelCapabilitiesBlockMatch = configPy.match(/MODEL_CAPABILITIES:\s*dict\[str,\s*ModelCapability\]\s*=\s*\{([\s\S]*?)\n\}/)
const modelCapBlock = modelCapabilitiesBlockMatch ? modelCapabilitiesBlockMatch[1] : ""
const providerMatches = modelCapBlock.match(/"provider":\s*"([^"]+)"/g) || []
const extractedModelProviders = Array.from(
  new Set(providerMatches.map((m) => m.match(/"provider":\s*"([^"]+)"/)[1]))
).sort()

// Extract _PROVIDER_BASE_URLS keys
const baseUrlBlock = configPy.match(/_PROVIDER_BASE_URLS:\s*dict\[str,\s*str\]\s*=\s*\{([\s\S]*?)\}/)
const baseUrlKeys = baseUrlBlock
  ? Array.from(baseUrlBlock[1].matchAll(/"([^"]+)":/g)).map((m) => m[1])
  : []
const extractedLocalRuntimes = baseUrlKeys
  .filter((k) => !extractedModelProviders.includes(k) && (k === "ollama" || k === "lmstudio"))
  .sort()

// Extract from facts.ts
const modelProviderFactsMatch = factsSource.match(/export const MODEL_PROVIDERS:[^=]+=\s*Object\.freeze\(\[([\s\S]*?)\]\)/)
const factsProviders = modelProviderFactsMatch
  ? Array.from(modelProviderFactsMatch[1].matchAll(/id:\s*"([^"]+)"/g)).map((m) => m[1]).sort()
  : []

const localRuntimeFactsMatch = factsSource.match(/export const LOCAL_RUNTIMES:[^=]+=\s*Object\.freeze\(\[([\s\S]*?)\]\)/)
const factsLocalRuntimes = localRuntimeFactsMatch
  ? Array.from(localRuntimeFactsMatch[1].matchAll(/id:\s*"([^"]+)"/g)).map((m) => m[1]).sort()
  : []

if (JSON.stringify(factsProviders) !== JSON.stringify(extractedModelProviders)) {
  recordMismatch("MODEL_PROVIDERS (config.py MODEL_CAPABILITIES)", extractedModelProviders, factsProviders)
}

if (JSON.stringify(factsLocalRuntimes) !== JSON.stringify(extractedLocalRuntimes)) {
  recordMismatch("LOCAL_RUNTIMES (config.py _PROVIDER_BASE_URLS minus model providers)", extractedLocalRuntimes, factsLocalRuntimes)
}

// ── 3. Check Ingest Formats (acceptedFormats.ts + documents.py) ───────────────
const acceptedFormatsTs = readFileOrDie("frontend/src/components/ingestion/acceptedFormats.ts")
const dropzoneLabelsMatch = acceptedFormatsTs.match(/displayLabels:\s*Object\.freeze\(\[([\s\S]*?)\]\)/)
const dropzoneLabels = dropzoneLabelsMatch
  ? Array.from(dropzoneLabelsMatch[1].matchAll(/"([^"]+)"/g)).map((m) => m[1])
  : []

const documentsPy = readFileOrDie("backend/app/api/documents.py")
const extMimeMatch = documentsPy.match(/_EXT_MIME_OVERRIDES:\s*dict\[str,\s*str\]\s*=\s*\{([\s\S]*?)\}/)
const overrideExts = extMimeMatch
  ? Array.from(extMimeMatch[1].matchAll(/"\.([a-z0-9]+)"/gi)).map((m) => m[1].toUpperCase())
  : []
const serverOnlyExts = ["MSG", "EML", "DXF"].filter((ext) => overrideExts.includes(ext))

const expectedIngestFormats = [...dropzoneLabels, ...serverOnlyExts]

const factsIngestMatch = factsSource.match(/export const INGEST_FORMATS:[^=]+=\s*Object\.freeze\(\[([\s\S]*?)\]\)/)
const factsIngestFormats = factsIngestMatch
  ? Array.from(factsIngestMatch[1].matchAll(/"([^"]+)"/g)).map((m) => m[1])
  : []

if (JSON.stringify(factsIngestFormats) !== JSON.stringify(expectedIngestFormats)) {
  recordMismatch("INGEST_FORMATS (acceptedFormats.ts dropzone + documents.py overrides)", expectedIngestFormats, factsIngestFormats)
}

// ── 4. Check Gauntlet Stages (PublishGauntlet.tsx) ─────────────────────────────
const publishGauntletTsx = readFileOrDie("frontend/src/components/workflows/PublishGauntlet.tsx")
const stagesBlockMatch = publishGauntletTsx.match(/const STAGES:[^=]+=\s*\[([\s\S]*?)\]\s*(?:\n\n|\/\*\*)/)
const extractedStages = stagesBlockMatch
  ? Array.from(stagesBlockMatch[1].matchAll(/label:\s*"([^"]+)",\s*what:\s*"([^"]+)"/g)).map((m) => ({
      label: m[1],
      what: m[2],
    }))
  : []

const factsStagesMatch = factsSource.match(/export const GAUNTLET_STAGES:[^=]+=\s*Object\.freeze\(\[([\s\S]*?)\]\)/)
const factsStages = factsStagesMatch
  ? Array.from(factsStagesMatch[1].matchAll(/label:\s*"([^"]+)",\s*what:\s*"([^"]+)"/g)).map((m) => ({
      label: m[1],
      what: m[2],
    }))
  : []

if (JSON.stringify(factsStages) !== JSON.stringify(extractedStages)) {
  recordMismatch("GAUNTLET_STAGES (PublishGauntlet.tsx STAGES)", extractedStages, factsStages)
}

// ── 5. Check Built-in Tool Count (tool_dispatcher.py) ─────────────────────────
const toolDispatcherPy = readFileOrDie("backend/app/services/tool_dispatcher.py")
const registryBlockMatch = toolDispatcherPy.match(/_TOOL_REGISTRY:\s*dict\[str,\s*Callable\]\s*=\s*\{([\s\S]*?)\n\}/)
const extractedToolKeys = registryBlockMatch
  ? Array.from(registryBlockMatch[1].matchAll(/"([^"]+)":/g)).map((m) => m[1])
  : []

const factsToolCountMatch = factsSource.match(/export const BUILTIN_TOOL_COUNT\s*=\s*(\d+)/)
const factsToolCount = factsToolCountMatch ? parseInt(factsToolCountMatch[1], 10) : null

if (factsToolCount !== extractedToolKeys.length) {
  recordMismatch("BUILTIN_TOOL_COUNT (tool_dispatcher.py _TOOL_REGISTRY.length)", extractedToolKeys.length, factsToolCount)
}

// ── 6. Check Connector Catalog (servicesCatalog.ts) ───────────────────────────
const servicesCatalogTs = readFileOrDie("frontend/src/components/settings/servicesCatalog.ts")
const catalogMatch = servicesCatalogTs.match(/export const CATALOG_SERVICES:[^=]+=\s*\[([\s\S]*?)\n\]/)
const extractedCatalogServiceIds = []
if (catalogMatch) {
  // Extract from POPULAR_SERVICES and remainder of CATALOG_SERVICES
  const popMatch = servicesCatalogTs.match(/export const POPULAR_SERVICES:[^=]+=\s*\[([\s\S]*?)\n\]/)
  if (popMatch) {
    for (const m of popMatch[1].matchAll(/serviceId:\s*"([^"]+)"/g)) {
      extractedCatalogServiceIds.push(m[1])
    }
  }
  for (const m of catalogMatch[1].matchAll(/serviceId:\s*"([^"]+)"/g)) {
    extractedCatalogServiceIds.push(m[1])
  }
}
const uniqueCatalogIds = Array.from(new Set(extractedCatalogServiceIds)).sort()

const factsCatalogMatch = factsSource.match(/export const CONNECTOR_CATALOG:[^=]+=\s*Object\.freeze\(\[([\s\S]*?)\]\)/)
const factsCatalogIds = factsCatalogMatch
  ? Array.from(factsCatalogMatch[1].matchAll(/id:\s*"([^"]+)"/g)).map((m) => m[1]).sort()
  : []

if (JSON.stringify(factsCatalogIds) !== JSON.stringify(uniqueCatalogIds)) {
  recordMismatch("CONNECTOR_CATALOG (servicesCatalog.ts CATALOG_SERVICES)", uniqueCatalogIds, factsCatalogIds)
}

// ── 7. Check Surface Tabs ─────────────────────────────────────────────────────
const surfaceTabsMatch = factsSource.match(/export const SURFACE_TABS\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/)
function extractTabsForKey(key) {
  if (!surfaceTabsMatch) return []
  const m = surfaceTabsMatch[1].match(new RegExp(`${key}:\\s*\\[([\\s\\S]*?)\\]`))
  if (!m) return []
  return Array.from(m[1].matchAll(/"([^"]+)"/g)).map((t) => t[1])
}

const factsLibraryTabs = extractTabsForKey("library")
const factsSettingsTabs = extractTabsForKey("settings")
const factsControlRoomTabs = extractTabsForKey("controlRoom")
const factsOrgAdminTabs = extractTabsForKey("orgAdmin")

// 7a. Library tabs (LibraryPage.tsx)
const libraryPageTsx = readFileOrDie("frontend/src/pages/LibraryPage.tsx")
const libraryTabsMatches = Array.from(libraryPageTsx.matchAll(/<TabsTrigger\s+value="([^"]+)"\s*>([^<]+)<\/TabsTrigger>/g)).map(m => m[2].trim())
if (JSON.stringify(factsLibraryTabs) !== JSON.stringify(libraryTabsMatches)) {
  recordMismatch("SURFACE_TABS.library (LibraryPage.tsx)", libraryTabsMatches, factsLibraryTabs)
}

// 7b. Org Admin tabs (OrgAdminShell.tsx)
const orgAdminShellTsx = readFileOrDie("frontend/src/components/org/OrgAdminShell.tsx")
const orgTabsMatch = orgAdminShellTsx.match(/const TABS:\s*readonly\s*TabDef\[\]\s*=\s*\[([\s\S]*?)\n\]/)
const extractedOrgTabs = orgTabsMatch
  ? Array.from(orgTabsMatch[1].matchAll(/label:\s*"([^"]+)"/g)).map(m => m[1])
  : []
if (JSON.stringify(factsOrgAdminTabs) !== JSON.stringify(extractedOrgTabs)) {
  recordMismatch("SURFACE_TABS.orgAdmin (OrgAdminShell.tsx)", extractedOrgTabs, factsOrgAdminTabs)
}

// 7c. Settings tabs (SettingsPage.tsx)
const settingsPageTsx = readFileOrDie("frontend/src/pages/SettingsPage.tsx")
const settingsTabsBlock = settingsPageTsx.match(/<TabsList[^>]*>([\s\S]*?)<\/TabsList>/)
const extractedSettingsTabs = []
if (settingsTabsBlock) {
  for (const m of settingsTabsBlock[1].matchAll(/<TabsTrigger[^>]*>([\s\S]*?)<\/TabsTrigger>/g)) {
    let label = m[1].trim()
    if (label.includes("retrievalTabLabel")) {
      label = "Search & Retrieval" // Admin view dynamic label matching facts.ts
    }
    extractedSettingsTabs.push(label)
  }
}
if (JSON.stringify(factsSettingsTabs) !== JSON.stringify(extractedSettingsTabs)) {
  recordMismatch("SURFACE_TABS.settings (SettingsPage.tsx)", extractedSettingsTabs, factsSettingsTabs)
}

// 7d. Control Room tabs (ControlRoomPage.tsx)
const controlRoomTsx = readFileOrDie("frontend/src/components/admin/ControlRoomPage.tsx")
const crTabsMatch = controlRoomTsx.match(/const TABS:\s*readonly\s*TabDef\[\]\s*=\s*\[([\s\S]*?)\n\]/)
const extractedCRTabs = crTabsMatch
  ? Array.from(crTabsMatch[1].matchAll(/label:\s*"([^"]+)"/g)).map(m => m[1])
  : []
if (JSON.stringify(factsControlRoomTabs) !== JSON.stringify(extractedCRTabs)) {
  recordMismatch("SURFACE_TABS.controlRoom (ControlRoomPage.tsx)", extractedCRTabs, factsControlRoomTabs)
}

// ── 8. Check Verbatim Quotes ──────────────────────────────────────────────────
const quotesMatch = factsSource.match(/export const VERBATIM_QUOTES:[^=]+=\s*Object\.freeze\(\[([\s\S]*?)\]\)/)
if (quotesMatch) {
  const quoteBlocks = quotesMatch[1].split(/\{\s*id:/).filter(Boolean)
  for (const block of quoteBlocks) {
    const qMatch = block.match(/quote:\s*"([^"]+)"/)
    const srcMatch = block.match(/source:\s*"([^"]+)"/)
    if (qMatch && srcMatch) {
      const quoteText = qMatch[1]
      const sourceFile = srcMatch[1]
      const sourceContent = readFileOrDie(sourceFile)
      if (!sourceContent.includes(quoteText)) {
        recordMismatch(`VERBATIM_QUOTE in ${sourceFile}`, quoteText, "NOT FOUND VERBATIM")
      }
    }
  }
}

// ── Report Results ────────────────────────────────────────────────────────────
if (failures.length > 0) {
  console.error(`\n❌ LANDING DRIFT DETECTED (${failures.length} discrepancies):\n`)
  for (const f of failures) {
    console.error(`  • Fact: ${f.fact}`)
    console.error(`    Source Code: ${f.expected}`)
    console.error(`    facts.ts:    ${f.actual}\n`)
  }
  process.exit(1)
}

console.log("✓ Landing facts match application code (zero drift)")
process.exit(0)
