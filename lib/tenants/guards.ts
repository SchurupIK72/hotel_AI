import { AuthorizationError } from "@/lib/auth/errors";
import type { HotelScopedQuery } from "@/lib/auth/types";

export function assertSameHotelResource(
  scope: HotelScopedQuery,
  resourceHotelId: string,
) {
  if (scope.hotelId !== resourceHotelId) {
    throw new AuthorizationError("Requested resource is outside the active hotel scope.");
  }
}

