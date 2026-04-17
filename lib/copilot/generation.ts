import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleSupabaseClient } from "../supabase/admin.ts";
import { createEventLogSafely } from "../events/event-logs.ts";
import { createRetrievalHandoffContract } from "../knowledge/retrieval-models.ts";
import { retrieveKnowledgeWithClient } from "../knowledge/retrieval-service.ts";
import {
  createDraftVariantsFromContext,
  type DraftGenerationTrigger,
  type GenerateConversationDraftsResult,
} from "./generation-models.ts";
import { listLatestDraftsForMessageWithClient } from "./store.ts";
import type { Database } from "../../types/database.ts";

type CopilotSupabaseClient = {
  from: SupabaseClient<Database>["from"];
};
type ConversationRow = Database["public"]["Tables"]["conversations"]["Row"];
type MessageRow = Database["public"]["Tables"]["messages"]["Row"];
const PH1_08_GENERATOR_MODEL = "ph1-08-template-generator";

async function getConversationAndMessage(
  supabase: CopilotSupabaseClient,
  hotelId: string,
  conversationId: string,
  messageId: string,
) {
  const [{ data: conversation, error: conversationError }, { data: message, error: messageError }] = await Promise.all([
    supabase
      .from("conversations")
      .select("*")
      .eq("hotel_id", hotelId)
      .eq("id", conversationId)
      .limit(1)
      .maybeSingle(),
    supabase
      .from("messages")
      .select("*")
      .eq("hotel_id", hotelId)
      .eq("conversation_id", conversationId)
      .eq("id", messageId)
      .limit(1)
      .maybeSingle(),
  ]);

  if (conversationError) throw conversationError;
  if (messageError) throw messageError;
  if (!conversation || !message) {
    throw new Error("Conversation or trigger message is not available in the current hotel scope.");
  }

  return { conversation: conversation as ConversationRow, message: message as MessageRow };
}

async function getLatestInboundMessageId(
  supabase: CopilotSupabaseClient,
  hotelId: string,
  conversationId: string,
) {
  const { data, error } = await supabase
    .from("messages")
    .select("id")
    .eq("hotel_id", hotelId)
    .eq("conversation_id", conversationId)
    .eq("direction", "inbound")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as { id: string } | null)?.id ?? null;
}

async function persistGeneratedDrafts(
  supabase: CopilotSupabaseClient,
  input: {
    hotelId: string;
    conversationId: string;
    messageId: string;
    drafts: Exclude<GenerateConversationDraftsResult, { outcome: "suppressed" }>["drafts"];
    retrievalRefs: ReturnType<typeof createRetrievalHandoffContract>;
  },
) {
  const generationId = randomUUID();
  const createdAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("ai_drafts")
    .insert(
      input.drafts.map((draft) => ({
        generation_id: generationId,
        hotel_id: input.hotelId,
        conversation_id: input.conversationId,
        message_id: input.messageId,
        draft_index: draft.draftIndex,
        draft_text: draft.draftText,
        source_type: draft.sourceType,
        status: "generated",
        retrieval_refs: input.retrievalRefs.evidenceRefs,
        model_name: PH1_08_GENERATOR_MODEL,
        confidence_label: draft.confidenceLabel,
        created_at: createdAt,
      })) as never,
    )
    .select("*");

  if (error) throw error;

  await supabase
    .from("conversations")
    .update({ last_ai_draft_at: createdAt } as never)
    .eq("hotel_id", input.hotelId)
    .eq("id", input.conversationId);

  return data;
}

export async function generateConversationDraftsWithClient(
  supabase: CopilotSupabaseClient,
  input: {
    hotelId: string;
    conversationId: string;
    triggerMessageId: string;
    trigger: DraftGenerationTrigger;
  },
): Promise<GenerateConversationDraftsResult> {
  const existingDrafts =
    input.trigger === "auto_on_inbound"
      ? await listLatestDraftsForMessageWithClient(supabase, input.hotelId, input.conversationId, input.triggerMessageId)
      : [];

  if (existingDrafts.length > 0) {
    return {
      outcome: "generated",
      retrievalStatus: existingDrafts[0]?.sourceType === "kb" ? "evidence_found" : "insufficient_evidence",
      drafts: existingDrafts.map((draft) => ({
        draftIndex: draft.draftIndex,
        draftText: draft.draftText,
        sourceType: draft.sourceType,
        confidenceLabel: draft.confidenceLabel,
      })),
    };
  }

  const { conversation, message } = await getConversationAndMessage(
    supabase,
    input.hotelId,
    input.conversationId,
    input.triggerMessageId,
  );
  const latestInboundMessageId = await getLatestInboundMessageId(supabase, input.hotelId, input.conversationId);

  if (conversation.mode === "human_handoff_mode") {
    return { outcome: "suppressed", reason: "human_handoff_mode", retrievalStatus: null };
  }
  if (message.direction !== "inbound" || latestInboundMessageId !== message.id) {
    throw new Error("Draft generation can run only for the latest inbound message in the conversation.");
  }

  const retrievalResult = await retrieveKnowledgeWithClient(supabase, {
    hotelId: input.hotelId,
    conversationId: input.conversationId,
    messageId: input.triggerMessageId,
    messageText: message.text_body,
  });
  const generationResult = createDraftVariantsFromContext(message.text_body, input.trigger, retrievalResult);

  if (generationResult.outcome === "suppressed") {
    await createEventLogSafely({
      hotelId: input.hotelId,
      entityType: "conversation",
      entityId: input.conversationId,
      eventType: "ai_drafts_suppressed",
      payload: {
        messageId: input.triggerMessageId,
        trigger: input.trigger,
        reason: generationResult.reason,
        retrievalStatus: generationResult.retrievalStatus,
      },
    });
    return generationResult;
  }

  const retrievalRefs = createRetrievalHandoffContract(retrievalResult);
  await persistGeneratedDrafts(supabase, {
    hotelId: input.hotelId,
    conversationId: input.conversationId,
    messageId: input.triggerMessageId,
    drafts: generationResult.drafts,
    retrievalRefs,
  });
  await createEventLogSafely({
    hotelId: input.hotelId,
    entityType: "conversation",
    entityId: input.conversationId,
    eventType: "ai_drafts_generated",
    payload: {
      messageId: input.triggerMessageId,
      trigger: input.trigger,
      retrievalStatus: generationResult.retrievalStatus,
      retrievalRefs: retrievalRefs.evidenceSummary,
      draftCount: generationResult.drafts.length,
      modelName: PH1_08_GENERATOR_MODEL,
    },
  });

  return generationResult;
}

export async function generateConversationDrafts(input: {
  hotelId: string;
  conversationId: string;
  triggerMessageId: string;
  trigger: DraftGenerationTrigger;
}) {
  const { createServerSupabaseClient } = await import("../supabase/server.ts");
  const supabase = await createServerSupabaseClient();
  return generateConversationDraftsWithClient(supabase, input);
}

export async function maybeAutoGenerateDraftsForMessage(input: {
  hotelId: string;
  conversationId: string;
  messageId: string;
}) {
  const supabase = createServiceRoleSupabaseClient();
  return generateConversationDraftsWithClient(supabase, {
    hotelId: input.hotelId,
    conversationId: input.conversationId,
    triggerMessageId: input.messageId,
    trigger: "auto_on_inbound",
  });
}
