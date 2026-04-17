"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireHotelAdmin } from "@/lib/auth/guards";
import {
  createFaqItem,
  createPolicyItem,
  deleteFaqItem,
  deletePolicyItem,
  setFaqItemPublished,
  setPolicyItemPublished,
  updateFaqItem,
  updatePolicyItem,
} from "@/lib/knowledge/store";

function toValue(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function withMessage(status: "saved" | "error", message: string) {
  return `/dashboard/knowledge?status=${status}&message=${encodeURIComponent(message)}`;
}

function requireNonEmpty(value: string, message: string) {
  if (!value) {
    redirect(withMessage("error", message));
  }
}

async function togglePublishedKnowledgeItem(input: {
  itemId: string;
  itemType: "faq" | "policy";
  isPublished: boolean;
}) {
  const access = await requireHotelAdmin();
  const result =
    input.itemType === "faq"
      ? await setFaqItemPublished({
          hotelId: access.hotelId,
          faqItemId: input.itemId,
          actorHotelUserId: access.hotelUserId,
          isPublished: input.isPublished,
        })
      : await setPolicyItemPublished({
          hotelId: access.hotelId,
          policyItemId: input.itemId,
          actorHotelUserId: access.hotelUserId,
          isPublished: input.isPublished,
        });
  revalidatePath("/dashboard/knowledge");
  const itemLabel = input.itemType === "faq" ? "FAQ item" : "Policy item";
  const successMessage = input.isPublished ? `${itemLabel} published.` : `${itemLabel} moved to draft.`;
  const errorMessage = input.isPublished ? `${itemLabel} could not be published.` : `${itemLabel} could not be unpublished.`;
  redirect(withMessage(result.ok ? "saved" : "error", result.ok ? successMessage : errorMessage));
}

export async function createFaqItemAction(formData: FormData) {
  const access = await requireHotelAdmin();
  const question = toValue(formData.get("question"));
  const answer = toValue(formData.get("answer"));
  requireNonEmpty(question, "FAQ question is required.");
  requireNonEmpty(answer, "FAQ answer is required.");

  const result = await createFaqItem({
    hotelId: access.hotelId,
    actorHotelUserId: access.hotelUserId,
    question,
    answer,
  });
  revalidatePath("/dashboard/knowledge");
  redirect(withMessage(result.ok ? "saved" : "error", result.ok ? "FAQ item created." : "FAQ item could not be created."));
}

export async function updateFaqItemAction(formData: FormData) {
  const access = await requireHotelAdmin();
  const faqItemId = toValue(formData.get("faqItemId"));
  const question = toValue(formData.get("question"));
  const answer = toValue(formData.get("answer"));
  requireNonEmpty(question, "FAQ question is required.");
  requireNonEmpty(answer, "FAQ answer is required.");

  const result = await updateFaqItem({
    hotelId: access.hotelId,
    faqItemId,
    actorHotelUserId: access.hotelUserId,
    question,
    answer,
  });
  revalidatePath("/dashboard/knowledge");
  redirect(withMessage(result.ok ? "saved" : "error", result.ok ? "FAQ item updated." : "FAQ item could not be updated."));
}

export async function deleteFaqItemAction(formData: FormData) {
  const access = await requireHotelAdmin();
  const faqItemId = toValue(formData.get("faqItemId"));
  const result = await deleteFaqItem({
    hotelId: access.hotelId,
    faqItemId,
    actorHotelUserId: access.hotelUserId,
  });
  revalidatePath("/dashboard/knowledge");
  redirect(withMessage(result.ok ? "saved" : "error", result.ok ? "FAQ item deleted." : "FAQ item could not be deleted."));
}

export async function setFaqItemPublishedAction(formData: FormData) {
  const faqItemId = toValue(formData.get("faqItemId"));
  const isPublished = toValue(formData.get("isPublished")) === "true";
  return togglePublishedKnowledgeItem({ itemId: faqItemId, itemType: "faq", isPublished });
}

export async function createPolicyItemAction(formData: FormData) {
  const access = await requireHotelAdmin();
  const title = toValue(formData.get("title"));
  const body = toValue(formData.get("body"));
  requireNonEmpty(title, "Policy title is required.");
  requireNonEmpty(body, "Policy body is required.");

  const result = await createPolicyItem({
    hotelId: access.hotelId,
    actorHotelUserId: access.hotelUserId,
    title,
    body,
  });
  revalidatePath("/dashboard/knowledge");
  redirect(withMessage(result.ok ? "saved" : "error", result.ok ? "Policy item created." : "Policy item could not be created."));
}

export async function updatePolicyItemAction(formData: FormData) {
  const access = await requireHotelAdmin();
  const policyItemId = toValue(formData.get("policyItemId"));
  const title = toValue(formData.get("title"));
  const body = toValue(formData.get("body"));
  requireNonEmpty(title, "Policy title is required.");
  requireNonEmpty(body, "Policy body is required.");

  const result = await updatePolicyItem({
    hotelId: access.hotelId,
    policyItemId,
    actorHotelUserId: access.hotelUserId,
    title,
    body,
  });
  revalidatePath("/dashboard/knowledge");
  redirect(withMessage(result.ok ? "saved" : "error", result.ok ? "Policy item updated." : "Policy item could not be updated."));
}

export async function deletePolicyItemAction(formData: FormData) {
  const access = await requireHotelAdmin();
  const policyItemId = toValue(formData.get("policyItemId"));
  const result = await deletePolicyItem({
    hotelId: access.hotelId,
    policyItemId,
    actorHotelUserId: access.hotelUserId,
  });
  revalidatePath("/dashboard/knowledge");
  redirect(withMessage(result.ok ? "saved" : "error", result.ok ? "Policy item deleted." : "Policy item could not be deleted."));
}

export async function setPolicyItemPublishedAction(formData: FormData) {
  const policyItemId = toValue(formData.get("policyItemId"));
  const isPublished = toValue(formData.get("isPublished")) === "true";
  return togglePublishedKnowledgeItem({ itemId: policyItemId, itemType: "policy", isPublished });
}
