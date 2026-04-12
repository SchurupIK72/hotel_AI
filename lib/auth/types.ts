export type SuperAdminAccessContext = {
  kind: "super_admin";
  authUserId: string;
  email: string | null;
};

export type HotelRole = "hotel_admin" | "manager";

export type HotelUserAccessContext = {
  kind: "hotel_user";
  authUserId: string;
  email: string | null;
  hotelId: string;
  hotelName: string | null;
  hotelSlug: string | null;
  hotelUserId: string;
  hotelRole: HotelRole;
};

export type AccessContext = SuperAdminAccessContext | HotelUserAccessContext;

export type HotelScopedQuery = {
  hotelId: string;
};

