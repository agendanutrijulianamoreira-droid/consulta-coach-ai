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
      ai_proposal_events: {
        Row: {
          action: string
          actor: string
          created_at: string
          id: string
          note: string | null
          owner_id: string
          proposal_id: string
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          id?: string
          note?: string | null
          owner_id?: string
          proposal_id: string
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          id?: string
          note?: string | null
          owner_id?: string
          proposal_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_proposal_events_proposal_id_fkey"
            columns: ["proposal_id"]
            isOneToOne: false
            referencedRelation: "ai_proposals"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_proposals: {
        Row: {
          agent: string
          body: string
          created_at: string
          data_summary: string | null
          id: string
          owner_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          agent: string
          body: string
          created_at?: string
          data_summary?: string | null
          id?: string
          owner_id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          agent?: string
          body?: string
          created_at?: string
          data_summary?: string | null
          id?: string
          owner_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      anamnesis: {
        Row: {
          consultation_id: string
          created_at: string
          fields: Json
          id: string
          updated_at: string
        }
        Insert: {
          consultation_id: string
          created_at?: string
          fields?: Json
          id?: string
          updated_at?: string
        }
        Update: {
          consultation_id?: string
          created_at?: string
          fields?: Json
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anamnesis_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: true
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      anthropometry: {
        Row: {
          consultation_id: string
          created_at: string
          data: Json
          id: string
          interpretation: string | null
          updated_at: string
        }
        Insert: {
          consultation_id: string
          created_at?: string
          data?: Json
          id?: string
          interpretation?: string | null
          updated_at?: string
        }
        Update: {
          consultation_id?: string
          created_at?: string
          data?: Json
          id?: string
          interpretation?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "anthropometry_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: true
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      biz_entries: {
        Row: {
          amount: number
          created_at: string
          description: string | null
          due_date: string | null
          entry_date: string
          entry_type: string
          id: string
          is_demo: boolean
          is_renewal: boolean
          lead_id: string | null
          offer_id: string | null
          owner_id: string
          status: string
        }
        Insert: {
          amount: number
          created_at?: string
          description?: string | null
          due_date?: string | null
          entry_date?: string
          entry_type: string
          id?: string
          is_demo?: boolean
          is_renewal?: boolean
          lead_id?: string | null
          offer_id?: string | null
          owner_id?: string
          status?: string
        }
        Update: {
          amount?: number
          created_at?: string
          description?: string | null
          due_date?: string | null
          entry_date?: string
          entry_type?: string
          id?: string
          is_demo?: boolean
          is_renewal?: boolean
          lead_id?: string | null
          offer_id?: string | null
          owner_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "biz_entries_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "biz_entries_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "biz_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      biz_goals: {
        Row: {
          created_at: string
          id: string
          metric: string
          owner_id: string
          period_month: string
          target: number
        }
        Insert: {
          created_at?: string
          id?: string
          metric: string
          owner_id?: string
          period_month: string
          target: number
        }
        Update: {
          created_at?: string
          id?: string
          metric?: string
          owner_id?: string
          period_month?: string
          target?: number
        }
        Relationships: []
      }
      biz_offers: {
        Row: {
          active: boolean
          cash_price: number | null
          created_at: string
          duration_months: number
          id: string
          kind: string
          minutes_spent: number
          monthly_capacity: number | null
          name: string
          owner_id: string
          position: number
          price: number
          updated_at: string
          variable_cost: number
        }
        Insert: {
          active?: boolean
          cash_price?: number | null
          created_at?: string
          duration_months?: number
          id?: string
          kind?: string
          minutes_spent?: number
          monthly_capacity?: number | null
          name: string
          owner_id?: string
          position?: number
          price?: number
          updated_at?: string
          variable_cost?: number
        }
        Update: {
          active?: boolean
          cash_price?: number | null
          created_at?: string
          duration_months?: number
          id?: string
          kind?: string
          minutes_spent?: number
          monthly_capacity?: number | null
          name?: string
          owner_id?: string
          position?: number
          price?: number
          updated_at?: string
          variable_cost?: number
        }
        Relationships: []
      }
      conducts: {
        Row: {
          carb_g: number | null
          consultation_id: string
          created_at: string
          energy: Json
          fat_g: number | null
          goal: string | null
          id: string
          kcal: number | null
          meals_count: number
          notes: string | null
          phase: string | null
          preferences: string[]
          protein_g: number | null
          restrictions: string[]
          updated_at: string
        }
        Insert: {
          carb_g?: number | null
          consultation_id: string
          created_at?: string
          energy?: Json
          fat_g?: number | null
          goal?: string | null
          id?: string
          kcal?: number | null
          meals_count?: number
          notes?: string | null
          phase?: string | null
          preferences?: string[]
          protein_g?: number | null
          restrictions?: string[]
          updated_at?: string
        }
        Update: {
          carb_g?: number | null
          consultation_id?: string
          created_at?: string
          energy?: Json
          fat_g?: number | null
          goal?: string | null
          id?: string
          kcal?: number | null
          meals_count?: number
          notes?: string | null
          phase?: string | null
          preferences?: string[]
          protein_g?: number | null
          restrictions?: string[]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conducts_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: true
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      consultations: {
        Row: {
          clinical_summary: string | null
          consultation_date: string
          created_at: string
          current_step: string
          duration_seconds: number
          ended_at: string | null
          id: string
          observations: string | null
          patient_id: string
          record_kind: string
          started_at: string | null
          status: string
          updated_at: string
          visible_in_history: boolean
        }
        Insert: {
          clinical_summary?: string | null
          consultation_date?: string
          created_at?: string
          current_step?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          observations?: string | null
          patient_id: string
          record_kind?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          visible_in_history?: boolean
        }
        Update: {
          clinical_summary?: string | null
          consultation_date?: string
          created_at?: string
          current_step?: string
          duration_seconds?: number
          ended_at?: string | null
          id?: string
          observations?: string | null
          patient_id?: string
          record_kind?: string
          started_at?: string | null
          status?: string
          updated_at?: string
          visible_in_history?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "consultations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_lead_events: {
        Row: {
          created_at: string
          description: string | null
          from_stage: string | null
          id: string
          kind: string
          lead_id: string
          owner_id: string
          to_stage: string | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          from_stage?: string | null
          id?: string
          kind?: string
          lead_id: string
          owner_id?: string
          to_stage?: string | null
        }
        Update: {
          created_at?: string
          description?: string | null
          from_stage?: string | null
          id?: string
          kind?: string
          lead_id?: string
          owner_id?: string
          to_stage?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_lead_events_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "crm_leads"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_leads: {
        Row: {
          commercial_notes: string | null
          created_at: string
          email: string | null
          id: string
          is_demo: boolean
          name: string
          next_action: string | null
          next_action_at: string | null
          offer_id: string | null
          owner_id: string
          phone: string | null
          source: string
          stage: string
          updated_at: string
        }
        Insert: {
          commercial_notes?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_demo?: boolean
          name: string
          next_action?: string | null
          next_action_at?: string | null
          offer_id?: string | null
          owner_id?: string
          phone?: string | null
          source?: string
          stage?: string
          updated_at?: string
        }
        Update: {
          commercial_notes?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_demo?: boolean
          name?: string
          next_action?: string | null
          next_action_at?: string | null
          offer_id?: string | null
          owner_id?: string
          phone?: string | null
          source?: string
          stage?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_leads_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "biz_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnoses: {
        Row: {
          consultation_id: string
          created_at: string
          hypotheses: Json
          id: string
          reasoning: Json
          recall_flags: Json
          updated_at: string
        }
        Insert: {
          consultation_id: string
          created_at?: string
          hypotheses?: Json
          id?: string
          reasoning?: Json
          recall_flags?: Json
          updated_at?: string
        }
        Update: {
          consultation_id?: string
          created_at?: string
          hypotheses?: Json
          id?: string
          reasoning?: Json
          recall_flags?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnoses_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: true
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      food_recall_items: {
        Row: {
          amount: string | null
          consultation_id: string
          created_at: string
          foods: string | null
          id: string
          notes: string | null
          position: number
          preparation: string | null
          time_label: string | null
        }
        Insert: {
          amount?: string | null
          consultation_id: string
          created_at?: string
          foods?: string | null
          id?: string
          notes?: string | null
          position?: number
          preparation?: string | null
          time_label?: string | null
        }
        Update: {
          amount?: string | null
          consultation_id?: string
          created_at?: string
          foods?: string | null
          id?: string
          notes?: string | null
          position?: number
          preparation?: string | null
          time_label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "food_recall_items_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          carb_g: number
          category: string
          cost_level: number
          created_at: string
          fat_g: number
          fiber_g: number
          glycemic_index: number | null
          group_name: string
          household_measure: string
          id: string
          kcal: number
          meal_slots: string[]
          name: string
          portion_grams: number
          prep_minutes: number
          protein_g: number
          tags: string[]
          updated_at: string
        }
        Insert: {
          carb_g?: number
          category?: string
          cost_level?: number
          created_at?: string
          fat_g?: number
          fiber_g?: number
          glycemic_index?: number | null
          group_name: string
          household_measure?: string
          id?: string
          kcal?: number
          meal_slots?: string[]
          name: string
          portion_grams?: number
          prep_minutes?: number
          protein_g?: number
          tags?: string[]
          updated_at?: string
        }
        Update: {
          carb_g?: number
          category?: string
          cost_level?: number
          created_at?: string
          fat_g?: number
          fiber_g?: number
          glycemic_index?: number | null
          group_name?: string
          household_measure?: string
          id?: string
          kcal?: number
          meal_slots?: string[]
          name?: string
          portion_grams?: number
          prep_minutes?: number
          protein_g?: number
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      lab_assessments: {
        Row: {
          collection_date: string | null
          consultation_id: string
          created_at: string
          id: string
          laboratory_name: string | null
          notes: string | null
          updated_at: string
        }
        Insert: {
          collection_date?: string | null
          consultation_id: string
          created_at?: string
          id?: string
          laboratory_name?: string | null
          notes?: string | null
          updated_at?: string
        }
        Update: {
          collection_date?: string | null
          consultation_id?: string
          created_at?: string
          id?: string
          laboratory_name?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_assessments_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: true
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_reference_targets: {
        Row: {
          active: boolean
          age_max: number | null
          age_min: number | null
          analyte_code: string
          analyte_name: string
          created_at: string
          id: string
          interpretation_above: string | null
          interpretation_below: string | null
          interpretation_in_range: string | null
          professional_id: string | null
          sex: string | null
          source_label: string | null
          source_version: string | null
          target_max: number | null
          target_min: number | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          age_max?: number | null
          age_min?: number | null
          analyte_code: string
          analyte_name: string
          created_at?: string
          id?: string
          interpretation_above?: string | null
          interpretation_below?: string | null
          interpretation_in_range?: string | null
          professional_id?: string | null
          sex?: string | null
          source_label?: string | null
          source_version?: string | null
          target_max?: number | null
          target_min?: number | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          age_max?: number | null
          age_min?: number | null
          analyte_code?: string
          analyte_name?: string
          created_at?: string
          id?: string
          interpretation_above?: string | null
          interpretation_below?: string | null
          interpretation_in_range?: string | null
          professional_id?: string | null
          sex?: string | null
          source_label?: string | null
          source_version?: string | null
          target_max?: number | null
          target_min?: number | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      lab_results: {
        Row: {
          analyte_code: string
          analyte_name: string
          calculation_key: string | null
          calculation_version: string | null
          consultation_id: string
          created_at: string
          dependencies: Json
          id: string
          input_method: string
          is_derived: boolean
          lab_reference_max: number | null
          lab_reference_min: number | null
          lab_reference_text: string | null
          review_status: string
          source_note: string | null
          unit: string | null
          updated_at: string
          value: number | null
          value_text: string | null
        }
        Insert: {
          analyte_code: string
          analyte_name: string
          calculation_key?: string | null
          calculation_version?: string | null
          consultation_id: string
          created_at?: string
          dependencies?: Json
          id?: string
          input_method?: string
          is_derived?: boolean
          lab_reference_max?: number | null
          lab_reference_min?: number | null
          lab_reference_text?: string | null
          review_status?: string
          source_note?: string | null
          unit?: string | null
          updated_at?: string
          value?: number | null
          value_text?: string | null
        }
        Update: {
          analyte_code?: string
          analyte_name?: string
          calculation_key?: string | null
          calculation_version?: string | null
          consultation_id?: string
          created_at?: string
          dependencies?: Json
          id?: string
          input_method?: string
          is_derived?: boolean
          lab_reference_max?: number | null
          lab_reference_min?: number | null
          lab_reference_text?: string | null
          review_status?: string
          source_note?: string | null
          unit?: string | null
          updated_at?: string
          value?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      meal_plans: {
        Row: {
          consultation_id: string
          created_at: string
          id: string
          meals: Json
          rationale: string | null
          recipes: Json
          shopping_list: Json
          totals: Json
          updated_at: string
        }
        Insert: {
          consultation_id: string
          created_at?: string
          id?: string
          meals?: Json
          rationale?: string | null
          recipes?: Json
          shopping_list?: Json
          totals?: Json
          updated_at?: string
        }
        Update: {
          consultation_id?: string
          created_at?: string
          id?: string
          meals?: Json
          rationale?: string | null
          recipes?: Json
          shopping_list?: Json
          totals?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_plans_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      message_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          journey_step: string
          owner_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          journey_step: string
          owner_id?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          journey_step?: string
          owner_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      patients: {
        Row: {
          birth_date: string | null
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          is_pregnant: boolean
          name: string
          notes: string | null
          phone: string | null
          pregnancy_weeks: number | null
          professional_id: string | null
          sex: string | null
          tags: string[]
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_pregnant?: boolean
          name: string
          notes?: string | null
          phone?: string | null
          pregnancy_weeks?: number | null
          professional_id?: string | null
          sex?: string | null
          tags?: string[]
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          is_pregnant?: boolean
          name?: string
          notes?: string | null
          phone?: string | null
          pregnancy_weeks?: number | null
          professional_id?: string | null
          sex?: string | null
          tags?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      recipes: {
        Row: {
          carb_g: number
          created_at: string
          fat_g: number
          id: string
          ingredients: Json
          kcal: number
          meal_slots: string[]
          name: string
          prep_minutes: number
          protein_g: number
          steps: string
          tags: string[]
          updated_at: string
          yield_label: string
        }
        Insert: {
          carb_g?: number
          created_at?: string
          fat_g?: number
          id?: string
          ingredients?: Json
          kcal?: number
          meal_slots?: string[]
          name: string
          prep_minutes?: number
          protein_g?: number
          steps?: string
          tags?: string[]
          updated_at?: string
          yield_label?: string
        }
        Update: {
          carb_g?: number
          created_at?: string
          fat_g?: number
          id?: string
          ingredients?: Json
          kcal?: number
          meal_slots?: string[]
          name?: string
          prep_minutes?: number
          protein_g?: number
          steps?: string
          tags?: string[]
          updated_at?: string
          yield_label?: string
        }
        Relationships: []
      }
      records: {
        Row: {
          consultation_id: string
          created_at: string
          id: string
          report: string | null
          sections: Json
          updated_at: string
        }
        Insert: {
          consultation_id: string
          created_at?: string
          id?: string
          report?: string | null
          sections?: Json
          updated_at?: string
        }
        Update: {
          consultation_id?: string
          created_at?: string
          id?: string
          report?: string | null
          sections?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "records_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: true
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      sprint_progress: {
        Row: {
          answers: Json
          checks: Json
          completed_steps: string[]
          created_at: string
          current_step: string
          id: string
          owner_id: string
          started_at: string | null
          updated_at: string
        }
        Insert: {
          answers?: Json
          checks?: Json
          completed_steps?: string[]
          created_at?: string
          current_step?: string
          id?: string
          owner_id?: string
          started_at?: string | null
          updated_at?: string
        }
        Update: {
          answers?: Json
          checks?: Json
          completed_steps?: string[]
          created_at?: string
          current_step?: string
          id?: string
          owner_id?: string
          started_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      transcript_segments: {
        Row: {
          client_id: string
          consultation_id: string
          content: string
          created_at: string
          id: string
          offset_seconds: number
          speaker: string
        }
        Insert: {
          client_id?: string
          consultation_id: string
          content: string
          created_at?: string
          id?: string
          offset_seconds?: number
          speaker?: string
        }
        Update: {
          client_id?: string
          consultation_id?: string
          content?: string
          created_at?: string
          id?: string
          offset_seconds?: number
          speaker?: string
        }
        Relationships: [
          {
            foreignKeyName: "transcript_segments_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
