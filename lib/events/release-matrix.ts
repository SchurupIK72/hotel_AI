export type Phase1VerificationSource = {
  kind: "helper" | "smoke" | "manual";
  scriptName?: string;
  evidence: string;
};

export type Phase1AcceptanceMatrixEntry = {
  key: string;
  criterion: string;
  ownerSpec: string;
  sources: Phase1VerificationSource[];
};

export type Phase1ReleaseCheck = {
  key: string;
  criterion: string;
  ownerSpec: string;
  status: "pass" | "fail" | "manual";
  evidence: string;
};

export type Phase1ReleaseCheckResult = {
  outcome: "pass" | "fail";
  checks: Phase1ReleaseCheck[];
};

export const PHASE1_ACCEPTANCE_MATRIX: readonly Phase1AcceptanceMatrixEntry[] = [
  {
    key: "tenant_safe_hotel_access",
    criterion: "tenant-safe hotel access",
    ownerSpec: "PH1-02",
    sources: [
      { kind: "helper", scriptName: "test:ph1-02", evidence: "Authorization and secret-redaction helpers reject foreign-hotel access patterns safely." },
      { kind: "manual", evidence: "LOCAL_SETUP.md Step 8 confirms hotel-scoped sign-in and dashboard access for the demo hotel." },
    ],
  },
  {
    key: "telegram_integration_readiness",
    criterion: "Telegram integration readiness",
    ownerSpec: "PH1-02",
    sources: [{ kind: "helper", scriptName: "test:ph1-02", evidence: "Webhook URL, token encryption, and sanitized Telegram error handling remain stable." }],
  },
  {
    key: "inbound_message_persistence",
    criterion: "inbound message persistence",
    ownerSpec: "PH1-03",
    sources: [{ kind: "smoke", scriptName: "verify:ph1-03", evidence: "Smoke proves guest, conversation, message, and dedupe event rows are persisted for one Telegram delivery." }],
  },
  {
    key: "inbox_workspace_rendering",
    criterion: "inbox visibility and conversation detail rendering",
    ownerSpec: "PH1-04",
    sources: [{ kind: "smoke", scriptName: "verify:ph1-04", evidence: "Workspace smoke proves hotel-scoped list selection, guest summary, timeline, and draft placeholder rendering." }],
  },
  {
    key: "conversation_operations",
    criterion: "assignment, unread-clear, and status-change operations",
    ownerSpec: "PH1-05",
    sources: [{ kind: "smoke", scriptName: "verify:ph1-05", evidence: "Operations smoke proves unread, assignment, unassignment, and pending-state behavior remains consistent." }],
  },
  {
    key: "knowledge_governance_publish_state",
    criterion: "knowledge governance and publish-state behavior",
    ownerSpec: "PH1-06",
    sources: [{ kind: "smoke", scriptName: "verify:ph1-06", evidence: "Knowledge smoke proves create, update, publish, unpublish, delete, and audit event coverage for FAQ and policy items." }],
  },
  {
    key: "retrieval_evidence_boundaries",
    criterion: "retrieval evidence boundaries",
    ownerSpec: "PH1-07",
    sources: [{ kind: "smoke", scriptName: "verify:ph1-07", evidence: "Retrieval smoke proves published-only evidence, no-evidence handling, and compact retrieval audit summaries." }],
  },
  {
    key: "ai_draft_generation_and_suppression",
    criterion: "AI draft generation and safe suppression",
    ownerSpec: "PH1-08",
    sources: [{ kind: "smoke", scriptName: "verify:ph1-08", evidence: "Draft smoke proves supported generation, cautious fallback, manual regenerate, and unsupported-request suppression." }],
  },
  {
    key: "human_approved_outbound_send",
    criterion: "human-approved outbound send",
    ownerSpec: "PH1-09",
    sources: [{ kind: "smoke", scriptName: "verify:ph1-09", evidence: "Outbound smoke proves draft-backed and manual sends require an explicit server-side send action." }],
  },
  {
    key: "draft_selection_and_send_audit",
    criterion: "audit trail for draft selection and send outcome",
    ownerSpec: "PH1-10",
    sources: [{ kind: "helper", scriptName: "test:ph1-10", evidence: "PH1-10 helpers validate canonical audit events, required payload keys, and release-matrix coverage." }],
  },
  {
    key: "outbound_failure_handling",
    criterion: "safe failure handling for outbound delivery",
    ownerSpec: "PH1-09",
    sources: [{ kind: "smoke", scriptName: "verify:ph1-09", evidence: "Outbound smoke proves distinct retryable and ambiguous failure evidence without fake sent states." }],
  },
  {
    key: "local_release_walkthrough",
    criterion: "documented residual manual local checks",
    ownerSpec: "PH1-10",
    sources: [{ kind: "manual", evidence: "LOCAL_SETUP.md already describes manual PH1-04 through PH1-08 walkthroughs that remain part of final sign-off." }],
  },
];

export function getPrimaryAutomationSource(entry: Phase1AcceptanceMatrixEntry) {
  return entry.sources.find((source) => source.scriptName) ?? null;
}

export function summarizePhase1ReleaseChecks(checks: Phase1ReleaseCheck[]): Phase1ReleaseCheckResult {
  return {
    outcome: checks.some((check) => check.status === "fail") ? "fail" : "pass",
    checks,
  };
}

export function formatPhase1ReleaseResult(result: Phase1ReleaseCheckResult) {
  return [
    `Phase 1 release outcome: ${result.outcome.toUpperCase()}`,
    ...result.checks.map(
      (check) => `[${check.status}] ${check.key} (${check.ownerSpec}) - ${check.evidence}`,
    ),
  ].join("\n");
}
