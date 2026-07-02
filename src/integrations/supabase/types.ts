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
      app_accounts: {
        Row: {
          auth_user_id: string
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          username: string
        }
        Insert: {
          auth_user_id: string
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          username: string
        }
        Update: {
          auth_user_id?: string
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          cpf: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          cpf: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
          whatsapp: string
        }
        Update: {
          cpf?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          updated_at?: string
          whatsapp?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          actual_minutes: number | null
          category: Database["public"]["Enums"]["vehicle_category"]
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          customer_name: string
          discount: number
          duration_minutes: number
          extras: Json
          id: string
          loyalty_discount: number
          loyalty_reward_used: boolean
          notes: string
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          queue_position: number
          service_id: string
          service_key: string
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          vehicle_id: string
          vehicle_label: string
          vehicle_plate: string
        }
        Insert: {
          actual_minutes?: number | null
          category: Database["public"]["Enums"]["vehicle_category"]
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          customer_name: string
          discount?: number
          duration_minutes?: number
          extras?: Json
          id?: string
          loyalty_discount?: number
          loyalty_reward_used?: boolean
          notes?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          queue_position?: number
          service_id: string
          service_key: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          vehicle_id: string
          vehicle_label: string
          vehicle_plate: string
        }
        Update: {
          actual_minutes?: number | null
          category?: Database["public"]["Enums"]["vehicle_category"]
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          customer_name?: string
          discount?: number
          duration_minutes?: number
          extras?: Json
          id?: string
          loyalty_discount?: number
          loyalty_reward_used?: boolean
          notes?: string
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          queue_position?: number
          service_id?: string
          service_key?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          vehicle_id?: string
          vehicle_label?: string
          vehicle_plate?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_prices: {
        Row: {
          category: Database["public"]["Enums"]["vehicle_category"]
          id: string
          price: number
          service_id: string
        }
        Insert: {
          category: Database["public"]["Enums"]["vehicle_category"]
          id?: string
          price?: number
          service_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["vehicle_category"]
          id?: string
          price?: number
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_prices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      service_time_stats: {
        Row: {
          service_id: string
          sum_actual_minutes: number
          total_washes: number
          updated_at: string
        }
        Insert: {
          service_id: string
          sum_actual_minutes?: number
          total_washes?: number
          updated_at?: string
        }
        Update: {
          service_id?: string
          sum_actual_minutes?: number
          total_washes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_time_stats_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          active: boolean
          created_at: string
          description: string
          duration_minutes: number
          id: string
          key: string
          loyalty_qualifying: boolean
          position: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string
          duration_minutes?: number
          id?: string
          key: string
          loyalty_qualifying?: boolean
          position?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string
          duration_minutes?: number
          id?: string
          key?: string
          loyalty_qualifying?: boolean
          position?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
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
      vehicles: {
        Row: {
          brand: string
          category: Database["public"]["Enums"]["vehicle_category"]
          color: string
          created_at: string
          customer_id: string
          id: string
          last_reward_date: string | null
          model: string
          plate: string
          reward_available: boolean
          updated_at: string
          wash_count: number
          year: string
        }
        Insert: {
          brand?: string
          category: Database["public"]["Enums"]["vehicle_category"]
          color?: string
          created_at?: string
          customer_id: string
          id?: string
          last_reward_date?: string | null
          model?: string
          plate: string
          reward_available?: boolean
          updated_at?: string
          wash_count?: number
          year?: string
        }
        Update: {
          brand?: string
          category?: Database["public"]["Enums"]["vehicle_category"]
          color?: string
          created_at?: string
          customer_id?: string
          id?: string
          last_reward_date?: string | null
          model?: string
          plate?: string
          reward_available?: boolean
          updated_at?: string
          wash_count?: number
          year?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicles_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      current_user_has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      record_service_actual_minutes: {
        Args: { _minutes: number; _service_id: string }
        Returns: undefined
      }
      resolve_login: { Args: { _username: string }; Returns: string }
    }
    Enums: {
      app_role: "atendimento" | "lavajato" | "gerencia"
      order_status:
        | "queued"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "delivered"
      payment_method: "Crédito" | "Débito" | "Pix"
      vehicle_category: "Hatch" | "Sedan" | "SUV" | "Picape" | "Luxo"
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
      app_role: ["atendimento", "lavajato", "gerencia"],
      order_status: [
        "queued",
        "in_progress",
        "completed",
        "cancelled",
        "delivered",
      ],
      payment_method: ["Crédito", "Débito", "Pix"],
      vehicle_category: ["Hatch", "Sedan", "SUV", "Picape", "Luxo"],
    },
  },
} as const
