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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      beat_pack_tracks: {
        Row: {
          beat_pack_id: string
          created_at: string
          id: string
          position: number
          track_id: string
        }
        Insert: {
          beat_pack_id: string
          created_at?: string
          id?: string
          position?: number
          track_id: string
        }
        Update: {
          beat_pack_id?: string
          created_at?: string
          id?: string
          position?: number
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beat_pack_tracks_beat_pack_id_fkey"
            columns: ["beat_pack_id"]
            isOneToOne: false
            referencedRelation: "beat_packs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beat_pack_tracks_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      beat_packs: {
        Row: {
          artwork_url: string | null
          auto_tag: string | null
          created_at: string
          creation_type: string | null
          description: string | null
          id: string
          is_public: boolean | null
          name: string
          track_order: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          artwork_url?: string | null
          auto_tag?: string | null
          created_at?: string
          creation_type?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          track_order?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          artwork_url?: string | null
          auto_tag?: string | null
          created_at?: string
          creation_type?: string | null
          description?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          track_order?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tracks: {
        Row: {
          artwork_url: string | null
          created_at: string
          detected_bpm: number | null
          detected_key: string | null
          duration: number | null
          file_size: number | null
          file_url: string
          format: string | null
          id: string
          manual_bpm: number | null
          manual_key: string | null
          metadata: Json | null
          sample_rate: number | null
          stems: string[] | null
          tags: string[] | null
          title: string
          updated_at: string
          user_id: string
          waveform_data: Json | null
        }
        Insert: {
          artwork_url?: string | null
          created_at?: string
          detected_bpm?: number | null
          detected_key?: string | null
          duration?: number | null
          file_size?: number | null
          file_url: string
          format?: string | null
          id?: string
          manual_bpm?: number | null
          manual_key?: string | null
          metadata?: Json | null
          sample_rate?: number | null
          stems?: string[] | null
          tags?: string[] | null
          title: string
          updated_at?: string
          user_id: string
          waveform_data?: Json | null
        }
        Update: {
          artwork_url?: string | null
          created_at?: string
          detected_bpm?: number | null
          detected_key?: string | null
          duration?: number | null
          file_size?: number | null
          file_url?: string
          format?: string | null
          id?: string
          manual_bpm?: number | null
          manual_key?: string | null
          metadata?: Json | null
          sample_rate?: number | null
          stems?: string[] | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          user_id?: string
          waveform_data?: Json | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
