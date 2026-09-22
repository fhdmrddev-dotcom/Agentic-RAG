/**
 * `lib/api.ts` — the API barrel.
 *
 * ⚠ THIS PATH DOES NOT MOVE, AND THAT IS THE WHOLE SAFETY STORY OF PHASE 207.
 * 110 test files mock this module BY PATH, at 120 call sites; `196-08` measured
 * 249 red tests from a single added export, because a factory that no longer
 * matches fails at mount. A split that MOVED this path would turn every one of
 * those factories inert — and the quiet failure is worse than the loud one.
 *
 * So: the domain modules live in `lib/api/`, and this file re-exports THE EXACT
 * SET it exported before the split — 325 symbols, asserted by diffing the export
 * list before and after, not by reading. Helpers that were module-private in the
 * old single file (`API_BASE`, `getAuthHeaders`, ...) are exported from their new
 * home so siblings can import them, and are DELIBERATELY NOT re-exported here —
 * the public surface is unchanged in both directions.
 *
 * ⚠ ADDING AN EXPORT? Add it to its domain module AND to the list below, in the
 * same commit. This file contains re-exports only; put no logic here.
 */

// ── _core ─────────────────────────────────────────────────────────
export {
  FEATURE_FORBIDDEN_EVENT,
  VISIBILITY_REFUSAL,
  ApiError,
  ACTIVE_ORG_STORAGE_KEY,
  getActiveOrgId,
  setActiveOrgId,
} from "./api/_core"
export type {
  SkillImportResult,
  GovernedFeature,
  EffectiveFeatures,
  FeaturesResponse,
} from "./api/_core"

// ── threads ─────────────────────────────────────────────────────────
export {
  listThreads,
  createThread,
  getMessages,
  listModels,
  deleteThread,
  renameThread,
  setThreadActiveExpert,
  postMessage,
  subscribeToRun,
  getActiveRuns,
  getSnapshot,
  getThreadTodos,
  getThreadWorkspaceFiles,
  getThreadPendingAsks,
  getThreadTasks,
  getWorkspaceFileContent,
  getWorkspaceFileVersions,
  getWorkspaceFileDiff,
  answerAskUser,
  cancelRun,
  getThreadWorkflow,
  listPublishedWorkflows,
  listStarterWorkflows,
  continueRun,
} from "./api/threads"
export type {
  PostMessageResponse,
  ActiveRun,
  ThreadSnapshot,
  StreamCallbacks,
  ThreadWorkflowState,
  WorkflowPhaseState,
  PublishedWorkflow,
  ContinueRunResult,
} from "./api/threads"

// ── documents ─────────────────────────────────────────────────────────
export {
  listDocuments,
  uploadDocument,
  uploadWorkspaceTemplate,
  attachConnectionFileToThread,
  DownloadError,
  downloadSandboxOutput,
  downloadWorkspaceFile,
  deleteDocument,
  fetchDocumentVersions,
  restoreDocumentVersion,
  listFolders,
  createFolder,
  renameFolder,
  deleteFolder,
  toggleFolderOrgShared,
  // Phase 217 (LIB-04 / D-217-04) — the five document-detail reads. ⚠ These MUST be here:
  // a symbol exported from `api/documents.ts` and forgotten in this barrel typechecks
  // perfectly and is invisible to every consumer, because everything outside `lib/`
  // imports `@/lib/api` (D-207-06). `apiBarrel.test.ts` now guards that mechanically for
  // this module, so the omission reds instead of shipping silently.
  getDocumentContent,
  listDocumentChunks,
  listDocumentTables,
  listDocumentImages,
  listDocumentQueries,
  // Phase 240 (SRC-05 SC#3) — the conversation read. Same rule as the five above: a symbol
  // missing from this barrel typechecks perfectly and is invisible to every consumer.
  fetchDocumentConversation,
} from "./api/documents"

// ── skills ─────────────────────────────────────────────────────────
export {
  listSkills,
  createSkill,
  updateSkill,
  deleteSkill,
  toggleSkillEnabled,
  PublishGateError,
  toggleSkillOrgShared,
  getPublishGate,
  listTestCases,
  createTestCase,
  updateTestCase,
  deleteTestCase,
  listSkillVersions,
  startEvalRun,
  getEvalRun,
  listEvalRuns,
  rateEvalResult,
  startMatrixRun,
  runEngineSweep,
  getEngineHealth,
  getEvalRunById,
  getEvalAggregate,
  proposeImprovement,
  listProposals,
  getProposal,
  approveProposal,
  rerunProposalReeval,
  rejectProposal,
  forcePromoteProposal,
  proposeDescription,
  getLatestDescriptionProposal,
  approveDescriptionProposal,
  rejectDescriptionProposal,
} from "./api/skills"
export type {
  ProviderInfo,
  FullAppSettings,
  AppSettings,
  ProviderUpdate,
  SettingsUpdate,
} from "./api/skills"

// ── settings ─────────────────────────────────────────────────────────
export {
  getSettings,
  updateSettings,
  getJudgeModel,
  setJudgeModel,
  getModelDefault,
  setModelDefault,
  getReembedProgress,
  kickReembed,
  getProviders,
  exportSkill,
  importSkillZip,
  listSkillFiles,
  uploadSkillFile,
  deleteSkillFile,
  getAuditLogs,
  exportAuditLogs,
} from "./api/settings"
export type {
  ModelDefault,
  ReembedProgress,
  AuditEntry,
  AuditLogsResponse,
  MostRetrievedDoc,
  NeverRetrievedDoc,
  LowConfidenceDoc,
  StaleDoc,
  HealthSummary,
  HealthOverview,
  PaginatedResponse,
  RetrievalTrendPoint,
  LowConfidenceQuery,
  FeedbackRequest,
  DownvotedDocument,
  FeedbackStats,
} from "./api/settings"

// ── knowledge ─────────────────────────────────────────────────────────
export {
  getKnowledgeHealthSummary,
  getHealthOverview,
  getMostRetrieved,
  getNeverRetrieved,
  getStaleDocs,
  getLowConfidenceDocs,
  getLowConfidenceQueries,
  getRetrievalTrend,
  getGovBroken,
  getGovUnclassified,
  getGovLowConfidence,
  moveDocument,
  reingestDocument,
  updateDocumentMetadata,
  listMetadataFields,
  createView,
  updateView,
  listViews,
  deleteView,
  resolveView,
  resolveAdHoc,
  resolveFilterCount,
  listRelationships,
  createRelationship,
  deleteRelationship,
  listRules,
  createRule,
  updateRule,
  deleteRule,
  acceptClassification,
  dismissClassification,
  submitFeedback,
  getFeedbackStats,
} from "./api/knowledge"
export type {
  GovBrokenItem,
  GovUnclassifiedItem,
  GovLowConfidenceItem,
  WorkflowDefinitionJSON,
  PublishVerdict,
  // Phase 214 (STEP-03) — added to its domain module AND to this list in the SAME commit,
  // per this file's own rule above. TYPE-ONLY, so `196-08`'s mock-factory failure mode
  // (a `vi.mock` factory missing a newly-added RUNTIME export) structurally cannot fire.
  PublishNamedFailure,
  LintError,
  WorkflowDraftRow,
  WorkflowDraftWriteResult,
  GenerateReadiness,
  GenerateResult,
  GenerateWorkflowBody,
  PublishOutcome,
} from "./api/knowledge"

// ── library ─────────────────────────────────────────────────────────
export {
  getIndexSummary,
  listCheckedQueries,
  createCheckedQuery,
  triggerCheck,
  triggerCheckAll,
  deleteCheckedQuery,
} from "./api/library"
export type {
  IndexSummary,
  FolderIndexRow,
  CheckedQueryRow,
} from "./api/library"

// ── workflows ─────────────────────────────────────────────────────────
export {
  WorkflowConflictError,
  WorkflowNotFoundError,
  WorkflowStaleTokenError,
  WorkflowDraftUnreadableError,
  WorkflowTemplateUploadError,
  uploadWorkflowTemplate,
  getWorkflowTemplatePlaceholders,
  readTemplatePlaceholdersFromFile,
  createWorkflowDraft,
  listDraftWorkflows,
  updateWorkflowDraft,
  deleteWorkflowDraft,
  WorkflowValidateUnreadableError,
  validateWorkflow,
  getGroundingBundle,
  getWorkflowRun,
  getWorkflowRunPhaseCitations,
  listWorkflowRuns,
  getWorkflowDeletePreview,
  deleteWorkflowCascade,
  generateWorkflow,
  publishWorkflow,
} from "./api/workflows"
export type {
  WorkflowTemplateAsset,
  WorkflowTemplatePlaceholders,
  Verdict,
  ValidateResponse,
  GroundingBundle,
  WorkflowRunPhase,
  WorkflowRunRead,
  RunStepCitation,
  WorkflowRunListItem,
  WorkflowRunListPage,
  WorkflowDeletePreview,
  TunerTarget,
  TunerCase,
  TunerCell,
  TunerCandidate,
  TunerScoreboard,
  StartTunerRunResponse,
  StartTunerRunBody,
} from "./api/workflows"

// ── tuner ─────────────────────────────────────────────────────────
export {
  startTunerRun,
  getTunerResults,
  cancelTunerRun,
  getTunerLatest,
  getSeededCases,
  streamTunerRun,
} from "./api/tuner"
export type {
  LatestTunerRun,
  SeededCase,
  SeededCasesResponse,
  TunerStreamCallbacks,
  OperatorIdentity,
  BackpressureSignals,
  OperatorAuditRow,
} from "./api/tuner"

// ── admin ─────────────────────────────────────────────────────────
export {
  getOperatorProbe,
  getEffectiveFeatures,
  getEffectiveFeaturesPayload,
  getBackpressure,
  getOperatorAudit,
  getPlatformAudit,
  exportPlatformAudit,
  getUsersRoster,
  disableUser,
  enableUser,
  grantOperator,
  revokeOperator,
  setFeatureVisibility,
  getFeatureVisibility,
  setFeatureAudience,
  getAdminActiveRuns,
  killRun,
  setFlag,
  DISCOVERY_UNKNOWN,
  getModelRegistry,
  getAuthorModelRegistry,
  setModelCapability,
  addModelById,
  removeModel,
  setModelLock,
  MODEL_CAP_INT_BOUNDS,
  isWithinModelCapBounds,
  runModelDiscovery,
  recordControlPlaneEvent,
  getMaintenanceStatus,
  getSetupStatus,
  getPublicConfig,
} from "./api/admin"
export type {
  PlatformAuditFilters,
  PlatformAuditRow,
  PlatformAuditPage,
  UserRosterRow,
  UserRosterPage,
  FeatureAudience,
  GreenlistRole,
  FeatureVisibilityRecord,
  AdminActiveRun,
  FlagKey,
  ModelRegistryRow,
  ModelCapabilityPatch,
  AddModelBody,
  DiscoveredNewModel,
  DiscoveredChangedModel,
  DiscoveredVanishedModel,
  DiscoveryProviderOutcome,
  DiscoveryResult,
  DiscoveryConfirmFailure,
  DiscoveryConfirmReport,
  AuthorModelRow,
  SetupStatus,
  PublicConfig,
  OrgMembership,
  OrgPermissions,
  AdoptionState,
  OrgMember,
  PendingInvitation,
  OrgMembersPage,
  OrgAuditRow,
  OrgAuditFilters,
  OrgAuditPage,
} from "./api/admin"

// ── org ─────────────────────────────────────────────────────────
export {
  getOrgPermissions,
  getOrgMembers,
  getOrgAudit,
  getSsoRoute,
  listSsoConfigs,
  createSsoProvider,
  updateSsoProvider,
  deleteSsoProvider,
  provisionSso,
  sendInvitation,
  listInvitations,
  resendInvitation,
  revokeInvitation,
  acceptInvitation,
} from "./api/org"
export type {
  SsoConfig,
  Invitation,
  SendInvitationResult,
  AcceptInvitationResult,
  ConnectorCapability,
  SendEmailConnectionConfig,
  CreateTicketConnectionConfig,
  PostMessageConnectionConfig,
  McpConnectionConfig,
  ConnectorConnectionConfig,
  McpDiscoveredTool,
  ConnectorConnection,
  ConnectorConnectionCreate,
  ConnectorConnectionUpdate,
  ToolGrantPosture,
  IngestVisibility,
} from "./api/org"

// ── connectors ─────────────────────────────────────────────────────────
export {
  ConnectorApiError,
  listConnectorConnections,
  getConnectorConnection,
  createConnectorConnection,
  updateConnectorConnection,
  deleteConnectorConnection,
  checkConnectorConnection,
  discoverConnectorTools,
  probeMcpServer,
  updateConnectorGrants,
  createOAuthAuthorizeUrl,
  getConnectionOAuthToken,
  listCloudFiles,
  importCloudFile,
  probeMcpAuth,
  createMcpOAuthAuthorizeUrl,
  browseSourceFolders,
  previewSource,
  confirmSourcePreview,
  listSourceFamilies,
} from "./api/connectors"
export type {
  ConnectorCheckBucket,
  ApplicationAvailabilityWire,
  ConnectorCheckResult,
  McpProbeRequest,
  McpProbeResponse,
  OAuthProvider,
  OAuthAuthorizeRequest,
  OAuthAuthorizeResponse,
  OAuthTokenResponse,
  CloudFileItem,
  CloudFileListResponse,
  McpAuthKind,
  McpProbeAuthResponse,
  McpOAuthAuthorizeResponse,
  SourceNode,
  SourceBrowseResponse,
  PreviewBucket,
  PreviewOutcome,
  SourcePreviewItem,
  SourcePreviewResponse,
  SourcePreviewRequest,
  ConnectionFileImportRequest,
  SourceConfirmOutcome,
  SourceConfirmResponse,
} from "./api/connectors"

export { submitToolApproval } from "./api/threads"

// ── schedules ─────────────────────────────────────────────────────────
export {
  listSchedules,
  listWorkflowSchedules,
  createWorkflowSchedule,
  updateSchedule,
  deleteSchedule,
  triggerSchedule,
} from "./api/schedules"

// ── takeoff ───────────────────────────────────────────────────────────
export {
  fetchDocumentTakeoff,
  matchDocumentTakeoff,
  resolveDocumentTakeoffItem,
} from "./api/takeoff"
export type {
  TakeoffCandidate,
  TakeoffBOQItem,
  TakeoffBOQ,
  DocumentTakeoffPayload,
} from "./api/takeoff"

// ── experts ───────────────────────────────────────────────────────────
export {
  listExperts,
  getExpert,
} from "./api/experts"

