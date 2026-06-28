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
      challenge_progress: {
        Row: {
          challenge_id: string
          id: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          challenge_id: string
          id?: string
          updated_at?: string
          user_id: string
          value?: number
        }
        Update: {
          challenge_id?: string
          id?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "challenge_progress_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      challenges: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          ends_at: string
          group_id: string
          id: string
          metric: string
          starts_at: string
          target: number
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          ends_at: string
          group_id: string
          id?: string
          metric: string
          starts_at?: string
          target: number
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          ends_at?: string
          group_id?: string
          id?: string
          metric?: string
          starts_at?: string
          target?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "challenges_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
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
      friendships: {
        Row: {
          addressee_id: string
          created_at: string
          id: string
          requester_id: string
          status: string
          updated_at: string
        }
        Insert: {
          addressee_id: string
          created_at?: string
          id?: string
          requester_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          addressee_id?: string
          created_at?: string
          id?: string
          requester_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          created_at: string
          description: string | null
          id: string
          invite_code: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          invite_code: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
          updated_at?: string
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
      notification_prefs: {
        Row: {
          created_at: string
          morning_hour: number
          night_hour: number
          push_enabled: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          morning_hour?: number
          night_hour?: number
          push_enabled?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          morning_hour?: number
          night_hour?: number
          push_enabled?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      oracle_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      orientador_invites: {
        Row: {
          code: string
          created_at: string
          note: string | null
          used_at: string | null
          used_by: string | null
        }
        Insert: {
          code: string
          created_at?: string
          note?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          note?: string | null
          used_at?: string | null
          used_by?: string | null
        }
        Relationships: []
      }
      orientador_missions: {
        Row: {
          area_slug: string | null
          completed_at: string | null
          created_at: string
          detail: string | null
          due_at: string | null
          id: string
          orientador_id: string
          status: string
          student_id: string
          title: string
          xp_reward: number
        }
        Insert: {
          area_slug?: string | null
          completed_at?: string | null
          created_at?: string
          detail?: string | null
          due_at?: string | null
          id?: string
          orientador_id: string
          status?: string
          student_id: string
          title: string
          xp_reward?: number
        }
        Update: {
          area_slug?: string | null
          completed_at?: string | null
          created_at?: string
          detail?: string | null
          due_at?: string | null
          id?: string
          orientador_id?: string
          status?: string
          student_id?: string
          title?: string
          xp_reward?: number
        }
        Relationships: []
      }
      orientador_students: {
        Row: {
          accepted_at: string | null
          id: string
          invited_at: string
          orientador_id: string
          status: string
          student_id: string
        }
        Insert: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          orientador_id: string
          status?: string
          student_id: string
        }
        Update: {
          accepted_at?: string | null
          id?: string
          invited_at?: string
          orientador_id?: string
          status?: string
          student_id?: string
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
          friend_code: string | null
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
          friend_code?: string | null
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
          friend_code?: string | null
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
      ritual_logs: {
        Row: {
          created_at: string
          id: string
          intention: string | null
          reflections: Json
          ritual_date: string
          ritual_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          intention?: string | null
          reflections?: Json
          ritual_date?: string
          ritual_type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          intention?: string | null
          reflections?: Json
          ritual_date?: string
          ritual_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      score_snapshots: {
        Row: {
          breakdown: Json
          created_at: string
          id: string
          score: number
          user_id: string
          week_start: string
        }
        Insert: {
          breakdown?: Json
          created_at?: string
          id?: string
          score: number
          user_id: string
          week_start: string
        }
        Update: {
          breakdown?: Json
          created_at?: string
          id?: string
          score?: number
          user_id?: string
          week_start?: string
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
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
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
      compute_personal_ia_score: { Args: { _user_id: string }; Returns: Json }
      generate_friend_code: { Args: never; Returns: string }
      habit_streak: { Args: { _habit_id: string }; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
      player_level: { Args: { _xp: number }; Returns: number }
      redeem_orientador_invite: { Args: { _code: string }; Returns: boolean }
      save_weekly_score_snapshot: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "player" | "orientador" | "admin"
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
      app_role: ["player", "orientador", "admin"],
    },
  },
} as const
