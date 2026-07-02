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
      achievements: {
        Row: {
          brasas_reward: number
          category: string
          code: string
          created_at: string
          criteria: Json
          description: string
          icon: string
          id: string
          lore_fragment: string | null
          rarity: string
          sort_order: number
          title: string
          xp_reward: number
        }
        Insert: {
          brasas_reward?: number
          category?: string
          code: string
          created_at?: string
          criteria: Json
          description: string
          icon?: string
          id?: string
          lore_fragment?: string | null
          rarity?: string
          sort_order?: number
          title: string
          xp_reward?: number
        }
        Update: {
          brasas_reward?: number
          category?: string
          code?: string
          created_at?: string
          criteria?: Json
          description?: string
          icon?: string
          id?: string
          lore_fragment?: string | null
          rarity?: string
          sort_order?: number
          title?: string
          xp_reward?: number
        }
        Relationships: []
      }
      ai_audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          payload: Json
          reason: string | null
          result: Json | null
          session_id: string | null
          status: string
          table_name: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          payload?: Json
          reason?: string | null
          result?: Json | null
          session_id?: string | null
          status?: string
          table_name: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          payload?: Json
          reason?: string | null
          result?: Json | null
          session_id?: string | null
          status?: string
          table_name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_audit_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "ai_capture_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_capture_sessions: {
        Row: {
          created_at: string
          id: string
          last_message_at: string | null
          messages: Json
          status: string
          title: string | null
          updated_at: string
          user_id: string
          writes_count: number
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          messages?: Json
          status?: string
          title?: string | null
          updated_at?: string
          user_id: string
          writes_count?: number
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string | null
          messages?: Json
          status?: string
          title?: string | null
          updated_at?: string
          user_id?: string
          writes_count?: number
        }
        Relationships: []
      }
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
          meta: Json
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          area_slug: string
          created_at?: string
          id?: string
          level?: number
          meta?: Json
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          area_slug?: string
          created_at?: string
          id?: string
          level?: number
          meta?: Json
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: []
      }
      belief_confrontations: {
        Row: {
          belief: string
          created_at: string
          faced: boolean
          id: string
          log_date: string
          note: string | null
          user_id: string
        }
        Insert: {
          belief: string
          created_at?: string
          faced?: boolean
          id?: string
          log_date?: string
          note?: string | null
          user_id: string
        }
        Update: {
          belief?: string
          created_at?: string
          faced?: boolean
          id?: string
          log_date?: string
          note?: string | null
          user_id?: string
        }
        Relationships: []
      }
      brasas_events: {
        Row: {
          amount: number
          created_at: string
          id: string
          meta: Json | null
          ref_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          meta?: Json | null
          ref_id?: string | null
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          meta?: Json | null
          ref_id?: string | null
          source?: string
          user_id?: string
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
      content_reports: {
        Row: {
          created_at: string
          id: string
          reason: string
          reporter_id: string
          status: string
          target_id: string
          target_type: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          reason: string
          reporter_id: string
          status?: string
          target_id: string
          target_type: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          reason?: string
          reporter_id?: string
          status?: string
          target_id?: string
          target_type?: string
          updated_at?: string
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
      day_blocks: {
        Row: {
          completed: boolean
          created_at: string
          date: string
          ended_at: string | null
          id: string
          kind: string
          notes: string | null
          started_at: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean
          created_at?: string
          date?: string
          ended_at?: string | null
          id?: string
          kind: string
          notes?: string | null
          started_at?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean
          created_at?: string
          date?: string
          ended_at?: string | null
          id?: string
          kind?: string
          notes?: string | null
          started_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      dream_logs: {
        Row: {
          ai_interpretation: string | null
          ai_summary: string | null
          audio_url: string | null
          created_at: string
          id: string
          logged_at: string
          lucidity: number | null
          mood: string | null
          raw_text: string | null
          session_id: string | null
          symbols: string[]
          themes: string[]
          user_id: string
        }
        Insert: {
          ai_interpretation?: string | null
          ai_summary?: string | null
          audio_url?: string | null
          created_at?: string
          id?: string
          logged_at?: string
          lucidity?: number | null
          mood?: string | null
          raw_text?: string | null
          session_id?: string | null
          symbols?: string[]
          themes?: string[]
          user_id: string
        }
        Update: {
          ai_interpretation?: string | null
          ai_summary?: string | null
          audio_url?: string | null
          created_at?: string
          id?: string
          logged_at?: string
          lucidity?: number | null
          mood?: string | null
          raw_text?: string | null
          session_id?: string | null
          symbols?: string[]
          themes?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dream_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "wake_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          followed_id: string
          follower_id: string
        }
        Insert: {
          created_at?: string
          followed_id: string
          follower_id: string
        }
        Update: {
          created_at?: string
          followed_id?: string
          follower_id?: string
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
      group_messages: {
        Row: {
          body: string
          created_at: string
          group_id: string
          id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          group_id: string
          id?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          group_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
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
      lore_chapters: {
        Row: {
          body: string
          chapter_number: number
          code: string
          created_at: string
          id: string
          subtitle: string | null
          title: string
          unlock_achievement_code: string | null
          unlock_level: number
        }
        Insert: {
          body: string
          chapter_number: number
          code: string
          created_at?: string
          id?: string
          subtitle?: string | null
          title: string
          unlock_achievement_code?: string | null
          unlock_level?: number
        }
        Update: {
          body?: string
          chapter_number?: number
          code?: string
          created_at?: string
          id?: string
          subtitle?: string | null
          title?: string
          unlock_achievement_code?: string | null
          unlock_level?: number
        }
        Relationships: []
      }
      mental_journal: {
        Row: {
          created_at: string
          gratitudes: string[]
          id: string
          limiting_belief: string | null
          log_date: string
          reframe: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          gratitudes?: string[]
          id?: string
          limiting_belief?: string | null
          log_date?: string
          reframe?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          gratitudes?: string[]
          id?: string
          limiting_belief?: string | null
          log_date?: string
          reframe?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_prefs: {
        Row: {
          allow_mission: boolean
          allow_orientador: boolean
          allow_ritual: boolean
          allow_social: boolean
          allow_streak: boolean
          created_at: string
          morning_hour: number
          night_hour: number
          push_enabled: boolean
          quiet_end: number
          quiet_start: number
          updated_at: string
          user_id: string
        }
        Insert: {
          allow_mission?: boolean
          allow_orientador?: boolean
          allow_ritual?: boolean
          allow_social?: boolean
          allow_streak?: boolean
          created_at?: string
          morning_hour?: number
          night_hour?: number
          push_enabled?: boolean
          quiet_end?: number
          quiet_start?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          allow_mission?: boolean
          allow_orientador?: boolean
          allow_ritual?: boolean
          allow_social?: boolean
          allow_streak?: boolean
          created_at?: string
          morning_hour?: number
          night_hour?: number
          push_enabled?: boolean
          quiet_end?: number
          quiet_start?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          dedupe_key: string | null
          id: string
          kind: string
          link: string | null
          pushed_at: string | null
          read_at: string | null
          ref_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind: string
          link?: string | null
          pushed_at?: string | null
          read_at?: string | null
          ref_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind?: string
          link?: string | null
          pushed_at?: string | null
          read_at?: string | null
          ref_id?: string | null
          title?: string
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
      orientador_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          orientador_id: string
          read_at: string | null
          sender_id: string
          student_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          orientador_id: string
          read_at?: string | null
          sender_id: string
          student_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          orientador_id?: string
          read_at?: string | null
          sender_id?: string
          student_id?: string
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
      post_audience: {
        Row: {
          audience_id: string | null
          audience_type: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          audience_id?: string | null
          audience_type: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          audience_id?: string | null
          audience_type?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_audience_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_event_rsvps: {
        Row: {
          created_at: string
          post_id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          status: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_event_rsvps_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "post_events"
            referencedColumns: ["post_id"]
          },
        ]
      }
      post_events: {
        Row: {
          capacity: number | null
          created_at: string
          ends_at: string | null
          location_text: string | null
          post_id: string
          starts_at: string
          title: string
          updated_at: string
        }
        Insert: {
          capacity?: number | null
          created_at?: string
          ends_at?: string | null
          location_text?: string | null
          post_id: string
          starts_at: string
          title: string
          updated_at?: string
        }
        Update: {
          capacity?: number | null
          created_at?: string
          ends_at?: string | null
          location_text?: string | null
          post_id?: string
          starts_at?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_events_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          id: string
          kind: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_views: {
        Row: {
          id: string
          post_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          id?: string
          post_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          id?: string
          post_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_views_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          author_id: string
          body: string | null
          created_at: string
          id: string
          media_type: string
          media_url: string | null
          thumbnail_url: string | null
          updated_at: string
          visibility_mode: string
          visibility_rule: Json
        }
        Insert: {
          author_id: string
          body?: string | null
          created_at?: string
          id?: string
          media_type?: string
          media_url?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          visibility_mode?: string
          visibility_rule?: Json
        }
        Update: {
          author_id?: string
          body?: string | null
          created_at?: string
          id?: string
          media_type?: string
          media_url?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          visibility_mode?: string
          visibility_rule?: Json
        }
        Relationships: []
      }
      power_crystals: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          effect_config: Json
          effect_type: string
          icon: string | null
          id: string
          name: string
          rarity: string
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          effect_config?: Json
          effect_type: string
          icon?: string | null
          id?: string
          name: string
          rarity?: string
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          effect_config?: Json
          effect_type?: string
          icon?: string | null
          id?: string
          name?: string
          rarity?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          behavior_scores: Json | null
          behavioral_class: string
          brasas: number
          created_at: string
          days_per_week: number | null
          display_name: string
          friend_code: string | null
          gender: string | null
          goal: string | null
          height_cm: number | null
          id: string
          level: string | null
          level_track: string
          onboarding_completed: boolean
          onboarding_completed_at: string | null
          phone: string | null
          phone_country: string | null
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
          brasas?: number
          created_at?: string
          days_per_week?: number | null
          display_name?: string
          friend_code?: string | null
          gender?: string | null
          goal?: string | null
          height_cm?: number | null
          id: string
          level?: string | null
          level_track?: string
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          phone?: string | null
          phone_country?: string | null
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
          brasas?: number
          created_at?: string
          days_per_week?: number | null
          display_name?: string
          friend_code?: string | null
          gender?: string | null
          goal?: string | null
          height_cm?: number | null
          id?: string
          level?: string | null
          level_track?: string
          onboarding_completed?: boolean
          onboarding_completed_at?: string | null
          phone?: string | null
          phone_country?: string | null
          streak?: number
          time_per_day_min?: number | null
          updated_at?: string
          weight_kg?: number | null
          xp?: number
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          updated_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          updated_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          updated_at?: string
          user_agent?: string | null
          user_id?: string
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
      scheduled_quests: {
        Row: {
          area_slug: string | null
          created_at: string
          goal_id: string | null
          id: string
          scheduled_date: string
          status: string
          subtitle: string | null
          title: string
          updated_at: string
          user_id: string
          xp_reward: number
        }
        Insert: {
          area_slug?: string | null
          created_at?: string
          goal_id?: string | null
          id?: string
          scheduled_date: string
          status?: string
          subtitle?: string | null
          title: string
          updated_at?: string
          user_id: string
          xp_reward?: number
        }
        Update: {
          area_slug?: string | null
          created_at?: string
          goal_id?: string | null
          id?: string
          scheduled_date?: string
          status?: string
          subtitle?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          xp_reward?: number
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_quests_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "strategic_goals"
            referencedColumns: ["id"]
          },
        ]
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
      shop_items: {
        Row: {
          active: boolean
          available_from: string | null
          available_until: string | null
          bundle_items: Json
          category: string
          created_at: string
          description: string | null
          duration_hours: number | null
          featured: boolean
          icon: string | null
          id: string
          kind: string
          name: string
          payload: Json
          perk_code: string | null
          price: number
          required_level: number
          season_tag: string | null
          slug: string
          stock: number | null
        }
        Insert: {
          active?: boolean
          available_from?: string | null
          available_until?: string | null
          bundle_items?: Json
          category: string
          created_at?: string
          description?: string | null
          duration_hours?: number | null
          featured?: boolean
          icon?: string | null
          id?: string
          kind?: string
          name: string
          payload?: Json
          perk_code?: string | null
          price: number
          required_level?: number
          season_tag?: string | null
          slug: string
          stock?: number | null
        }
        Update: {
          active?: boolean
          available_from?: string | null
          available_until?: string | null
          bundle_items?: Json
          category?: string
          created_at?: string
          description?: string | null
          duration_hours?: number | null
          featured?: boolean
          icon?: string | null
          id?: string
          kind?: string
          name?: string
          payload?: Json
          perk_code?: string | null
          price?: number
          required_level?: number
          season_tag?: string | null
          slug?: string
          stock?: number | null
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
      sleep_logs: {
        Row: {
          bed_at: string | null
          created_at: string
          date: string
          id: string
          notes: string | null
          quality: number | null
          ritual_done: boolean
          sleep_at: string | null
          user_id: string
          wake_at: string | null
          wearable_source: string | null
        }
        Insert: {
          bed_at?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          quality?: number | null
          ritual_done?: boolean
          sleep_at?: string | null
          user_id: string
          wake_at?: string | null
          wearable_source?: string | null
        }
        Update: {
          bed_at?: string | null
          created_at?: string
          date?: string
          id?: string
          notes?: string | null
          quality?: number | null
          ritual_done?: boolean
          sleep_at?: string | null
          user_id?: string
          wake_at?: string | null
          wearable_source?: string | null
        }
        Relationships: []
      }
      strategic_goals: {
        Row: {
          area_slug: string | null
          completed_at: string | null
          created_at: string
          current_value: number
          description: string | null
          id: string
          quarter: string
          status: string
          target_value: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          area_slug?: string | null
          completed_at?: string | null
          created_at?: string
          current_value?: number
          description?: string | null
          id?: string
          quarter: string
          status?: string
          target_value?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          area_slug?: string | null
          completed_at?: string | null
          created_at?: string
          current_value?: number
          description?: string | null
          id?: string
          quarter?: string
          status?: string
          target_value?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      studio_challenge_participants: {
        Row: {
          awarded_rewards: string[]
          challenge_id: string
          completed_at: string | null
          id: string
          joined_at: string
          progress: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          awarded_rewards?: string[]
          challenge_id: string
          completed_at?: string | null
          id?: string
          joined_at?: string
          progress?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          awarded_rewards?: string[]
          challenge_id?: string
          completed_at?: string | null
          id?: string
          joined_at?: string
          progress?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_challenge_participants_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "studio_challenges"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_challenge_rewards: {
        Row: {
          challenge_id: string
          created_at: string
          criteria: Json
          id: string
          reward_id: string
          tier: number
        }
        Insert: {
          challenge_id: string
          created_at?: string
          criteria?: Json
          id?: string
          reward_id: string
          tier?: number
        }
        Update: {
          challenge_id?: string
          created_at?: string
          criteria?: Json
          id?: string
          reward_id?: string
          tier?: number
        }
        Relationships: [
          {
            foreignKeyName: "studio_challenge_rewards_challenge_id_fkey"
            columns: ["challenge_id"]
            isOneToOne: false
            referencedRelation: "studio_challenges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_challenge_rewards_reward_id_fkey"
            columns: ["reward_id"]
            isOneToOne: false
            referencedRelation: "studio_rewards"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_challenges: {
        Row: {
          cover_url: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_at: string | null
          id: string
          rules: Json
          start_at: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          rules?: Json
          start_at?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_at?: string | null
          id?: string
          rules?: Json
          start_at?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      studio_rewards: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          kind: string
          name: string
          payload: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind: string
          name: string
          payload?: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          kind?: string
          name?: string
          payload?: Json
          updated_at?: string
        }
        Relationships: []
      }
      user_achievements: {
        Row: {
          achievement_id: string
          id: string
          seen: boolean
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_id: string
          id?: string
          seen?: boolean
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_id?: string
          id?: string
          seen?: boolean
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_id_fkey"
            columns: ["achievement_id"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["id"]
          },
        ]
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
        }
        Relationships: []
      }
      user_crystals: {
        Row: {
          acquired_at: string
          active: boolean
          condition: Json | null
          created_at: string
          crystal_id: string
          expires_at: string | null
          id: string
          mode: string
          source: string | null
          user_id: string
        }
        Insert: {
          acquired_at?: string
          active?: boolean
          condition?: Json | null
          created_at?: string
          crystal_id: string
          expires_at?: string | null
          id?: string
          mode: string
          source?: string | null
          user_id: string
        }
        Update: {
          acquired_at?: string
          active?: boolean
          condition?: Json | null
          created_at?: string
          crystal_id?: string
          expires_at?: string | null
          id?: string
          mode?: string
          source?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_crystals_crystal_id_fkey"
            columns: ["crystal_id"]
            isOneToOne: false
            referencedRelation: "power_crystals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_inventory: {
        Row: {
          acquired_at: string
          equipped: boolean
          expires_at: string | null
          id: string
          item_id: string
          source: string
          user_id: string
          uses_left: number | null
        }
        Insert: {
          acquired_at?: string
          equipped?: boolean
          expires_at?: string | null
          id?: string
          item_id: string
          source?: string
          user_id: string
          uses_left?: number | null
        }
        Update: {
          acquired_at?: string
          equipped?: boolean
          expires_at?: string | null
          id?: string
          item_id?: string
          source?: string
          user_id?: string
          uses_left?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "user_inventory_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "shop_items"
            referencedColumns: ["id"]
          },
        ]
      }
      user_lore: {
        Row: {
          chapter_id: string
          id: string
          read_at: string
          user_id: string
        }
        Insert: {
          chapter_id: string
          id?: string
          read_at?: string
          user_id: string
        }
        Update: {
          chapter_id?: string
          id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_lore_chapter_id_fkey"
            columns: ["chapter_id"]
            isOneToOne: false
            referencedRelation: "lore_chapters"
            referencedColumns: ["id"]
          },
        ]
      }
      user_mission_logs: {
        Row: {
          done: boolean
          done_at: string
          id: string
          log_date: string
          mission_id: string
          user_id: string
        }
        Insert: {
          done?: boolean
          done_at?: string
          id?: string
          log_date?: string
          mission_id: string
          user_id: string
        }
        Update: {
          done?: boolean
          done_at?: string
          id?: string
          log_date?: string
          mission_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_mission_logs_mission_id_fkey"
            columns: ["mission_id"]
            isOneToOne: false
            referencedRelation: "user_missions"
            referencedColumns: ["id"]
          },
        ]
      }
      user_missions: {
        Row: {
          active: boolean
          archived_at: string | null
          area_slug: string | null
          created_at: string
          id: string
          mission_type: string
          notes: string | null
          remind_before_min: number
          scheduled_time: string | null
          title: string
          updated_at: string
          user_id: string
          weekday_mask: number | null
          xp_reward: number
        }
        Insert: {
          active?: boolean
          archived_at?: string | null
          area_slug?: string | null
          created_at?: string
          id?: string
          mission_type?: string
          notes?: string | null
          remind_before_min?: number
          scheduled_time?: string | null
          title: string
          updated_at?: string
          user_id: string
          weekday_mask?: number | null
          xp_reward?: number
        }
        Update: {
          active?: boolean
          archived_at?: string | null
          area_slug?: string | null
          created_at?: string
          id?: string
          mission_type?: string
          notes?: string | null
          remind_before_min?: number
          scheduled_time?: string | null
          title?: string
          updated_at?: string
          user_id?: string
          weekday_mask?: number | null
          xp_reward?: number
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
      wake_alarms: {
        Row: {
          created_at: string
          days_of_week: number[]
          enabled: boolean
          id: string
          label: string
          max_snoozes: number
          snooze_strategy: string
          time_local: string
          timezone: string
          updated_at: string
          user_id: string
          voice_persona: string
          wake_style: string
        }
        Insert: {
          created_at?: string
          days_of_week?: number[]
          enabled?: boolean
          id?: string
          label?: string
          max_snoozes?: number
          snooze_strategy?: string
          time_local: string
          timezone?: string
          updated_at?: string
          user_id: string
          voice_persona?: string
          wake_style?: string
        }
        Update: {
          created_at?: string
          days_of_week?: number[]
          enabled?: boolean
          id?: string
          label?: string
          max_snoozes?: number
          snooze_strategy?: string
          time_local?: string
          timezone?: string
          updated_at?: string
          user_id?: string
          voice_persona?: string
          wake_style?: string
        }
        Relationships: []
      }
      wake_events: {
        Row: {
          at: string
          id: string
          kind: string
          payload: Json
          session_id: string
          user_id: string
        }
        Insert: {
          at?: string
          id?: string
          kind: string
          payload?: Json
          session_id: string
          user_id: string
        }
        Update: {
          at?: string
          id?: string
          kind?: string
          payload?: Json
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wake_events_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "wake_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      wake_sessions: {
        Row: {
          alarm_id: string | null
          created_at: string
          dream_logged: boolean
          id: string
          mood_on_wake: string | null
          snooze_count: number
          started_at: string
          status: string
          total_snooze_min: number
          user_id: string
          woke_at: string | null
        }
        Insert: {
          alarm_id?: string | null
          created_at?: string
          dream_logged?: boolean
          id?: string
          mood_on_wake?: string | null
          snooze_count?: number
          started_at?: string
          status?: string
          total_snooze_min?: number
          user_id: string
          woke_at?: string | null
        }
        Update: {
          alarm_id?: string | null
          created_at?: string
          dream_logged?: boolean
          id?: string
          mood_on_wake?: string | null
          snooze_count?: number
          started_at?: string
          status?: string
          total_snooze_min?: number
          user_id?: string
          woke_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "wake_sessions_alarm_id_fkey"
            columns: ["alarm_id"]
            isOneToOne: false
            referencedRelation: "wake_alarms"
            referencedColumns: ["id"]
          },
        ]
      }
      wearable_connections: {
        Row: {
          created_at: string
          id: string
          last_sync_at: string | null
          meta: Json | null
          source: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_sync_at?: string | null
          meta?: Json | null
          source: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_sync_at?: string | null
          meta?: Json | null
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      wearable_samples: {
        Row: {
          created_at: string
          id: string
          metric: string
          raw: Json | null
          sample_date: string
          source: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metric: string
          raw?: Json | null
          sample_date: string
          source?: string
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          metric?: string
          raw?: Json | null
          sample_date?: string
          source?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: []
      }
      xp_events: {
        Row: {
          amount: number
          created_at: string
          id: string
          meta: Json
          ref_id: string | null
          source: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          meta?: Json
          ref_id?: string | null
          source: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          meta?: Json
          ref_id?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      public_profiles: {
        Row: {
          behavioral_class: string | null
          display_name: string | null
          friend_code: string | null
          id: string | null
          level: string | null
          level_track: string | null
        }
        Insert: {
          behavioral_class?: string | null
          display_name?: string | null
          friend_code?: string | null
          id?: string | null
          level?: string | null
          level_track?: string | null
        }
        Update: {
          behavioral_class?: string | null
          display_name?: string | null
          friend_code?: string | null
          id?: string | null
          level?: string | null
          level_track?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      calendar_activity: {
        Args: { _end: string; _start: string }
        Returns: {
          day: string
          events: number
          xp: number
        }[]
      }
      can_view_post: {
        Args: { _post_id: string; _viewer: string }
        Returns: boolean
      }
      check_achievements: { Args: never; Returns: Json }
      check_perk_unlocks: { Args: never; Returns: number }
      compute_personal_ia_score: { Args: { _user_id: string }; Returns: Json }
      equip_inventory_item: {
        Args: { _equip: boolean; _item_id: string }
        Returns: boolean
      }
      evaluate_challenge: {
        Args: { _challenge: string; _user: string }
        Returns: Json
      }
      generate_friend_code: { Args: never; Returns: string }
      generate_my_nudges: { Args: never; Returns: number }
      generate_nudges_all_users: { Args: never; Returns: Json }
      generate_nudges_for: { Args: { _user_id: string }; Returns: number }
      habit_streak: { Args: { _habit_id: string }; Returns: number }
      has_active_perk: {
        Args: { _perk_code: string; _user: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      import_wearable_samples: {
        Args: { _samples: Json; _source: string }
        Returns: Json
      }
      is_blocked: { Args: { _a: string; _b: string }; Returns: boolean }
      is_crystal_active: {
        Args: { _code: string; _user: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
      join_group_by_invite: { Args: { _code: string }; Returns: string }
      orientador_student_snapshot: { Args: { _student: string }; Returns: Json }
      player_level: { Args: { _xp: number }; Returns: number }
      purchase_shop_item: { Args: { _item_id: string }; Returns: Json }
      redeem_orientador_invite: { Args: { _code: string }; Returns: boolean }
      save_weekly_score_snapshot: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "player" | "orientador" | "admin" | "studio_admin"
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
      app_role: ["player", "orientador", "admin", "studio_admin"],
    },
  },
} as const
