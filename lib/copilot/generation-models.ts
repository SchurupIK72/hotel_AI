import type { RetrievalResult, RetrievalStatus } from "@/lib/knowledge/retrieval-models";

export type DraftGenerationTrigger = "auto_on_inbound" | "manual_regenerate";
export type DraftSuppressionReason =
  | "unsupported_request"
  | "insufficient_evidence"
  | "human_handoff_mode"
  | "generation_failed";

export type DraftGenerationDecision =
  | { action: "generate"; mode: "knowledge_answer" | "clarification_fallback" }
  | { action: "suppress"; reason: DraftSuppressionReason };

export type DraftVariant = {
  draftIndex: number;
  draftText: string;
  sourceType: "kb" | "fallback" | "manual_trigger";
  confidenceLabel: string | null;
};

export type GenerateConversationDraftsResult =
  | { outcome: "generated"; retrievalStatus: RetrievalStatus; drafts: DraftVariant[] }
  | { outcome: "suppressed"; reason: DraftSuppressionReason; retrievalStatus: RetrievalStatus | null };

const UNSUPPORTED_PATTERNS = [
  /\b(price|pricing|rate|cost|quote|discount)\b/i,
  /\b(available|availability|vacancy|vacancies)\b/i,
  /\b(book|booking|reservation|reserved)\b/i,
  /\b(cancel|cancellation|modify|change reservation)\b/i,
  /\b(refund|chargeback|compensation|complaint)\b/i,
  /\b(vip|upgrade|exception|override)\b/i,
  /\b(payment|paid|invoice|bill|charged)\b/i,
];

function normalizeSentence(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "";
  }

  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function createKnowledgeDrafts(result: RetrievalResult): DraftVariant[] {
  const primary = normalizeSentence(result.evidence[0]?.excerpt ?? "");
  const supporting = normalizeSentence(result.evidence[1]?.excerpt ?? "");

  return [
    {
      draftIndex: 1,
      draftText: `Thanks for your message. ${primary} Let us know if you need anything else.`,
      sourceType: "kb",
      confidenceLabel: "knowledge-backed",
    },
    {
      draftIndex: 2,
      draftText: `Hello! ${primary} If helpful, we can clarify any other hotel details here as well.`,
      sourceType: "kb",
      confidenceLabel: "knowledge-backed",
    },
    {
      draftIndex: 3,
      draftText: supporting
        ? `Certainly. ${primary} ${supporting} Please let us know if you would like anything else clarified.`
        : `Certainly. ${primary} Please let us know if you would like anything else clarified.`,
      sourceType: "kb",
      confidenceLabel: "knowledge-backed",
    },
  ];
}

function createClarificationDrafts(trigger: DraftGenerationTrigger): DraftVariant[] {
  const sourceType = trigger === "manual_regenerate" ? "manual_trigger" : "fallback";

  return [
    {
      draftIndex: 1,
      draftText:
        "Thanks for your message. I want to make sure we give you the right information, so a hotel team member should confirm the details before we reply.",
      sourceType,
      confidenceLabel: "clarification-needed",
    },
    {
      draftIndex: 2,
      draftText:
        "Hello. To avoid giving you inaccurate information, we should first confirm the details with the hotel team and then send you a precise reply.",
      sourceType,
      confidenceLabel: "human-review",
    },
  ];
}

export function evaluateDraftGenerationSafety(messageText: string, retrievalResult: RetrievalResult): DraftGenerationDecision {
  const normalized = messageText.trim();
  if (!normalized) {
    return { action: "suppress", reason: "generation_failed" };
  }

  if (UNSUPPORTED_PATTERNS.some((pattern) => pattern.test(normalized))) {
    return { action: "suppress", reason: "unsupported_request" };
  }

  if (retrievalResult.status === "evidence_found") {
    return { action: "generate", mode: "knowledge_answer" };
  }

  return { action: "generate", mode: "clarification_fallback" };
}

export function createDraftVariantsFromContext(
  messageText: string,
  trigger: DraftGenerationTrigger,
  retrievalResult: RetrievalResult,
): GenerateConversationDraftsResult {
  const decision = evaluateDraftGenerationSafety(messageText, retrievalResult);
  if (decision.action === "suppress") {
    return {
      outcome: "suppressed",
      reason: decision.reason,
      retrievalStatus: retrievalResult.status,
    };
  }

  return {
    outcome: "generated",
    retrievalStatus: retrievalResult.status,
    drafts:
      decision.mode === "knowledge_answer"
        ? createKnowledgeDrafts(retrievalResult)
        : createClarificationDrafts(trigger),
  };
}
