"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireHotelAdmin } from "@/lib/auth/guards";
import { deactivateTelegramIntegration, saveTelegramIntegration } from "@/lib/telegram/integrations";

function toSearchParamValue(value: FormDataEntryValue | null) {
  return String(value ?? "").trim();
}

export async function saveTelegramIntegrationAction(formData: FormData) {
  const access = await requireHotelAdmin();
  const name = toSearchParamValue(formData.get("name"));
  const botToken = toSearchParamValue(formData.get("botToken"));
  const webhookSecret = toSearchParamValue(formData.get("webhookSecret"));

  if (!name) {
    redirect("/dashboard/settings/telegram?status=error&message=Integration%20name%20is%20required.");
  }

  if (!botToken) {
    redirect("/dashboard/settings/telegram?status=error&message=Telegram%20bot%20token%20is%20required.");
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
    const message = encodeURIComponent(result.errorMessage);
    redirect(`/dashboard/settings/telegram?status=error&message=${message}`);
  }

  const successMessage = encodeURIComponent(
    result.botUsername
      ? `Telegram integration saved and verified as @${result.botUsername}.`
      : "Telegram integration saved and verified.",
  );
  redirect(`/dashboard/settings/telegram?status=saved&message=${successMessage}`);
}

export async function deactivateTelegramIntegrationAction() {
  const access = await requireHotelAdmin();
  const didDeactivate = await deactivateTelegramIntegration(access.hotelId);

  revalidatePath("/dashboard/settings/telegram");

  if (!didDeactivate) {
    redirect("/dashboard/settings/telegram?status=error&message=No%20active%20Telegram%20integration%20to%20deactivate.");
  }

  redirect("/dashboard/settings/telegram?status=saved&message=Telegram%20integration%20deactivated.");
}
