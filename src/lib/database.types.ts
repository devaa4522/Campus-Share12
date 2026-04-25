// src/lib/database.types.ts
// Generated from the current Supabase schema snapshot used by the app.
// Regenerate with `supabase gen types typescript --project-id <project-id>` after schema changes.

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
      conversations: {
        Row: {
          id: string;
          deal_id: string;
          participant_1: string;
          participant_2: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          deal_id: string;
          participant_1: string;
          participant_2: string;
          created_at?: string | null;
        };
        Update: {
          id?: string;
          deal_id?: string;
          participant_1?: string;
          participant_2?: string;
          created_at?: string | null;
        };
        Relationships: [];
      };
      item_requests: {
        Row: {
          id: string;
          item_id: string;
          requester_id: string;
          duration_days: number;
          status: 'pending' | 'accepted' | 'declined' | 'rented' | 'returning' | 'completed';
          created_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          requester_id: string;
          duration_days: number;
          status?: 'pending' | 'accepted' | 'declined' | 'rented' | 'returning' | 'completed';
          created_at?: string;
        };
        Update: {
          id?: string;
          item_id?: string;
          requester_id?: string;
          duration_days?: number;
          status?: 'pending' | 'accepted' | 'declined' | 'rented' | 'returning' | 'completed';
          created_at?: string;
        };
        Relationships: [];
      };
      items: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          category: string | null;
          condition: string | null;
          price_type: 'Free' | 'Rental' | 'Karma' | null;
          price_amount: number | null;
          status: 'available' | 'rented' | 'returning' | null;
          images: string[] | null;
          created_at: string | null;
          college_domain: string | null;
          is_hidden: boolean | null;
          thumbnail_url: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          category?: string | null;
          condition?: string | null;
          price_type?: 'Free' | 'Rental' | 'Karma' | null;
          price_amount?: number | null;
          status?: 'available' | 'rented' | 'returning' | null;
          images?: string[] | null;
          created_at?: string | null;
          college_domain?: string | null;
          is_hidden?: boolean | null;
          thumbnail_url?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          description?: string | null;
          category?: string | null;
          condition?: string | null;
          price_type?: 'Free' | 'Rental' | 'Karma' | null;
          price_amount?: number | null;
          status?: 'available' | 'rented' | 'returning' | null;
          images?: string[] | null;
          created_at?: string | null;
          college_domain?: string | null;
          is_hidden?: boolean | null;
          thumbnail_url?: string | null;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          sender_id: string | null;
          content: string;
          created_at: string;
          conversation_id: string | null;
          is_read: boolean | null;
          reply_to_id: string | null;
          is_deleted: boolean;
          file_url: string | null;
          file_type: string | null;
          reactions: Json;
          msg_type: string;
          is_edited: boolean;
        };
        Insert: {
          id?: string;
          sender_id?: string | null;
          content: string;
          created_at?: string;
          conversation_id?: string | null;
          is_read?: boolean | null;
          reply_to_id?: string | null;
          is_deleted?: boolean;
          file_url?: string | null;
          file_type?: string | null;
          reactions?: Json;
          msg_type?: string;
          is_edited?: boolean;
        };
        Update: {
          id?: string;
          sender_id?: string | null;
          content?: string;
          created_at?: string;
          conversation_id?: string | null;
          is_read?: boolean | null;
          reply_to_id?: string | null;
          is_deleted?: boolean;
          file_url?: string | null;
          file_type?: string | null;
          reactions?: Json;
          msg_type?: string;
          is_edited?: boolean;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string;
          type: string;
          is_read: boolean;
          created_at: string;
          data: Json | null;
          sender_id: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          body: string;
          type: string;
          is_read?: boolean;
          created_at?: string;
          data?: Json | null;
          sender_id?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          body?: string;
          type?: string;
          is_read?: boolean;
          created_at?: string;
          data?: Json | null;
          sender_id?: string | null;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          major: string | null;
          year_of_study: string | null;
          karma_score: number | null;
          is_shadow_banned: boolean | null;
          is_verified: boolean | null;
          avatar_url: string | null;
          college_domain: string | null;
          college_type: string | null;
          department: string | null;
          degree: string | null;
          branch: string | null;
          bio: string | null;
          notifications_enabled: boolean | null;
          profile_public: boolean | null;
          karma_escrow: number | null;
          total_tasks_claimed: number | null;
          total_tasks_completed: number | null;
          flags_count: number | null;
          banned_until: string | null;
          reliability_score: number | null;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          major?: string | null;
          year_of_study?: string | null;
          karma_score?: number | null;
          is_shadow_banned?: boolean | null;
          is_verified?: boolean | null;
          avatar_url?: string | null;
          college_domain?: string | null;
          college_type?: string | null;
          department?: string | null;
          degree?: string | null;
          branch?: string | null;
          bio?: string | null;
          notifications_enabled?: boolean | null;
          profile_public?: boolean | null;
          karma_escrow?: number | null;
          total_tasks_claimed?: number | null;
          total_tasks_completed?: number | null;
          flags_count?: number | null;
          banned_until?: string | null;
          reliability_score?: number | null;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at: string | null;
          user_agent: string | null;
          last_used_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          endpoint: string;
          p256dh: string;
          auth: string;
          created_at?: string | null;
          user_agent?: string | null;
          last_used_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['push_subscriptions']['Insert']>;
        Relationships: [];
      };
      reports: {
        Row: {
          id: string;
          reporter_id: string | null;
          reported_id: string | null;
          item_id: string | null;
          task_id: string | null;
          reason: string;
          created_at: string | null;
          status: string | null;
        };
        Insert: {
          id?: string;
          reporter_id?: string | null;
          reported_id?: string | null;
          item_id?: string | null;
          task_id?: string | null;
          reason: string;
          created_at?: string | null;
          status?: string | null;
        };
        Update: Partial<Database['public']['Tables']['reports']['Insert']>;
        Relationships: [];
      };
      task_claims: {
        Row: {
          id: string;
          task_id: string;
          claimed_by: string;
          created_at: string | null;
        };
        Insert: {
          id?: string;
          task_id: string;
          claimed_by: string;
          created_at?: string | null;
        };
        Update: Partial<Database['public']['Tables']['task_claims']['Insert']>;
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          description: string | null;
          reward_type: 'karma' | 'cash' | null;
          reward_amount: number | null;
          status: 'open' | 'claimed' | 'completed' | 'cancelled' | null;
          deadline: string | null;
          college_domain: string | null;
          created_at: string | null;
          category: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          description?: string | null;
          reward_type?: 'karma' | 'cash' | null;
          reward_amount?: number | null;
          status?: 'open' | 'claimed' | 'completed' | 'cancelled' | null;
          deadline?: string | null;
          college_domain?: string | null;
          created_at?: string | null;
          category?: string | null;
        };
        Update: Partial<Database['public']['Tables']['tasks']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      request_item: {
        Args: { p_item_id: string; p_duration_days: number };
        Returns: Json;
      };
      respond_item_request: {
        Args: { p_request_id: string; p_action: string };
        Returns: Json;
      };
      initiate_item_return: {
        Args: { p_request_id: string };
        Returns: Json;
      };
      create_item_conversation: {
        Args: { p_request_id: string };
        Returns: Json;
      };
      verify_qr_handshake: {
        Args: { p_deal_id: string; p_deal_type: string; p_qr_data: string; p_action?: string | null };
        Returns: Json;
      };
      edit_message: {
        Args: { p_msg_id: string; p_content: string };
        Returns: Json;
      };
      soft_delete_message: {
        Args: { p_msg_id: string };
        Returns: Json;
      };
      toggle_reaction: {
        Args: { p_msg_id: string; p_emoji: string; p_user_id: string };
        Returns: void;
      };
      mark_conversation_as_read: {
        Args: { p_conversation_id: string };
        Returns: void;
      };
      send_message: {
        Args: {
          p_conversation_id: string;
          p_content: string;
          p_msg_type?: string;
          p_reply_to_id?: string | null;
        };
        Returns: Json;
      };
      mark_notification_read: {
        Args: { p_notification_id: string };
        Returns: void;
      };
      mark_all_notifications_read: {
        Args: Record<string, never>;
        Returns: void;
      };
      delete_notification: {
        Args: { p_notification_id: string };
        Returns: void;
      };
      clear_my_notifications: {
        Args: Record<string, never>;
        Returns: void;
      };
      count_unread_messages: {
        Args: Record<string, never>;
        Returns: number;
      };
      get_unread_notification_count: {
        Args: Record<string, never>;
        Returns: number;
      };
      clear_user_notifications: {
        Args: { p_user_id?: string } | Record<string, never>;
        Returns: void;
      };
      create_task: {
        Args: {
          p_title: string;
          p_description: string;
          p_category?: string | null;
          p_deadline?: string | null;
          p_reward_type?: string;
          p_reward_amount?: number;
        };
        Returns: Json;
      };
      claim_task_atomic: {
        Args: { t_id: string; u_id: string };
        Returns: Json;
      };
      claim_task_secure: {
        Args: { t_id: string; u_id: string };
        Returns: Json;
      };
      get_task_conversation: {
        Args: { p_task_id: string };
        Returns: Json;
      };
      cancel_task_claim: {
        Args: { c_id: string; u_id: string };
        Returns: Json;
      };
      complete_task_handshake: {
        Args: { qr_payload: string };
        Returns: Json;
      };
      get_sender_message_count: {
        Args: { conv_id: string; s_id: string };
        Returns: number;
      };
      get_trust_score: {
        Args: { user_id: string };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
