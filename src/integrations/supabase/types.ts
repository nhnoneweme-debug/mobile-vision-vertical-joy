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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      area_mission_logs: {
        Row: {
          area_slug: string
          completed_at: string
          created_at: string
          id: string
          mission_id: string
          note: string | null
          user_id: string
          xp_awarded: number
        }
        Insert: {
          area_slug: string
          completed_at?: string
          created_at?: string
          id?: string
          mission_id: string
          note?: string | null
          user_id: string
          xp_awarded?: number
        }
        Update: {
          area_slug?: string
          completed_at?: string
          created_at?: string
          id?: string
          mission_id?: string
          note?: string | null
          user_id?: string
          xp_awarded?: number
        }
        Relationships: [
          {
            foreignKeyName: "area_mission_logs_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "area_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      area_missions: {
        Row: {
          active: boolean
          area_slug: string
          class_affinity: string[]
          created_at: string
          id: string
          sort_order: number
          subtitle: string
          title: string
          updated_at: string
          weekly_target: number
          xp_reward: number
        }
        Insert: {
          active?: boolean
          area_slug: string
          class_affinity?: string[]
          created_at?: string
          id?: string
          sort_order?: number
          subtitle: string
          title: string
          updated_at?: string
          weekly_target?: number
          xp_reward?: number
        }
        Update: {
          active?: boolean
          area_slug?: string
          class_affinity?: string[]
          created_at?: string
          id?: string
          sort_order?: number
          subtitle?: string
          title?: string
          updated_at?: string
          weekly_target?: number
          xp_reward?: number
        }
        Relationships: []
      }
      area_progress: {
        Row: {
          area_slug: string
          created_at: string
          id: string
          level: number
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          area_slug: string
          created_at?: string
          id?: string
          level?: number
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          area_slug?: string
          created_at?: string
          id?: string
          level?: number
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      daily_quests: {
        Row: {
          area_slug: string
          completed_at: string | null
          created_at: string
          effort: number | null
          id: string
          note: string | null
          quest_date: string
          status: string
          subtitle: string
          title: string
          updated_at: string
          user_id: string
          xp_reward: number
        }
        Insert: {
          area_slug: string
          completed_at?: string | null
          created_at?: string
          effort?: number | null
          id?: string
          note?: string | null
          quest_date?: string
          status?: string
          subtitle: string
          title: string
          updated_at?: string
          user_id: string
          xp_reward?: number
        }
        Update: {
          area_slug?: string
          completed_at?: string | null
          created_at?: string
          effort?: number | null
          id?: string
          note?: string | null
          quest_date?: string
          status?: string
          subtitle?: string
          title?: string
          updated_at?: string
          user_id?: string
          xp_reward?: number
        }
        Relationships: []
      }
      habit_logs: {
        Row: {
          created_at: string
          habit_id: string
          id: string
          log_date: string
          status: string
          user_id: string
          xp_reward: number
        }
        Insert: {
          created_at?: string
          habit_id: string
          id?: string
          log_date?: string
          status?: string
          user_id: string
          xp_reward?: number
        }
        Update: {
          created_at?: string
          habit_id?: string
          id?: string
          log_date?: string
          status?: string
          user_id?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "habit_logs_habit_id_fkey"
            columns: ["habit_id"]
            isOneToOne: false
            referencedRelation: "habits"
            referencedColumns: ["id"]
          },
        ]
      }
      habits: {
        Row: {
          active: boolean
          area_slug: string
          created_at: string
          icon: string
          id: string
          target_per_week: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active?: boolean
          area_slug?: string
          created_at?: string
          icon?: string
          id?: string
          target_per_week?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active?: boolean
          area_slug?: string
          created_at?: string
          icon?: string
          id?: string
          target_per_week?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          behavior_scores: Json | null
          behavioral_class: string
          created_at: string
          days_per_week: number | null
          display_name: string
          gender: string | null
          goal: string | null
          height_cm: number | null
          id: string
          level: string | null
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          streak: number
          time_per_day_min: number | null
          updated_at: string
          weight_kg: number | null
          xp: number
        }
        Insert: {
          age?: number | null
          behavior_scores?: Json | null
          behavioral_class?: string
          created_at?: string
          days_per_week?: number | null
          display_name?: string
          gender?: string | null
          goal?: string | null
          height_cm?: number | null
          id: string
          level?: string | null
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          streak?: number
          time_per_day_min?: number | null
          updated_at?: string
          weight_kg?: number | null
          xp?: number
        }
        Update: {
          age?: number | null
          behavior_scores?: Json | null
          behavioral_class?: string
          created_at?: string
          days_per_week?: number | null
          display_name?: string
          gender?: string | null
          goal?: string | null
          height_cm?: number | null
          id?: string
          level?: string | null
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          streak?: number
          time_per_day_min?: number | null
          updated_at?: string
          weight_kg?: number | null
          xp?: number
        }
        Relationships: []
      }
      skill_perks: {
        Row: {
          class: string
          created_at: string
          description: string
          id: string
          sort_order: number
          tier: number
          title: string
          unlock_level: number
          updated_at: string
        }
        Insert: {
          class: string
          created_at?: string
          description: string
          id?: string
          sort_order?: number
          tier: number
          title: string
          unlock_level: number
          updated_at?: string
        }
        Update: {
          class?: string
          created_at?: string
          description?: string
          id?: string
          sort_order?: number
          tier?: number
          title?: string
          unlock_level?: number
          updated_at?: string
        }
        Relationships: []
      }
      user_perks: {
        Row: {
          id: string
          perk_id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          id?: string
          perk_id: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          id?: string
          perk_id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_perks_perk_id_fkey"
            columns: ["perk_id"]
            isOneToOne: false
            referencedRelation: "skill_perks"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_events: {
        Row: {
          amount: number
          created_at: string
          id: string
          ref_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          ref_id?: string | null
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          ref_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      check_perk_unlocks: { Args: never; Returns: number }
      habit_streak: { Args: { _habit_id: string }; Returns: number }
      player_level: { Args: { _xp: number }; Returns: number }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
