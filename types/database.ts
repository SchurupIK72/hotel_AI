export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      hotels: {
        Row: {
          id: string;
          name: string;
          slug: string;
          default_language: string | null;
          timezone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          default_language?: string | null;
          timezone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          default_language?: string | null;
          timezone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      hotel_users: {
        Row: {
          id: string;
          hotel_id: string;
          auth_user_id: string;
          role: "hotel_admin" | "manager";
          full_name: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          hotel_id: string;
          auth_user_id: string;
          role: "hotel_admin" | "manager";
          full_name?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          hotel_id?: string;
          auth_user_id?: string;
          role?: "hotel_admin" | "manager";
          full_name?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};

