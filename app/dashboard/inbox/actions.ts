"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireHotelUser } from "@/lib/auth/guards";
import { assignConversation, updateConversationStatus } from "@/lib/conversations/operations";
import { resolveInboxFilter } from "@/lib/conversations/models";

function toValue(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function buildInboxHref(conversationId: string, filter: string, keepConversationSelected: boolean) {
  const filterSuffix = filter === "all" ? "" : `?filter=${filter}`;
  if (!keepConversationSelected) {
    return `/dashboard/inbox${filterSuffix}`;
  }

  return filter === "all"
    ? `/dashboard/inbox/${conversationId}`
    : `/dashboard/inbox/${conversationId}?filter=${filter}`;
}

function withOperationMessage(path: string, operationStatus: "saved" | "error", message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}operationStatus=${operationStatus}&message=${encodeURIComponent(message)}`;
}

export async function updateConversationStatusAction(formData: FormData) {
  const access = await requireHotelUser();
  const conversationId = toValue(formData.get("conversationId"));
  const filter = resolveInboxFilter(formData.get("filter")?.toString());
  const nextStatus = toValue(formData.get("nextStatus"));
  const result = await updateConversationStatus({
    hotelId: access.hotelId,
    conversationId,
    nextStatus,
    actorHotelUserId: access.hotelUserId,
  });

  revalidatePath("/dashboard/inbox");
  revalidatePath(`/dashboard/inbox/${conversationId}`);

  if (!result.ok) {
    redirect(
      withOperationMessage(
        buildInboxHref(conversationId, filter, true),
        "error",
        "Conversation status could not be updated.",
      ),
    );
  }

  redirect(
    withOperationMessage(
      buildInboxHref(conversationId, filter, true),
      "saved",
      `Conversation moved to ${result.conversation.status}.`,
    ),
  );
}

export async function assignConversationAction(formData: FormData) {
  const access = await requireHotelUser();
  const conversationId = toValue(formData.get("conversationId"));
  const filter = resolveInboxFilter(formData.get("filter")?.toString());
  const assignedHotelUserId = toValue(formData.get("assignedHotelUserId")) || null;
  const result = await assignConversation({
    hotelId: access.hotelId,
    conversationId,
    assignedHotelUserId,
    actorHotelUserId: access.hotelUserId,
  });

  revalidatePath("/dashboard/inbox");
  revalidatePath(`/dashboard/inbox/${conversationId}`);

  if (!result.ok) {
    redirect(
      withOperationMessage(
        buildInboxHref(conversationId, filter, true),
        "error",
        "Conversation assignment could not be updated.",
      ),
    );
  }

  const keepConversationSelected = filter !== "assigned_to_me" || result.conversation.assignedHotelUserId === access.hotelUserId;
  const message = result.conversation.assignedHotelUserId ? "Conversation assignment updated." : "Conversation unassigned.";
  redirect(withOperationMessage(buildInboxHref(conversationId, filter, keepConversationSelected), "saved", message));
}
