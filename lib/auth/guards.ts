import { redirect } from "next/navigation";
import {
  AuthorizationError,
  isAuthenticationRequiredError,
  isAuthorizationError,
} from "@/lib/auth/errors";
import type { TelegramSettingsAccess } from "@/lib/auth/telegram-settings-access";
import type { AccessContext, HotelUserAccessContext, SuperAdminAccessContext } from "@/lib/auth/types";
import { getAccessContext, resolveTelegramSettingsAccess } from "@/lib/auth/server";

function handleGuardFailure(error: unknown): never {
  if (isAuthenticationRequiredError(error)) {
    redirect("/sign-in");
  }

  if (isAuthorizationError(error)) {
    redirect("/access-denied");
  }

  throw error;
}

export async function requireDashboardAccess(): Promise<AccessContext> {
  try {
    return await getAccessContext();
  } catch (error) {
    handleGuardFailure(error);
  }
}

export async function requireHotelUser(): Promise<HotelUserAccessContext> {
  try {
    const access = await requireDashboardAccess();

    if (access.kind !== "hotel_user") {
      throw new AuthorizationError("Hotel staff access is required.");
    }

    return access;
  } catch (error) {
    handleGuardFailure(error);
  }
}

export async function requireHotelAdmin(): Promise<HotelUserAccessContext> {
  const access = await requireHotelUser();

  if (access.hotelRole !== "hotel_admin") {
    redirect("/access-denied");
  }

  return access;
}

export async function requireSuperAdmin(): Promise<SuperAdminAccessContext> {
  try {
    const access = await requireDashboardAccess();

    if (access.kind !== "super_admin") {
      throw new AuthorizationError("Super admin access is required.");
    }

    return access;
  } catch (error) {
    handleGuardFailure(error);
  }
}

export async function requireTelegramSettingsAccess(
  requestedHotelId?: string | null,
): Promise<TelegramSettingsAccess> {
  try {
    return await resolveTelegramSettingsAccess(requestedHotelId);
  } catch (error) {
    handleGuardFailure(error);
  }
}
