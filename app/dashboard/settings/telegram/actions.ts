"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTelegramSettingsAccess } from "@/lib/auth/guards";
import { deactivateTelegramIntegration, saveTelegramIntegration } from "@/lib/telegram/integrations";

function toSearchParamValue(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

function buildTelegramSettingsPath(hotelId?: string | null) {
  return hotelId
    ? `/dashboard/settings/telegram?hotelId=${encodeURIComponent(hotelId)}`
    : "/dashboard/settings/telegram";
}

function withStatus(path: string, status: "saved" | "error", message: string) {
  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}status=${status}&message=${encodeURIComponent(message)}`;
}

export async function saveTelegramIntegrationAction(formData: FormData) {
  const requestedHotelId = toSearchParamValue(formData.get("hotelId")) || null;
  const access = await requireTelegramSettingsAccess(requestedHotelId);
  const name = toSearchParamValue(formData.get("name"));
  const botToken = toSearchParamValue(formData.get("botToken"));
  const webhookSecret = toSearchParamValue(formData.get("webhookSecret"));
  const path =
    access.actorKind === "super_admin_missing_hotel"
      ? buildTelegramSettingsPath(requestedHotelId)
      : buildTelegramSettingsPath(access.actorKind === "super_admin" ? access.hotelId : null);

  if (access.actorKind === "super_admin_missing_hotel") {
    redirect(withStatus(path, "error", "Select a target hotel before managing Telegram settings."));
  }

  if (!name) {
    redirect(withStatus(path, "error", "Integration name is required."));
  }

  if (!botToken) {
    redirect(withStatus(path, "error", "Telegram bot token is required."));
  }

  const result = await saveTelegramIntegration({
    hotelId: access.hotelId,
    hotelUserId: access.hotelUserId,
    name,
    botToken,
    webhookSecret,
  });

  revalidatePath("/dashboard/settings/telegram");

  if (!result.ok) {
    redirect(withStatus(path, "error", result.errorMessage));
  }

  const successMessage =
    result.botUsername
      ? `Telegram integration saved and verified as @${result.botUsername}.`
      : "Telegram integration saved and verified.";
  redirect(withStatus(path, "saved", successMessage));
}

export async function deactivateTelegramIntegrationAction(formData: FormData) {
  const requestedHotelId = toSearchParamValue(formData.get("hotelId")) || null;
  const access = await requireTelegramSettingsAccess(requestedHotelId);
  const path =
    access.actorKind === "super_admin_missing_hotel"
      ? buildTelegramSettingsPath(requestedHotelId)
      : buildTelegramSettingsPath(access.actorKind === "super_admin" ? access.hotelId : null);

  if (access.actorKind === "super_admin_missing_hotel") {
    redirect(withStatus(path, "error", "Select a target hotel before managing Telegram settings."));
  }

  const didDeactivate = await deactivateTelegramIntegration(access.hotelId);

  revalidatePath("/dashboard/settings/telegram");

  if (!didDeactivate) {
    redirect(withStatus(path, "error", "No active Telegram integration to deactivate."));
  }

  redirect(withStatus(path, "saved", "Telegram integration deactivated."));
}
