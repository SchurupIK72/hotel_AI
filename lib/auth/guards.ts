import { redirect } from "next/navigation";
import { AuthenticationRequiredError, AuthorizationError } from "@/lib/auth/errors";
import type { HotelUserAccessContext, SuperAdminAccessContext } from "@/lib/auth/types";
import { getAccessContext } from "@/lib/auth/server";

function handleGuardFailure(error: unknown): never {
  if (error instanceof AuthenticationRequiredError) {
    redirect("/sign-in");
  }

  if (error instanceof AuthorizationError) {
    redirect("/access-denied");
  }

  throw error;
}

export async function requireHotelUser(): Promise<HotelUserAccessContext> {
  try {
    const access = await getAccessContext();

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
    const access = await getAccessContext();

    if (access.kind !== "super_admin") {
      throw new AuthorizationError("Super admin access is required.");
    }

    return access;
  } catch (error) {
    handleGuardFailure(error);
  }
}

