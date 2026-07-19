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
          active: boolean
          cpf: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          updated_at: string
          whatsapp: string
        }
        Insert: {
          active?: boolean
          cpf: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          updated_at?: string
          whatsapp: string
        }
        Update: {
          active?: boolean
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
          customer_id: string | null
          customer_name: string
          discount: number
          discount_percentage: number
          duration_minutes: number
          extras: Json
          id: string
          loyalty_discount: number
          loyalty_reward_used: boolean
          notes: string
          order_source: Database["public"]["Enums"]["order_source"]
          paid_at: string | null
          paid_by: string | null
          partner_contract_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          queue_position: number
          service_id: string
          service_key: string
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          vehicle_id: string | null
          vehicle_label: string
          vehicle_plate: string
        }
        Insert: {
          actual_minutes?: number | null
          category: Database["public"]["Enums"]["vehicle_category"]
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name: string
          discount?: number
          discount_percentage?: number
          duration_minutes?: number
          extras?: Json
          id?: string
          loyalty_discount?: number
          loyalty_reward_used?: boolean
          notes?: string
          order_source?: Database["public"]["Enums"]["order_source"]
          paid_at?: string | null
          paid_by?: string | null
          partner_contract_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          queue_position?: number
          service_id: string
          service_key: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          vehicle_id?: string | null
          vehicle_label: string
          vehicle_plate: string
        }
        Update: {
          actual_minutes?: number | null
          category?: Database["public"]["Enums"]["vehicle_category"]
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string
          discount?: number
          discount_percentage?: number
          duration_minutes?: number
          extras?: Json
          id?: string
          loyalty_discount?: number
          loyalty_reward_used?: boolean
          notes?: string
          order_source?: Database["public"]["Enums"]["order_source"]
          paid_at?: string | null
          paid_by?: string | null
          partner_contract_id?: string | null
          payment_method?: Database["public"]["Enums"]["payment_method"] | null
          payment_status?: Database["public"]["Enums"]["payment_status"]
          queue_position?: number
          service_id?: string
          service_key?: string
          started_at?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          subtotal?: number
          total?: number
          updated_at?: string
          vehicle_id?: string | null
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
            foreignKeyName: "orders_partner_contract_id_fkey"
            columns: ["partner_contract_id"]
            isOneToOne: false
            referencedRelation: "partner_contracts"
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
      partner_contracts: {
        Row: {
          active: boolean
          cnpj: string
          company_name: string
          contact_phone: string
          contract_value: number
          created_at: string
          created_by: string | null
          id: string
          monthly_vehicle_limit: number
          updated_at: string
        }
        Insert: {
          active?: boolean
          cnpj: string
          company_name: string
          contact_phone?: string
          contract_value?: number
          created_at?: string
          created_by?: string | null
          id?: string
          monthly_vehicle_limit: number
          updated_at?: string
        }
        Update: {
          active?: boolean
          cnpj?: string
          company_name?: string
          contact_phone?: string
          contract_value?: number
          created_at?: string
          created_by?: string | null
          id?: string
          monthly_vehicle_limit?: number
          updated_at?: string
        }
        Relationships: []
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
      store_expenses: {
        Row: {
          active: boolean
          amount: number
          category: string
          created_at: string
          created_by: string | null
          expense_date: string
          id: string
          name: string
          notes: string
          payment_method: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount: number
          category: string
          created_at?: string
          created_by?: string | null
          expense_date?: string
          id?: string
          name: string
          notes?: string
          payment_method?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          category?: string
          created_at?: string
          created_by?: string | null
          expense_date?: string
          id?: string
          name?: string
          notes?: string
          payment_method?: string | null
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
      create_partner_order: {
        Args: {
          _brand: string
          _category: Database["public"]["Enums"]["vehicle_category"]
          _color: string
          _duration_minutes: number
          _extras: Json
          _model: string
          _notes: string
          _partner_contract_id: string
          _plate: string
          _queue_position: number
          _service_id: string
          _service_key: string
          _subtotal: number
          _year: string
        }
        Returns: {
          actual_minutes: number | null
          category: Database["public"]["Enums"]["vehicle_category"]
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string
          discount: number
          discount_percentage: number
          duration_minutes: number
          extras: Json
          id: string
          loyalty_discount: number
          loyalty_reward_used: boolean
          notes: string
          order_source: Database["public"]["Enums"]["order_source"]
          paid_at: string | null
          paid_by: string | null
          partner_contract_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          queue_position: number
          service_id: string
          service_key: string
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          vehicle_id: string | null
          vehicle_label: string
          vehicle_plate: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_user_has_role: {
        Args: { _role: Database["public"]["Enums"]["app_role"] }
        Returns: boolean
      }
      deliver_partner_order: {
        Args: { _order_id: string }
        Returns: {
          actual_minutes: number | null
          category: Database["public"]["Enums"]["vehicle_category"]
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string
          discount: number
          discount_percentage: number
          duration_minutes: number
          extras: Json
          id: string
          loyalty_discount: number
          loyalty_reward_used: boolean
          notes: string
          order_source: Database["public"]["Enums"]["order_source"]
          paid_at: string | null
          paid_by: string | null
          partner_contract_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          queue_position: number
          service_id: string
          service_key: string
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          vehicle_id: string | null
          vehicle_label: string
          vehicle_plate: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      pay_order: {
        Args: {
          _discount_percentage: number
          _order_id: string
          _payment_method: Database["public"]["Enums"]["payment_method"]
        }
        Returns: {
          actual_minutes: number | null
          category: Database["public"]["Enums"]["vehicle_category"]
          completed_at: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string
          discount: number
          discount_percentage: number
          duration_minutes: number
          extras: Json
          id: string
          loyalty_discount: number
          loyalty_reward_used: boolean
          notes: string
          order_source: Database["public"]["Enums"]["order_source"]
          paid_at: string | null
          paid_by: string | null
          partner_contract_id: string | null
          payment_method: Database["public"]["Enums"]["payment_method"] | null
          payment_status: Database["public"]["Enums"]["payment_status"]
          queue_position: number
          service_id: string
          service_key: string
          started_at: string | null
          status: Database["public"]["Enums"]["order_status"]
          subtotal: number
          total: number
          updated_at: string
          vehicle_id: string | null
          vehicle_label: string
          vehicle_plate: string
        }
        SetofOptions: {
          from: "*"
          to: "orders"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      record_service_actual_minutes: {
        Args: { _minutes: number; _service_id: string }
        Returns: undefined
      }
      resolve_login: { Args: { _username: string }; Returns: string }
    }
    Enums: {
      app_role: "atendimento" | "lavajato" | "gerencia"
      order_source: "customer" | "partner"
      order_status:
        | "queued"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "delivered"
      payment_method: "Crédito" | "Débito" | "Pix"
      payment_status: "pending" | "paid" | "cancelled"
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
      order_source: ["customer", "partner"],
      order_status: [
        "queued",
        "in_progress",
        "completed",
        "cancelled",
        "delivered",
      ],
      payment_method: ["Crédito", "Débito", "Pix"],
      payment_status: ["pending", "paid", "cancelled"],
      vehicle_category: ["Hatch", "Sedan", "SUV", "Picape", "Luxo"],
    },
  },
} as const
