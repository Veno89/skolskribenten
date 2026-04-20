// Hand-authored from the live Phase 1 schema so the app keeps the stricter
// table unions that matter to the product while matching the current project.
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          api_call_count: number;
          api_call_window_start: string;
          created_at: string;
          email: string;
          full_name: string | null;
          id: string;
          school_name: string | null;
          stripe_customer_id: string | null;
          subscription_end_date: string | null;
          subscription_status: "free" | "pro" | "cancelled";
          transforms_reset_at: string;
          transforms_used_this_month: number;
          updated_at: string;
          user_settings: Json;
        };
        Insert: {
          api_call_count?: number;
          api_call_window_start?: string;
          created_at?: string;
          email: string;
          full_name?: string | null;
          id: string;
          school_name?: string | null;
          stripe_customer_id?: string | null;
          subscription_end_date?: string | null;
          subscription_status?: "free" | "pro" | "cancelled";
          transforms_reset_at?: string;
          transforms_used_this_month?: number;
          updated_at?: string;
          user_settings?: Json;
        };
        Update: {
          api_call_count?: number;
          api_call_window_start?: string;
          created_at?: string;
          email?: string;
          full_name?: string | null;
          id?: string;
          school_name?: string | null;
          stripe_customer_id?: string | null;
          subscription_end_date?: string | null;
          subscription_status?: "free" | "pro" | "cancelled";
          transforms_reset_at?: string;
          transforms_used_this_month?: number;
          updated_at?: string;
          user_settings?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      planning_checklists: {
        Row: {
          area_id: string;
          created_at: string;
          id: string;
          progress_map: Json;
          subject_id: string;
          teacher_notes: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          area_id: string;
          created_at?: string;
          id?: string;
          progress_map?: Json;
          subject_id: string;
          teacher_notes?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          area_id?: string;
          created_at?: string;
          id?: string;
          progress_map?: Json;
          subject_id?: string;
          teacher_notes?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "planning_checklists_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      support_requests: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          message: string;
          name: string;
          role: string | null;
          topic: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          message: string;
          name: string;
          role?: string | null;
          topic: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          message?: string;
          name?: string;
          role?: string | null;
          topic?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "support_requests_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      usage_events: {
        Row: {
          client_reported_pii_tokens_removed: number;
          created_at: string;
          id: string;
          pii_tokens_removed: number;
          scrubber_ran: boolean;
          server_pii_check_passed: boolean;
          template_type: "incidentrapport" | "larlogg" | "unikum" | "veckobrev" | "custom";
          user_id: string;
        };
        Insert: {
          client_reported_pii_tokens_removed?: number;
          created_at?: string;
          id?: string;
          pii_tokens_removed?: number;
          scrubber_ran?: boolean;
          server_pii_check_passed?: boolean;
          template_type: "incidentrapport" | "larlogg" | "unikum" | "veckobrev" | "custom";
          user_id: string;
        };
        Update: {
          client_reported_pii_tokens_removed?: number;
          created_at?: string;
          id?: string;
          pii_tokens_removed?: number;
          scrubber_ran?: boolean;
          server_pii_check_passed?: boolean;
          template_type?: "incidentrapport" | "larlogg" | "unikum" | "veckobrev" | "custom";
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "usage_events_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      begin_generation_attempt: {
        Args: {
          p_free_limit?: number;
          p_max_calls_per_window?: number;
          p_user_id: string;
          p_window_seconds?: number;
        };
        Returns: {
          allowed: boolean;
          reason: string;
          reserved_transform: boolean;
          subscription_end_date: string | null;
          subscription_status: "free" | "pro" | "cancelled" | null;
          transforms_used_this_month: number | null;
          user_settings: Json;
        }[];
      };
      expire_one_time_passes: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      release_generation_attempt: {
        Args: {
          p_user_id: string;
        };
        Returns: undefined;
      };
      reset_monthly_transforms: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
