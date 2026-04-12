import { cache } from "react";
import {
  AuthenticationRequiredError,
  AuthorizationError,
  isMissingAuthSessionError,
} from "@/lib/auth/errors";
import type { AccessContext, SuperAdminAccessContext } from "@/lib/auth/types";
import { findActiveHotelMembershipByAuthUserId } from "@/lib/db/hotel-users";
import { getSuperAdminEmails } from "@/lib/env";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const getAuthenticatedUser = cache(async () => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    if (isMissingAuthSessionError(error)) {
      throw new AuthenticationRequiredError();
    }

    throw error;
  }

  if (!user) {
    throw new AuthenticationRequiredError();
  }

  return user;
});

function resolveSuperAdmin(authUserId: string, email: string | null): SuperAdminAccessContext | null {
  if (!email) {
    return null;
  }

  const allowedEmails = getSuperAdminEmails();
  if (!allowedEmails.includes(email.toLowerCase())) {
    return null;
  }

  return {
    kind: "super_admin",
    authUserId,
    email,
  };
}

export const getAccessContext = cache(async (): Promise<AccessContext> => {
  const user = await getAuthenticatedUser();
  const email = user.email ?? null;

  const superAdmin = resolveSuperAdmin(user.id, email);
  if (superAdmin) {
    return superAdmin;
  }

  const supabase = await createServerSupabaseClient();
  const membership = await findActiveHotelMembershipByAuthUserId(supabase, user.id);

  if (!membership) {
    throw new AuthorizationError("Your account does not have an active hotel membership.");
  }

  return {
    kind: "hotel_user",
    authUserId: user.id,
    email,
    hotelId: membership.hotelId,
    hotelName: membership.hotelName,
    hotelSlug: membership.hotelSlug,
    hotelUserId: membership.hotelUserId,
    hotelRole: membership.hotelRole,
  };
});
