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
      usage_events: {
        Row: {
          created_at: string;
          id: string;
          pii_tokens_removed: number;
          scrubber_ran: boolean;
          template_type: "incidentrapport" | "larlogg" | "veckobrev" | "custom";
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          pii_tokens_removed?: number;
          scrubber_ran?: boolean;
          template_type: "incidentrapport" | "larlogg" | "veckobrev" | "custom";
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          pii_tokens_removed?: number;
          scrubber_ran?: boolean;
          template_type?: "incidentrapport" | "larlogg" | "veckobrev" | "custom";
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
      expire_one_time_passes: {
        Args: Record<PropertyKey, never>;
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
