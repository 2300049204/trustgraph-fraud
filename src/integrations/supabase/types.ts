export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      actor_pii: {
        Row: {
          actor_id: string
          address_line: string | null
          email: string | null
          gstin: string | null
          phone: string | null
        }
        Insert: {
          actor_id: string
          address_line?: string | null
          email?: string | null
          gstin?: string | null
          phone?: string | null
        }
        Update: {
          actor_id?: string
          address_line?: string | null
          email?: string | null
          gstin?: string | null
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actor_pii_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: true
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      actors: {
        Row: {
          city: string | null
          created_at: string
          display_name: string
          id: string
          role: string
          seeded_ring: string | null
          size_tier: string | null
          tenure_days: number
        }
        Insert: {
          city?: string | null
          created_at?: string
          display_name: string
          id: string
          role: string
          seeded_ring?: string | null
          size_tier?: string | null
          tenure_days?: number
        }
        Update: {
          city?: string | null
          created_at?: string
          display_name?: string
          id?: string
          role?: string
          seeded_ring?: string | null
          size_tier?: string | null
          tenure_days?: number
        }
        Relationships: []
      }
      agent_runs: {
        Row: {
          agent: string
          case_id: string | null
          cost_inr: number
          created_at: string
          id: number
          latency_ms: number | null
          model: string | null
          tier: string
        }
        Insert: {
          agent: string
          case_id?: string | null
          cost_inr?: number
          created_at?: string
          id?: number
          latency_ms?: number | null
          model?: string | null
          tier: string
        }
        Update: {
          agent?: string
          case_id?: string | null
          cost_inr?: number
          created_at?: string
          id?: number
          latency_ms?: number | null
          model?: string | null
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_runs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      appeals: {
        Row: {
          case_id: string
          contact_email: string | null
          created_at: string
          decided_at: string | null
          evidence_note: string | null
          id: string
          outcome: string | null
          sla_deadline: string
          statement: string
          status: string
        }
        Insert: {
          case_id: string
          contact_email?: string | null
          created_at?: string
          decided_at?: string | null
          evidence_note?: string | null
          id?: string
          outcome?: string | null
          sla_deadline?: string
          statement: string
          status?: string
        }
        Update: {
          case_id?: string
          contact_email?: string | null
          created_at?: string
          decided_at?: string | null
          evidence_note?: string | null
          id?: string
          outcome?: string | null
          sla_deadline?: string
          statement?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "appeals_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_actions: {
        Row: {
          action_type: string
          case_id: string
          created_at: string
          expires_at: string | null
          gate_passed: boolean
          gate_reason: string | null
          id: string
          precision_at_decision: number | null
          rule_key: string
          severity: string
          sla_deadline: string | null
          taken_by: string | null
        }
        Insert: {
          action_type: string
          case_id: string
          created_at?: string
          expires_at?: string | null
          gate_passed?: boolean
          gate_reason?: string | null
          id?: string
          precision_at_decision?: number | null
          rule_key: string
          severity?: string
          sla_deadline?: string | null
          taken_by?: string | null
        }
        Update: {
          action_type?: string
          case_id?: string
          created_at?: string
          expires_at?: string | null
          gate_passed?: boolean
          gate_reason?: string | null
          id?: string
          precision_at_decision?: number | null
          rule_key?: string
          severity?: string
          sla_deadline?: string | null
          taken_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "case_actions_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      case_evidence: {
        Row: {
          case_id: string
          created_at: string
          detail: Json | null
          id: number
          source: string
          summary: string
        }
        Insert: {
          case_id: string
          created_at?: string
          detail?: Json | null
          id?: number
          source: string
          summary: string
        }
        Update: {
          case_id?: string
          created_at?: string
          detail?: Json | null
          id?: number
          source?: string
          summary?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_evidence_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          actor_id: string
          appeal_narrative: string | null
          created_at: string
          graph_score: number
          id: string
          narrative: string | null
          planner_rationale: string | null
          recommended_action: string
          reviewer_verdict: string | null
          ring_id: string | null
          ring_members: string[]
          risk_score: number
          signals: Json
          sla_deadline: string
          status: string
          txn_score: number
          updated_at: string
        }
        Insert: {
          actor_id: string
          appeal_narrative?: string | null
          created_at?: string
          graph_score?: number
          id?: string
          narrative?: string | null
          planner_rationale?: string | null
          recommended_action?: string
          reviewer_verdict?: string | null
          ring_id?: string | null
          ring_members?: string[]
          risk_score?: number
          signals?: Json
          sla_deadline?: string
          status?: string
          txn_score?: number
          updated_at?: string
        }
        Update: {
          actor_id?: string
          appeal_narrative?: string | null
          created_at?: string
          graph_score?: number
          id?: string
          narrative?: string | null
          planner_rationale?: string | null
          recommended_action?: string
          reviewer_verdict?: string | null
          ring_id?: string | null
          ring_members?: string[]
          risk_score?: number
          signals?: Json
          sla_deadline?: string
          status?: string
          txn_score?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: true
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          amount: number
          claim_type: string
          created_at: string
          id: number
          order_id: string
          status: string
        }
        Insert: {
          amount: number
          claim_type: string
          created_at: string
          id?: number
          order_id: string
          status: string
        }
        Update: {
          amount?: number
          claim_type?: string
          created_at?: string
          id?: number
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      delivery_events: {
        Row: {
          event_type: string
          id: number
          lat: number | null
          lng: number | null
          occurred_at: string
          order_id: string
          pod_ok: boolean | null
        }
        Insert: {
          event_type: string
          id?: number
          lat?: number | null
          lng?: number | null
          occurred_at: string
          order_id: string
          pod_ok?: boolean | null
        }
        Update: {
          event_type?: string
          id?: number
          lat?: number | null
          lng?: number | null
          occurred_at?: string
          order_id?: string
          pod_ok?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "delivery_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      fraud_labels: {
        Row: {
          actor_id: string
          is_fraud: boolean
          is_holdout: boolean
        }
        Insert: {
          actor_id: string
          is_fraud: boolean
          is_holdout?: boolean
        }
        Update: {
          actor_id?: string
          is_fraud?: boolean
          is_holdout?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fraud_labels_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: true
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      order_fingerprints: {
        Row: {
          address_cluster: string | null
          device_id: string | null
          ip_address: string | null
          order_id: string
        }
        Insert: {
          address_cluster?: string | null
          device_id?: string | null
          ip_address?: string | null
          order_id: string
        }
        Update: {
          address_cluster?: string | null
          device_id?: string | null
          ip_address?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_fingerprints_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          amount: number
          buyer_id: string
          created_at: string
          id: string
          partner_id: string | null
          seller_id: string
          status: string
        }
        Insert: {
          amount: number
          buyer_id: string
          created_at: string
          id: string
          partner_id?: string | null
          seller_id: string
          status: string
        }
        Update: {
          amount?: number
          buyer_id?: string
          created_at?: string
          id?: string
          partner_id?: string | null
          seller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          amount: number
          created_at: string
          id: number
          seller_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at: string
          id?: number
          seller_id: string
          status: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: number
          seller_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payouts_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "actors"
            referencedColumns: ["id"]
          },
        ]
      }
      ratings: {
        Row: {
          created_at: string
          id: number
          order_id: string
          ratee_id: string
          rater_id: string
          stars: number
        }
        Insert: {
          created_at: string
          id?: number
          order_id: string
          ratee_id: string
          rater_id: string
          stars: number
        }
        Update: {
          created_at?: string
          id?: number
          order_id?: string
          ratee_id?: string
          rater_id?: string
          stars?: number
        }
        Relationships: [
          {
            foreignKeyName: "ratings_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      rule_precision: {
        Row: {
          label: string
          precision: number
          rule_key: string
          sample_size: number
          updated_at: string
        }
        Insert: {
          label: string
          precision: number
          rule_key: string
          sample_size: number
          updated_at?: string
        }
        Update: {
          label?: string
          precision?: number
          rule_key?: string
          sample_size?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_investigator: { Args: never; Returns: boolean }
    }
    Enums: {
      app_role: "investigator" | "admin"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["investigator", "admin"],
    },
  },
} as const
