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
      channel_integrations: {
        Row: {
          id: string;
          hotel_id: string;
          channel: "telegram";
          name: string;
          bot_token_encrypted: string;
          bot_username: string | null;
          webhook_secret: string | null;
          webhook_path_token: string;
          is_active: boolean;
          last_verified_at: string | null;
          last_error_at: string | null;
          last_error_code: string | null;
          last_error_message: string | null;
          created_by_hotel_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          hotel_id: string;
          channel?: "telegram";
          name: string;
          bot_token_encrypted: string;
          bot_username?: string | null;
          webhook_secret?: string | null;
          webhook_path_token: string;
          is_active?: boolean;
          last_verified_at?: string | null;
          last_error_at?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
          created_by_hotel_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          hotel_id?: string;
          channel?: "telegram";
          name?: string;
          bot_token_encrypted?: string;
          bot_username?: string | null;
          webhook_secret?: string | null;
          webhook_path_token?: string;
          is_active?: boolean;
          last_verified_at?: string | null;
          last_error_at?: string | null;
          last_error_code?: string | null;
          last_error_message?: string | null;
          created_by_hotel_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
