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
      guests: {
        Row: {
          id: string;
          hotel_id: string;
          channel: "telegram";
          external_user_id: string;
          telegram_username: string | null;
          display_name: string | null;
          first_name: string | null;
          last_name: string | null;
          language_code: string | null;
          last_message_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          hotel_id: string;
          channel?: "telegram";
          external_user_id: string;
          telegram_username?: string | null;
          display_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          language_code?: string | null;
          last_message_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          hotel_id?: string;
          channel?: "telegram";
          external_user_id?: string;
          telegram_username?: string | null;
          display_name?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          language_code?: string | null;
          last_message_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      conversations: {
        Row: {
          id: string;
          hotel_id: string;
          guest_id: string;
          channel: "telegram";
          status: "new" | "open" | "pending" | "closed";
          mode: "copilot_mode" | "human_handoff_mode";
          assigned_hotel_user_id: string | null;
          subject: string | null;
          last_message_preview: string | null;
          last_message_at: string;
          last_inbound_message_at: string | null;
          unread_count: number;
          last_ai_draft_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          hotel_id: string;
          guest_id: string;
          channel?: "telegram";
          status?: "new" | "open" | "pending" | "closed";
          mode?: "copilot_mode" | "human_handoff_mode";
          assigned_hotel_user_id?: string | null;
          subject?: string | null;
          last_message_preview?: string | null;
          last_message_at?: string;
          last_inbound_message_at?: string | null;
          unread_count?: number;
          last_ai_draft_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          hotel_id?: string;
          guest_id?: string;
          channel?: "telegram";
          status?: "new" | "open" | "pending" | "closed";
          mode?: "copilot_mode" | "human_handoff_mode";
          assigned_hotel_user_id?: string | null;
          subject?: string | null;
          last_message_preview?: string | null;
          last_message_at?: string;
          last_inbound_message_at?: string | null;
          unread_count?: number;
          last_ai_draft_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          hotel_id: string;
          conversation_id: string;
          guest_id: string | null;
          channel: "telegram";
          direction: "inbound" | "outbound";
          message_type: "text";
          external_message_id: string;
          external_chat_id: string;
          sender_external_id: string | null;
          text_body: string;
          source_draft_id: string | null;
          delivered_at: string | null;
          raw_payload: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          hotel_id: string;
          conversation_id: string;
          guest_id?: string | null;
          channel?: "telegram";
          direction: "inbound" | "outbound";
          message_type?: "text";
          external_message_id: string;
          external_chat_id: string;
          sender_external_id?: string | null;
          text_body: string;
          source_draft_id?: string | null;
          delivered_at?: string | null;
          raw_payload?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          hotel_id?: string;
          conversation_id?: string;
          guest_id?: string | null;
          channel?: "telegram";
          direction?: "inbound" | "outbound";
          message_type?: "text";
          external_message_id?: string;
          external_chat_id?: string;
          sender_external_id?: string | null;
          text_body?: string;
          source_draft_id?: string | null;
          delivered_at?: string | null;
          raw_payload?: Json | null;
          created_at?: string;
        };
      };
      event_logs: {
        Row: {
          id: string;
          hotel_id: string | null;
          integration_id: string | null;
          event_type: string;
          entity_type: string | null;
          entity_id: string | null;
          payload: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          hotel_id?: string | null;
          integration_id?: string | null;
          event_type: string;
          entity_type?: string | null;
          entity_id?: string | null;
          payload?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          hotel_id?: string | null;
          integration_id?: string | null;
          event_type?: string;
          entity_type?: string | null;
          entity_id?: string | null;
          payload?: Json;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
