import { AuthorizationError } from "./errors.ts";
import type { AccessContext } from "./types.ts";
import type { HotelSummary } from "../db/hotels.ts";

export type TelegramSettingsAccess =
  | {
      actorKind: "hotel_admin";
      authUserId: string;
      hotelId: string;
      hotelName: string | null;
      hotelSlug: string | null;
      hotelUserId: string;
    }
  | {
      actorKind: "super_admin";
      authUserId: string;
      hotelId: string;
      hotelName: string | null;
      hotelSlug: string | null;
      hotelUserId: null;
    }
  | {
      actorKind: "super_admin_missing_hotel";
      authUserId: string;
      email: string | null;
    };

export function resolveTelegramSettingsAccessFromContext(
  access: AccessContext,
  input: {
    requestedHotelId?: string | null;
    targetHotel: HotelSummary | null;
  },
): TelegramSettingsAccess {
  if (access.kind === "hotel_user") {
    if (access.hotelRole !== "hotel_admin") {
      throw new AuthorizationError("Hotel admin access is required.");
    }

    return {
      actorKind: "hotel_admin",
      authUserId: access.authUserId,
      hotelId: access.hotelId,
      hotelName: access.hotelName,
      hotelSlug: access.hotelSlug,
      hotelUserId: access.hotelUserId,
    };
  }

  const normalizedHotelId = input.requestedHotelId?.trim() ?? "";
  if (!normalizedHotelId) {
    return {
      actorKind: "super_admin_missing_hotel",
      authUserId: access.authUserId,
      email: access.email,
    };
  }

  if (!input.targetHotel || input.targetHotel.id !== normalizedHotelId) {
    throw new AuthorizationError("Requested hotel is not available.");
  }

  return {
    actorKind: "super_admin",
    authUserId: access.authUserId,
    hotelId: input.targetHotel.id,
    hotelName: input.targetHotel.name,
    hotelSlug: input.targetHotel.slug,
    hotelUserId: null,
  };
}
