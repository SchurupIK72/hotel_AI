import { createServerSupabaseClient } from "@/lib/supabase/server";
import { findActiveHotelUserById, listActiveHotelUsersByHotelId } from "@/lib/db/hotel-users";
import { createEventLogSafely } from "@/lib/events/event-logs";
import { isConversationStatus, type ConversationStatus } from "@/lib/conversations/models";

type ConversationMutationRow = {
  id: string;
  status: ConversationStatus;
  assigned_hotel_user_id: string | null;
  unread_count: number;
  updated_at: string;
};

export type ConversationOperationSnapshot = {
  id: string;
  status: ConversationStatus;
  assignedHotelUserId: string | null;
  unreadCount: number;
  updatedAt: string;
};

export type ConversationOperationResult =
  | { ok: true; conversation: ConversationOperationSnapshot }
  | { ok: false; errorCode: "not_found" | "invalid_status" | "invalid_assignee"; errorMessage: string };

type OperationsSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

function toSnapshot(conversation: ConversationMutationRow): ConversationOperationSnapshot {
  return {
    id: conversation.id,
    status: conversation.status,
    assignedHotelUserId: conversation.assigned_hotel_user_id,
    unreadCount: conversation.unread_count,
    updatedAt: conversation.updated_at,
  };
}

async function getConversationForMutation(
  supabase: OperationsSupabaseClient,
  hotelId: string,
  conversationId: string,
) {
  const { data, error } = await supabase
    .from("conversations")
    .select("id, status, assigned_hotel_user_id, unread_count, updated_at")
    .eq("hotel_id", hotelId)
    .eq("id", conversationId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as ConversationMutationRow | null) ?? null;
}

async function logRejectedOperation(hotelId: string, conversationId: string, actorHotelUserId: string, reason: string) {
  await createEventLogSafely({
    hotelId,
    entityType: "conversation",
    entityId: conversationId,
    eventType: "conversation_operation_rejected",
    payload: { actorHotelUserId, reason },
  });
}

export async function listAssignableHotelUsers(hotelId: string) {
  const supabase = await createServerSupabaseClient();
  return listActiveHotelUsersByHotelId(supabase, hotelId);
}

export async function updateConversationStatusWithClient(
  supabase: OperationsSupabaseClient,
  input: { hotelId: string; conversationId: string; nextStatus: string; actorHotelUserId: string },
): Promise<ConversationOperationResult> {
  if (!isConversationStatus(input.nextStatus)) {
    await logRejectedOperation(input.hotelId, input.conversationId, input.actorHotelUserId, "invalid_status");
    return { ok: false, errorCode: "invalid_status", errorMessage: "Unsupported conversation status." };
  }

  const existing = await getConversationForMutation(supabase, input.hotelId, input.conversationId);
  if (!existing) {
    await logRejectedOperation(input.hotelId, input.conversationId, input.actorHotelUserId, "not_found");
    return { ok: false, errorCode: "not_found", errorMessage: "Conversation was not found." };
  }

  if (existing.status === input.nextStatus) {
    return { ok: true, conversation: toSnapshot(existing) };
  }

  const { data, error } = await supabase
    .from("conversations")
    .update({ status: input.nextStatus } as never)
    .eq("hotel_id", input.hotelId)
    .eq("id", input.conversationId)
    .select("id, status, assigned_hotel_user_id, unread_count, updated_at")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const updated = data as unknown as ConversationMutationRow;
  await createEventLogSafely({
    hotelId: input.hotelId,
    entityType: "conversation",
    entityId: input.conversationId,
    eventType: "conversation_status_changed",
    payload: { actorHotelUserId: input.actorHotelUserId, nextStatus: updated.status },
  });
  return { ok: true, conversation: toSnapshot(updated) };
}

export async function updateConversationStatus(input: {
  hotelId: string;
  conversationId: string;
  nextStatus: string;
  actorHotelUserId: string;
}) {
  const supabase = await createServerSupabaseClient();
  return updateConversationStatusWithClient(supabase, input);
}

export async function assignConversationWithClient(
  supabase: OperationsSupabaseClient,
  input: { hotelId: string; conversationId: string; assignedHotelUserId: string | null; actorHotelUserId: string },
): Promise<ConversationOperationResult> {
  const existing = await getConversationForMutation(supabase, input.hotelId, input.conversationId);
  if (!existing) {
    await logRejectedOperation(input.hotelId, input.conversationId, input.actorHotelUserId, "not_found");
    return { ok: false, errorCode: "not_found", errorMessage: "Conversation was not found." };
  }

  if (input.assignedHotelUserId) {
    const assignee = await findActiveHotelUserById(supabase, input.hotelId, input.assignedHotelUserId);
    if (!assignee) {
      await logRejectedOperation(input.hotelId, input.conversationId, input.actorHotelUserId, "invalid_assignee");
      return { ok: false, errorCode: "invalid_assignee", errorMessage: "Assignee must be active hotel staff." };
    }
  }

  const { data, error } = await supabase
    .from("conversations")
    .update({ assigned_hotel_user_id: input.assignedHotelUserId } as never)
    .eq("hotel_id", input.hotelId)
    .eq("id", input.conversationId)
    .select("id, status, assigned_hotel_user_id, unread_count, updated_at")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const updated = data as unknown as ConversationMutationRow;
  await createEventLogSafely({
    hotelId: input.hotelId,
    entityType: "conversation",
    entityId: input.conversationId,
    eventType: input.assignedHotelUserId ? "conversation_assigned" : "conversation_unassigned",
    payload: { actorHotelUserId: input.actorHotelUserId, assignedHotelUserId: updated.assigned_hotel_user_id },
  });
  return { ok: true, conversation: toSnapshot(updated) };
}

export async function assignConversation(input: {
  hotelId: string;
  conversationId: string;
  assignedHotelUserId: string | null;
  actorHotelUserId: string;
}) {
  const supabase = await createServerSupabaseClient();
  return assignConversationWithClient(supabase, input);
}

export async function clearConversationUnreadWithClient(
  supabase: OperationsSupabaseClient,
  input: { hotelId: string; conversationId: string; actorHotelUserId: string },
): Promise<ConversationOperationResult> {
  const existing = await getConversationForMutation(supabase, input.hotelId, input.conversationId);
  if (!existing) {
    await logRejectedOperation(input.hotelId, input.conversationId, input.actorHotelUserId, "not_found");
    return { ok: false, errorCode: "not_found", errorMessage: "Conversation was not found." };
  }

  if (existing.unread_count === 0) {
    return { ok: true, conversation: toSnapshot(existing) };
  }

  const { data, error } = await supabase
    .from("conversations")
    .update({ unread_count: 0 } as never)
    .eq("hotel_id", input.hotelId)
    .eq("id", input.conversationId)
    .select("id, status, assigned_hotel_user_id, unread_count, updated_at")
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  const updated = data as unknown as ConversationMutationRow;
  await createEventLogSafely({
    hotelId: input.hotelId,
    entityType: "conversation",
    entityId: input.conversationId,
    eventType: "conversation_unread_cleared",
    payload: { actorHotelUserId: input.actorHotelUserId },
  });
  return { ok: true, conversation: toSnapshot(updated) };
}

export async function clearConversationUnread(input: {
  hotelId: string;
  conversationId: string;
  actorHotelUserId: string;
}) {
  const supabase = await createServerSupabaseClient();
  return clearConversationUnreadWithClient(supabase, input);
}
