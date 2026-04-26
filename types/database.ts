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
      app_admins: {
        Row: {
          created_at: string;
          created_by: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "app_admins_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "app_admins_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
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
      stripe_customer_mappings: {
        Row: {
          created_at: string;
          livemode: boolean;
          stripe_customer_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          livemode: boolean;
          stripe_customer_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          livemode?: boolean;
          stripe_customer_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stripe_customer_mappings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_checkout_sessions: {
        Row: {
          created_at: string;
          id: string;
          latest_event_created_at: string | null;
          latest_event_id: string | null;
          livemode: boolean;
          mode: "payment" | "subscription";
          payment_status: string | null;
          price_key: string;
          status: string | null;
          stripe_checkout_session_id: string;
          stripe_customer_id: string;
          stripe_payment_intent_id: string | null;
          stripe_price_id: string;
          stripe_subscription_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          latest_event_created_at?: string | null;
          latest_event_id?: string | null;
          livemode: boolean;
          mode: "payment" | "subscription";
          payment_status?: string | null;
          price_key: string;
          status?: string | null;
          stripe_checkout_session_id: string;
          stripe_customer_id: string;
          stripe_payment_intent_id?: string | null;
          stripe_price_id: string;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          latest_event_created_at?: string | null;
          latest_event_id?: string | null;
          livemode?: boolean;
          mode?: "payment" | "subscription";
          payment_status?: string | null;
          price_key?: string;
          status?: string | null;
          stripe_checkout_session_id?: string;
          stripe_customer_id?: string;
          stripe_payment_intent_id?: string | null;
          stripe_price_id?: string;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stripe_checkout_sessions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_subscriptions: {
        Row: {
          cancel_at_period_end: boolean;
          created_at: string;
          current_period_end: string | null;
          id: string;
          last_reconciled_at: string | null;
          latest_event_created_at: string | null;
          latest_event_id: string | null;
          latest_invoice_id: string | null;
          stripe_customer_id: string;
          stripe_price_id: string | null;
          stripe_status:
            | "active"
            | "canceled"
            | "incomplete"
            | "incomplete_expired"
            | "past_due"
            | "paused"
            | "trialing"
            | "unpaid";
          stripe_subscription_id: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          last_reconciled_at?: string | null;
          latest_event_created_at?: string | null;
          latest_event_id?: string | null;
          latest_invoice_id?: string | null;
          stripe_customer_id: string;
          stripe_price_id?: string | null;
          stripe_status:
            | "active"
            | "canceled"
            | "incomplete"
            | "incomplete_expired"
            | "past_due"
            | "paused"
            | "trialing"
            | "unpaid";
          stripe_subscription_id: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          cancel_at_period_end?: boolean;
          created_at?: string;
          current_period_end?: string | null;
          id?: string;
          last_reconciled_at?: string | null;
          latest_event_created_at?: string | null;
          latest_event_id?: string | null;
          latest_invoice_id?: string | null;
          stripe_customer_id?: string;
          stripe_price_id?: string | null;
          stripe_status?:
            | "active"
            | "canceled"
            | "incomplete"
            | "incomplete_expired"
            | "past_due"
            | "paused"
            | "trialing"
            | "unpaid";
          stripe_subscription_id?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stripe_subscriptions_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      account_entitlements: {
        Row: {
          access_level: "free" | "pro";
          created_at: string;
          last_reconciled_at: string | null;
          last_stripe_event_id: string | null;
          last_transition_at: string;
          paid_access_until: string | null;
          reason: string;
          source: "admin" | "none" | "one_time_pass" | "recurring_subscription";
          stripe_checkout_session_id: string | null;
          stripe_subscription_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          access_level?: "free" | "pro";
          created_at?: string;
          last_reconciled_at?: string | null;
          last_stripe_event_id?: string | null;
          last_transition_at?: string;
          paid_access_until?: string | null;
          reason?: string;
          source?: "admin" | "none" | "one_time_pass" | "recurring_subscription";
          stripe_checkout_session_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          access_level?: "free" | "pro";
          created_at?: string;
          last_reconciled_at?: string | null;
          last_stripe_event_id?: string | null;
          last_transition_at?: string;
          paid_access_until?: string | null;
          reason?: string;
          source?: "admin" | "none" | "one_time_pass" | "recurring_subscription";
          stripe_checkout_session_id?: string | null;
          stripe_subscription_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "account_entitlements_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      stripe_events: {
        Row: {
          created_at: string;
          error_message: string | null;
          event_type: string;
          livemode: boolean;
          object_id: string | null;
          payload: Json;
          processed_at: string | null;
          processing_attempts: number;
          status: "failed" | "processed" | "processing" | "received" | "skipped";
          stripe_created_at: string;
          stripe_event_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          error_message?: string | null;
          event_type: string;
          livemode: boolean;
          object_id?: string | null;
          payload?: Json;
          processed_at?: string | null;
          processing_attempts?: number;
          status?: "failed" | "processed" | "processing" | "received" | "skipped";
          stripe_created_at: string;
          stripe_event_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          error_message?: string | null;
          event_type?: string;
          livemode?: boolean;
          object_id?: string | null;
          payload?: Json;
          processed_at?: string | null;
          processing_attempts?: number;
          status?: "failed" | "processed" | "processing" | "received" | "skipped";
          stripe_created_at?: string;
          stripe_event_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      planning_checklists: {
        Row: {
          area_id: string;
          client_updated_at: string | null;
          created_at: string;
          id: string;
          progress_map: Json;
          revision: number;
          subject_id: string;
          teacher_notes: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          area_id: string;
          client_updated_at?: string | null;
          created_at?: string;
          id?: string;
          progress_map?: Json;
          revision?: number;
          subject_id: string;
          teacher_notes?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          area_id?: string;
          client_updated_at?: string | null;
          created_at?: string;
          id?: string;
          progress_map?: Json;
          revision?: number;
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
      planning_sync_conflicts: {
        Row: {
          area_id: string;
          client_base_revision: number | null;
          client_progress_map: Json;
          client_teacher_notes_hash: string;
          client_teacher_notes_length: number;
          client_updated_at: string | null;
          created_at: string;
          id: string;
          resolution_strategy: "server" | "merged" | "local" | null;
          resolved_at: string | null;
          server_progress_map: Json;
          server_revision: number;
          server_teacher_notes_hash: string;
          server_teacher_notes_length: number;
          server_updated_at: string | null;
          subject_id: string;
          user_id: string;
        };
        Insert: {
          area_id: string;
          client_base_revision?: number | null;
          client_progress_map?: Json;
          client_teacher_notes_hash: string;
          client_teacher_notes_length?: number;
          client_updated_at?: string | null;
          created_at?: string;
          id?: string;
          resolution_strategy?: "server" | "merged" | "local" | null;
          resolved_at?: string | null;
          server_progress_map?: Json;
          server_revision: number;
          server_teacher_notes_hash: string;
          server_teacher_notes_length?: number;
          server_updated_at?: string | null;
          subject_id: string;
          user_id: string;
        };
        Update: {
          area_id?: string;
          client_base_revision?: number | null;
          client_progress_map?: Json;
          client_teacher_notes_hash?: string;
          client_teacher_notes_length?: number;
          client_updated_at?: string | null;
          created_at?: string;
          id?: string;
          resolution_strategy?: "server" | "merged" | "local" | null;
          resolved_at?: string | null;
          server_progress_map?: Json;
          server_revision?: number;
          server_teacher_notes_hash?: string;
          server_teacher_notes_length?: number;
          server_updated_at?: string | null;
          subject_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "planning_sync_conflicts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      support_requests: {
        Row: {
          assigned_to: string | null;
          created_at: string;
          deleted_at: string | null;
          email: string;
          handled_at: string | null;
          id: string;
          last_status_at: string;
          message: string;
          name: string;
          redacted_at: string | null;
          request_id: string | null;
          role: string | null;
          status: "new" | "triaged" | "in_progress" | "resolved" | "spam" | "redacted" | "deleted";
          topic: string;
          user_id: string | null;
        };
        Insert: {
          assigned_to?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email: string;
          handled_at?: string | null;
          id?: string;
          last_status_at?: string;
          message: string;
          name: string;
          redacted_at?: string | null;
          request_id?: string | null;
          role?: string | null;
          status?: "new" | "triaged" | "in_progress" | "resolved" | "spam" | "redacted" | "deleted";
          topic: string;
          user_id?: string | null;
        };
        Update: {
          assigned_to?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          email?: string;
          handled_at?: string | null;
          id?: string;
          last_status_at?: string;
          message?: string;
          name?: string;
          redacted_at?: string | null;
          request_id?: string | null;
          role?: string | null;
          status?: "new" | "triaged" | "in_progress" | "resolved" | "spam" | "redacted" | "deleted";
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
          template_type:
            | "incidentrapport"
            | "larlogg"
            | "unikum"
            | "veckobrev"
            | "custom"
            | "lektionsplanering";
          user_id: string;
        };
        Insert: {
          client_reported_pii_tokens_removed?: number;
          created_at?: string;
          id?: string;
          pii_tokens_removed?: number;
          scrubber_ran?: boolean;
          server_pii_check_passed?: boolean;
          template_type:
            | "incidentrapport"
            | "larlogg"
            | "unikum"
            | "veckobrev"
            | "custom"
            | "lektionsplanering";
          user_id: string;
        };
        Update: {
          client_reported_pii_tokens_removed?: number;
          created_at?: string;
          id?: string;
          pii_tokens_removed?: number;
          scrubber_ran?: boolean;
          server_pii_check_passed?: boolean;
          template_type?:
            | "incidentrapport"
            | "larlogg"
            | "unikum"
            | "veckobrev"
            | "custom"
            | "lektionsplanering";
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
      apply_checkout_session_projection: {
        Args: {
          p_access_until: string | null;
          p_event_created_at: string;
          p_event_id: string;
          p_livemode: boolean;
          p_mode: "payment" | "subscription";
          p_payment_status: string | null;
          p_price_key: string;
          p_status: string | null;
          p_stripe_checkout_session_id: string;
          p_stripe_customer_id: string;
          p_stripe_payment_intent_id: string | null;
          p_stripe_price_id: string;
          p_stripe_subscription_id: string | null;
          p_user_id: string;
        };
        Returns: {
          applied: boolean;
          entitlement_access_level: string;
          entitlement_reason: string;
        }[];
      };
      apply_subscription_projection: {
        Args: {
          p_cancel_at_period_end: boolean;
          p_current_period_end: string | null;
          p_entitlement_active: boolean;
          p_entitlement_reason: string;
          p_event_created_at: string;
          p_event_id: string;
          p_latest_invoice_id: string | null;
          p_reconciled_at?: string | null;
          p_stripe_customer_id: string;
          p_stripe_price_id: string | null;
          p_stripe_status: string;
          p_stripe_subscription_id: string;
          p_user_id: string;
        };
        Returns: {
          applied: boolean;
          entitlement_access_level: string;
          entitlement_reason: string;
        }[];
      };
      begin_generation_attempt: {
        Args: {
          p_free_limit?: number;
          p_max_calls_per_window?: number;
          p_paid_limit?: number;
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
      claim_stripe_event: {
        Args: {
          p_event_type: string;
          p_livemode: boolean;
          p_object_id: string | null;
          p_payload: Json;
          p_stripe_created_at: string;
          p_stripe_event_id: string;
        };
        Returns: {
          processing_attempts: number;
          should_process: boolean;
          status: string;
        }[];
      };
      complete_stripe_event: {
        Args: {
          p_error_message?: string | null;
          p_status: string;
          p_stripe_event_id: string;
        };
        Returns: undefined;
      };
      expire_one_time_passes: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      record_checkout_session_created: {
        Args: {
          p_livemode: boolean;
          p_mode: "payment" | "subscription";
          p_payment_status: string | null;
          p_price_key: string;
          p_status: string | null;
          p_stripe_checkout_session_id: string;
          p_stripe_customer_id: string;
          p_stripe_price_id: string;
          p_user_id: string;
        };
        Returns: undefined;
      };
      record_stripe_customer_mapping: {
        Args: {
          p_livemode: boolean;
          p_stripe_customer_id: string;
          p_user_id: string;
        };
        Returns: {
          livemode: boolean;
          stripe_customer_id: string;
          user_id: string;
        }[];
      };
      release_generation_attempt: {
        Args: {
          p_user_id: string;
        };
        Returns: undefined;
      };
      save_planning_checklist_revisioned: {
        Args: {
          p_area_id: string;
          p_base_revision?: number | null;
          p_client_updated_at: string;
          p_progress_map: Json;
          p_resolution_strategy?: "server" | "merged" | "local" | null;
          p_resolved_conflict_id?: string | null;
          p_subject_id: string;
          p_teacher_notes: string;
        };
        Returns: {
          applied: boolean;
          client_updated_at: string | null;
          conflict_id: string | null;
          progress_map: Json;
          revision: number;
          teacher_notes: string;
          updated_at: string;
        }[];
      };
      reset_monthly_transforms: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
      sync_profile_from_entitlement: {
        Args: {
          p_user_id: string;
        };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
