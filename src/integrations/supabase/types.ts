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
      audio_analysis_jobs: {
        Row: {
          bpm: number | null
          confidence_score: number | null
          created_at: string
          error_message: string | null
          file_name: string
          file_size: number | null
          id: string
          musical_key: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bpm?: number | null
          confidence_score?: number | null
          created_at?: string
          error_message?: string | null
          file_name: string
          file_size?: number | null
          id?: string
          musical_key?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bpm?: number | null
          confidence_score?: number | null
          created_at?: string
          error_message?: string | null
          file_name?: string
          file_size?: number | null
          id?: string
          musical_key?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      beat_pack_downloads: {
        Row: {
          beat_pack_id: string
          created_at: string
          id: string
          ip_address: unknown | null
          user_id: string | null
        }
        Insert: {
          beat_pack_id: string
          created_at?: string
          id?: string
          ip_address?: unknown | null
          user_id?: string | null
        }
        Update: {
          beat_pack_id?: string
          created_at?: string
          id?: string
          ip_address?: unknown | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beat_pack_downloads_beat_pack_id_fkey"
            columns: ["beat_pack_id"]
            isOneToOne: false
            referencedRelation: "beat_packs"
            referencedColumns: ["id"]
          },
        ]
      }
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
      beat_pack_views: {
        Row: {
          beat_pack_id: string
          created_at: string
          id: string
          ip_address: unknown | null
          user_id: string | null
        }
        Insert: {
          beat_pack_id: string
          created_at?: string
          id?: string
          ip_address?: unknown | null
          user_id?: string | null
        }
        Update: {
          beat_pack_id?: string
          created_at?: string
          id?: string
          ip_address?: unknown | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "beat_pack_views_beat_pack_id_fkey"
            columns: ["beat_pack_id"]
            isOneToOne: false
            referencedRelation: "beat_packs"
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
          download_enabled: boolean
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
          download_enabled?: boolean
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
          download_enabled?: boolean
          id?: string
          is_public?: boolean | null
          name?: string
          track_order?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      beat_sales: {
        Row: {
          amount_received: number
          beat_id: string
          buyer_email: string
          created_at: string
          id: string
          platform_fee: number
          producer_id: string
          stripe_payment_intent_id: string | null
        }
        Insert: {
          amount_received: number
          beat_id: string
          buyer_email: string
          created_at?: string
          id?: string
          platform_fee: number
          producer_id: string
          stripe_payment_intent_id?: string | null
        }
        Update: {
          amount_received?: number
          beat_id?: string
          buyer_email?: string
          created_at?: string
          id?: string
          platform_fee?: number
          producer_id?: string
          stripe_payment_intent_id?: string | null
        }
        Relationships: []
      }
      beats: {
        Row: {
          artist: string | null
          artwork_url: string | null
          audio_file_url: string
          bpm: number | null
          created_at: string
          description: string | null
          detected_bpm: number | null
          detected_key: string | null
          duration: number | null
          file_size: number | null
          file_url: string
          format: string | null
          genre: string | null
          id: string
          is_free: boolean | null
          key: string | null
          manual_bpm: number | null
          manual_key: string | null
          metadata: Json | null
          price_cents: number | null
          producer_id: string
          sample_rate: number | null
          stems: string[] | null
          stripe_price_id: string | null
          stripe_product_id: string | null
          tags: string[] | null
          title: string
          updated_at: string
          waveform_data: Json | null
        }
        Insert: {
          artist?: string | null
          artwork_url?: string | null
          audio_file_url: string
          bpm?: number | null
          created_at?: string
          description?: string | null
          detected_bpm?: number | null
          detected_key?: string | null
          duration?: number | null
          file_size?: number | null
          file_url: string
          format?: string | null
          genre?: string | null
          id?: string
          is_free?: boolean | null
          key?: string | null
          manual_bpm?: number | null
          manual_key?: string | null
          metadata?: Json | null
          price_cents?: number | null
          producer_id: string
          sample_rate?: number | null
          stems?: string[] | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          waveform_data?: Json | null
        }
        Update: {
          artist?: string | null
          artwork_url?: string | null
          audio_file_url?: string
          bpm?: number | null
          created_at?: string
          description?: string | null
          detected_bpm?: number | null
          detected_key?: string | null
          duration?: number | null
          file_size?: number | null
          file_url?: string
          format?: string | null
          genre?: string | null
          id?: string
          is_free?: boolean | null
          key?: string | null
          manual_bpm?: number | null
          manual_key?: string | null
          metadata?: Json | null
          price_cents?: number | null
          producer_id?: string
          sample_rate?: number | null
          stems?: string[] | null
          stripe_price_id?: string | null
          stripe_product_id?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          waveform_data?: Json | null
        }
        Relationships: []
      }
      collab_room_members: {
        Row: {
          id: string
          joined_at: string
          role: string | null
          room_id: string
          user_id: string
        }
        Insert: {
          id?: string
          joined_at?: string
          role?: string | null
          room_id: string
          user_id: string
        }
        Update: {
          id?: string
          joined_at?: string
          role?: string | null
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "collab_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_rooms: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          file_url: string | null
          id: string
          message_type: string | null
          read_at: string | null
          recipient_id: string
          sender_id: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          file_url?: string | null
          id?: string
          message_type?: string | null
          read_at?: string | null
          recipient_id: string
          sender_id: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          file_url?: string | null
          id?: string
          message_type?: string | null
          read_at?: string | null
          recipient_id?: string
          sender_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          data: Json | null
          id: string
          message: string
          read_at: string | null
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data?: Json | null
          id?: string
          message: string
          read_at?: string | null
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          data?: Json | null
          id?: string
          message?: string
          read_at?: string | null
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      payout_requests: {
        Row: {
          amount_cents: number
          created_at: string
          id: string
          payout_details: Json | null
          payout_method: string
          processed_at: string | null
          producer_id: string
          status: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          id?: string
          payout_details?: Json | null
          payout_method: string
          processed_at?: string | null
          producer_id: string
          status?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          id?: string
          payout_details?: Json | null
          payout_method?: string
          processed_at?: string | null
          producer_id?: string
          status?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          available_balance_cents: number | null
          beat_pack_count: number | null
          bio: string | null
          created_at: string
          first_name: string | null
          genres: string[] | null
          home_town: string | null
          id: string
          ip_address: string | null
          last_name: string | null
          payout_info: Json | null
          plan: string | null
          producer_logo_url: string | null
          producer_name: string | null
          public_profile_enabled: boolean | null
          role: Database["public"]["Enums"]["user_role"] | null
          social_links: Json | null
          stripe_account_id: string | null
          total_earnings_cents: number | null
          track_upload_count: number | null
          updated_at: string
          verification_status: string | null
        }
        Insert: {
          available_balance_cents?: number | null
          beat_pack_count?: number | null
          bio?: string | null
          created_at?: string
          first_name?: string | null
          genres?: string[] | null
          home_town?: string | null
          id: string
          ip_address?: string | null
          last_name?: string | null
          payout_info?: Json | null
          plan?: string | null
          producer_logo_url?: string | null
          producer_name?: string | null
          public_profile_enabled?: boolean | null
          role?: Database["public"]["Enums"]["user_role"] | null
          social_links?: Json | null
          stripe_account_id?: string | null
          total_earnings_cents?: number | null
          track_upload_count?: number | null
          updated_at?: string
          verification_status?: string | null
        }
        Update: {
          available_balance_cents?: number | null
          beat_pack_count?: number | null
          bio?: string | null
          created_at?: string
          first_name?: string | null
          genres?: string[] | null
          home_town?: string | null
          id?: string
          ip_address?: string | null
          last_name?: string | null
          payout_info?: Json | null
          plan?: string | null
          producer_logo_url?: string | null
          producer_name?: string | null
          public_profile_enabled?: boolean | null
          role?: Database["public"]["Enums"]["user_role"] | null
          social_links?: Json | null
          stripe_account_id?: string | null
          total_earnings_cents?: number | null
          track_upload_count?: number | null
          updated_at?: string
          verification_status?: string | null
        }
        Relationships: []
      }
      projects: {
        Row: {
          artwork_url: string | null
          created_at: string
          description: string | null
          id: string
          metadata: Json | null
          name: string
          status: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          artwork_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name: string
          status?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          artwork_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          status?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      signup_attempts: {
        Row: {
          attempted_at: string
          id: string
          ip_address: string
          success: boolean | null
          user_agent: string | null
        }
        Insert: {
          attempted_at?: string
          id?: string
          ip_address: string
          success?: boolean | null
          user_agent?: string | null
        }
        Update: {
          attempted_at?: string
          id?: string
          ip_address?: string
          success?: boolean | null
          user_agent?: string | null
        }
        Relationships: []
      }
      split_sheet_contributors: {
        Row: {
          contact_info: string | null
          created_at: string
          id: string
          name: string
          ownership_percentage: number
          role: string
          signature_data: string | null
          signature_type: string | null
          signed_at: string | null
          split_sheet_id: string
        }
        Insert: {
          contact_info?: string | null
          created_at?: string
          id?: string
          name: string
          ownership_percentage: number
          role: string
          signature_data?: string | null
          signature_type?: string | null
          signed_at?: string | null
          split_sheet_id: string
        }
        Update: {
          contact_info?: string | null
          created_at?: string
          id?: string
          name?: string
          ownership_percentage?: number
          role?: string
          signature_data?: string | null
          signature_type?: string | null
          signed_at?: string | null
          split_sheet_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "split_sheet_contributors_split_sheet_id_fkey"
            columns: ["split_sheet_id"]
            isOneToOne: false
            referencedRelation: "split_sheets"
            referencedColumns: ["id"]
          },
        ]
      }
      split_sheets: {
        Row: {
          artist_name: string
          created_at: string
          date_of_agreement: string
          id: string
          producer_name: string
          song_title: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          artist_name: string
          created_at?: string
          date_of_agreement?: string
          id?: string
          producer_name: string
          song_title: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          artist_name?: string
          created_at?: string
          date_of_agreement?: string
          id?: string
          producer_name?: string
          song_title?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tracks: {
        Row: {
          artist: string | null
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
          artist?: string | null
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
          artist?: string | null
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
      user_payment_info: {
        Row: {
          created_at: string
          id: string
          stripe_customer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          stripe_customer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          stripe_customer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_public_tracks: {
        Args: Record<PropertyKey, never>
        Returns: {
          artwork_url: string
          created_at: string
          detected_bpm: number
          detected_key: string
          duration: number
          file_size: number
          file_url: string
          format: string
          id: string
          manual_bpm: number
          manual_key: string
          metadata: Json
          sample_rate: number
          stems: string[]
          tags: string[]
          title: string
          updated_at: string
          waveform_data: Json
        }[]
      }
    }
    Enums: {
      user_role: "artist" | "producer"
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
      user_role: ["artist", "producer"],
    },
  },
} as const
