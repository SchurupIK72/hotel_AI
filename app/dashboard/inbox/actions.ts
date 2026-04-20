"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireHotelUser } from "@/lib/auth/guards";
import { regenerateConversationDrafts } from "@/lib/copilot/generation";
import {
  clearConversationDraftSelection,
  selectConversationDraft,
  sendConversationReply,
} from "@/lib/conversations/replies";
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

function withWorkspaceState(
  path: string,
  input: {
    operationStatus?: "saved" | "error";
    message?: string | null;
    draftId?: string | null;
    replyText?: string | null;
    sendState?: "sent" | "failed_retryable" | "failed_ambiguous" | null;
  },
) {
  const params = new URLSearchParams(path.includes("?") ? path.split("?")[1] : "");
  const basePath = path.split("?")[0];

  if (input.operationStatus) {
    params.set("operationStatus", input.operationStatus);
  }

  if (input.message) {
    params.set("message", input.message);
  }

  if (input.draftId) {
    params.set("draftId", input.draftId);
  } else {
    params.delete("draftId");
  }

  if (input.replyText != null) {
    params.set("replyText", input.replyText);
  } else {
    params.delete("replyText");
  }

  if (input.sendState) {
    params.set("sendState", input.sendState);
  } else {
    params.delete("sendState");
  }

  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function buildDraftOutcomeMessage(result: Awaited<ReturnType<typeof regenerateConversationDrafts>>) {
  if (result.outcome === "generated") {
    return `Generated ${result.drafts.length} draft${result.drafts.length === 1 ? "" : "s"}.`;
  }

  if (result.reason === "unsupported_request") {
    return "Drafts were safely suppressed because this request needs human review.";
  }

  if (result.reason === "human_handoff_mode") {
    return "Draft generation is suppressed while the conversation stays in human handoff mode.";
  }

  return "Drafts were downgraded to a safe non-answer state.";
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
      withWorkspaceState(
        buildInboxHref(conversationId, filter, true),
        {
          operationStatus: "error",
          message: "Conversation status could not be updated.",
        },
      ),
    );
  }

  redirect(
    withWorkspaceState(
      buildInboxHref(conversationId, filter, true),
      {
        operationStatus: "saved",
        message: `Conversation moved to ${result.conversation.status}.`,
      },
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
      withWorkspaceState(
        buildInboxHref(conversationId, filter, true),
        {
          operationStatus: "error",
          message: "Conversation assignment could not be updated.",
        },
      ),
    );
  }

  const keepConversationSelected = filter !== "assigned_to_me" || result.conversation.assignedHotelUserId === access.hotelUserId;
  const message = result.conversation.assignedHotelUserId ? "Conversation assignment updated." : "Conversation unassigned.";
  redirect(
    withWorkspaceState(buildInboxHref(conversationId, filter, keepConversationSelected), {
      operationStatus: "saved",
      message,
    }),
  );
}

export async function regenerateConversationDraftsAction(formData: FormData) {
  const access = await requireHotelUser();
  const conversationId = toValue(formData.get("conversationId"));
  const filter = resolveInboxFilter(formData.get("filter")?.toString());

  try {
    const result = await regenerateConversationDrafts({
      hotelId: access.hotelId,
      conversationId,
    });

    revalidatePath("/dashboard/inbox");
    revalidatePath(`/dashboard/inbox/${conversationId}`);
    redirect(
      withWorkspaceState(buildInboxHref(conversationId, filter, true), {
        operationStatus: "saved",
        message: buildDraftOutcomeMessage(result),
      }),
    );
  } catch (error) {
    revalidatePath("/dashboard/inbox");
    revalidatePath(`/dashboard/inbox/${conversationId}`);
    redirect(
      withWorkspaceState(
        buildInboxHref(conversationId, filter, true),
        {
          operationStatus: "error",
          message: error instanceof Error ? error.message : "Draft regeneration failed.",
        },
      ),
    );
  }
}

export async function selectConversationDraftAction(formData: FormData) {
  const access = await requireHotelUser();
  const conversationId = toValue(formData.get("conversationId"));
  const filter = resolveInboxFilter(formData.get("filter")?.toString());
  const draftId = toValue(formData.get("draftId"));
  const result = await selectConversationDraft({
    hotelId: access.hotelId,
    conversationId,
    draftId,
    actorHotelUserId: access.hotelUserId,
  });

  revalidatePath("/dashboard/inbox");
  revalidatePath(`/dashboard/inbox/${conversationId}`);

  if (!result.ok) {
    redirect(
      withWorkspaceState(buildInboxHref(conversationId, filter, true), {
        operationStatus: "error",
        message: result.errorMessage,
      }),
    );
  }

  redirect(
    withWorkspaceState(buildInboxHref(conversationId, filter, true), {
      operationStatus: "saved",
      message: "Draft loaded into the reply editor.",
      draftId: result.draftId,
      replyText: result.draftText,
    }),
  );
}

export async function clearConversationDraftSelectionAction(formData: FormData) {
  const access = await requireHotelUser();
  const conversationId = toValue(formData.get("conversationId"));
  const filter = resolveInboxFilter(formData.get("filter")?.toString());
  const replyText = formData.get("replyText")?.toString() ?? "";

  await clearConversationDraftSelection({
    hotelId: access.hotelId,
    conversationId,
    actorHotelUserId: access.hotelUserId,
  });

  revalidatePath("/dashboard/inbox");
  revalidatePath(`/dashboard/inbox/${conversationId}`);
  redirect(
    withWorkspaceState(buildInboxHref(conversationId, filter, true), {
      operationStatus: "saved",
      message: "Composer switched to manual reply mode.",
      replyText,
    }),
  );
}

export async function sendConversationReplyAction(formData: FormData) {
  const access = await requireHotelUser();
  const conversationId = toValue(formData.get("conversationId"));
  const filter = resolveInboxFilter(formData.get("filter")?.toString());
  const selectedDraftId = toValue(formData.get("selectedDraftId")) || null;
  const replyText = formData.get("replyText")?.toString() ?? "";
  const operationKey = toValue(formData.get("operationKey"));

  const result = await sendConversationReply({
    hotelId: access.hotelId,
    conversationId,
    replyText,
    selectedDraftId,
    actorHotelUserId: access.hotelUserId,
    operationKey,
  });

  revalidatePath("/dashboard/inbox");
  revalidatePath(`/dashboard/inbox/${conversationId}`);

  if (result.outcome === "sent") {
    redirect(
      withWorkspaceState(buildInboxHref(conversationId, filter, true), {
        operationStatus: "saved",
        message: "Reply sent to the guest.",
        sendState: "sent",
      }),
    );
  }

  redirect(
    withWorkspaceState(buildInboxHref(conversationId, filter, true), {
      operationStatus: "error",
      message: result.message,
      draftId: selectedDraftId,
      replyText,
      sendState: result.failureType === "retryable" ? "failed_retryable" : "failed_ambiguous",
    }),
  );
}
