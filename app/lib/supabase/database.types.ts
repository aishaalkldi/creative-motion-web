/**
 * Supabase Database types for the RASQ `public` schema.
 *
 * ── Regeneration ────────────────────────────────────────────────────────────
 *
 * Preferred (live project — produces the canonical file):
 *
 *   1. Log in once:
 *        npx supabase login
 *
 *   2. Set your project ref (Dashboard → Project Settings → General):
 *        $env:SUPABASE_PROJECT_REF = "<your-project-ref>"   # PowerShell
 *        export SUPABASE_PROJECT_REF="<your-project-ref>"    # bash
 *
 *   3. Regenerate this file:
 *        npx supabase gen types typescript --project-id $env:SUPABASE_PROJECT_REF | Out-File -Encoding utf8 app/lib/supabase/database.types.ts
 *
 *      bash/zsh equivalent:
 *        npx supabase gen types typescript --project-id "$SUPABASE_PROJECT_REF" > app/lib/supabase/database.types.ts
 *
 *   If the repo is linked via `npx supabase link --project-ref <ref>`:
 *        npx supabase gen types typescript --linked > app/lib/supabase/database.types.ts
 *
 * Fallback (no live DB — hand-sync from SQL):
 *   Update this file to match supabase/migrations/001–010 and schema.sql after
 *   every new migration. Run `npm run build` and fix any row-type overlays in
 *   app/api/plans/route.ts and app/api/assessments/route.ts.
 *
 * Sprint 1 D1: initial file hand-synced from migrations 001–010 + schema.sql.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      assessments: {
        Row: {
          id: string;
          patient_id: string;
          mode: string;
          selected_tests: string[];
          status: string;
          score: number | null;
          summary: string | null;
          metrics: Json | null;
          body_region: string | null;
          side: string | null;
          visit_type: string | null;
          session_label: string | null;
          duration_seconds: number | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
          provider_id: string | null;
          type: string;
          structured_data: Json | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          patient_id: string;
          mode: string;
          selected_tests?: string[];
          status?: string;
          score?: number | null;
          summary?: string | null;
          metrics?: Json | null;
          body_region?: string | null;
          side?: string | null;
          visit_type?: string | null;
          session_label?: string | null;
          duration_seconds?: number | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
          provider_id?: string | null;
          type?: string;
          structured_data?: Json | null;
          notes?: string | null;
        };
        Update: {
          id?: string;
          patient_id?: string;
          mode?: string;
          selected_tests?: string[];
          status?: string;
          score?: number | null;
          summary?: string | null;
          metrics?: Json | null;
          body_region?: string | null;
          side?: string | null;
          visit_type?: string | null;
          session_label?: string | null;
          duration_seconds?: number | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
          provider_id?: string | null;
          type?: string;
          structured_data?: Json | null;
          notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "assessments_patient_id_fkey";
            columns: ["patient_id"];
            isOneToOne: false;
            referencedRelation: "patients";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessments_provider_id_fkey";
            columns: ["provider_id"];
            isOneToOne: false;
            referencedRelation: "providers";
            referencedColumns: ["id"];
          },
        ];
      };
      clinical_review_acknowledgments: {
        Row: {
          id: string;
          provider_id: string;
          patient_id: string;
          plan_id: string;
          session_log_id: string | null;
          action_status: string;
          trigger_key: string;
          review_note: string | null;
          reviewed_by: string;
          reviewed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          patient_id: string;
          plan_id: string;
          session_log_id?: string | null;
          action_status: string;
          trigger_key: string;
          review_note?: string | null;
          reviewed_by: string;
          reviewed_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          patient_id?: string;
          plan_id?: string;
          session_log_id?: string | null;
          action_status?: string;
          trigger_key?: string;
          review_note?: string | null;
          reviewed_by?: string;
          reviewed_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      cv_session_metrics: {
        Row: {
          id: string;
          provider_id: string;
          patient_id: string | null;
          plan_id: string | null;
          plan_session_id: string | null;
          exercise_id: string;
          rep_count: number | null;
          session_duration_s: number | null;
          tracking_quality: string | null;
          movement_detected: boolean;
          frames_with_pose: number | null;
          frames_total: number | null;
          source: string;
          prototype_version: string;
          recorded_at: string;
          motion_quality: Json | null;
        };
        Insert: {
          id?: string;
          provider_id: string;
          patient_id?: string | null;
          plan_id?: string | null;
          plan_session_id?: string | null;
          exercise_id: string;
          rep_count?: number | null;
          session_duration_s?: number | null;
          tracking_quality?: string | null;
          movement_detected?: boolean;
          frames_with_pose?: number | null;
          frames_total?: number | null;
          source?: string;
          prototype_version?: string;
          recorded_at?: string;
          motion_quality?: Json | null;
        };
        Update: {
          id?: string;
          provider_id?: string;
          patient_id?: string | null;
          plan_id?: string | null;
          plan_session_id?: string | null;
          exercise_id?: string;
          rep_count?: number | null;
          session_duration_s?: number | null;
          tracking_quality?: string | null;
          movement_detected?: boolean;
          frames_with_pose?: number | null;
          frames_total?: number | null;
          source?: string;
          prototype_version?: string;
          recorded_at?: string;
          motion_quality?: Json | null;
        };
        Relationships: [];
      };
      patient_access_tokens: {
        Row: {
          id: string;
          token: string;
          plan_id: string;
          patient_id: string;
          provider_id: string;
          patient_name: string;
          is_active: boolean;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          token: string;
          plan_id: string;
          patient_id: string;
          provider_id: string;
          patient_name: string;
          is_active?: boolean;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          token?: string;
          plan_id?: string;
          patient_id?: string;
          provider_id?: string;
          patient_name?: string;
          is_active?: boolean;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      patients: {
        Row: {
          id: string;
          full_name: string;
          phone: string;
          age: number | null;
          gender: string | null;
          diagnosis: string | null;
          sport: string | null;
          status: string;
          created_at: string;
          updated_at: string;
          provider_id: string;
          file_number: string | null;
        };
        Insert: {
          id?: string;
          full_name: string;
          phone: string;
          age?: number | null;
          gender?: string | null;
          diagnosis?: string | null;
          sport?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
          provider_id: string;
          file_number?: string | null;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string;
          age?: number | null;
          gender?: string | null;
          diagnosis?: string | null;
          sport?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
          provider_id?: string;
          file_number?: string | null;
        };
        Relationships: [];
      };
      plan_sessions: {
        Row: {
          id: string;
          plan_id: string;
          provider_id: string;
          patient_id: string;
          session_number: number;
          title: string;
          description: string | null;
          exercises: Json;
          status: string;
          scheduled_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          provider_id: string;
          patient_id: string;
          session_number: number;
          title: string;
          description?: string | null;
          exercises?: Json;
          status?: string;
          scheduled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          provider_id?: string;
          patient_id?: string;
          session_number?: number;
          title?: string;
          description?: string | null;
          exercises?: Json;
          status?: string;
          scheduled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      providers: {
        Row: {
          id: string;
          name: string;
          clinic_name: string | null;
          email: string | null;
          role: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          clinic_name?: string | null;
          email?: string | null;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          clinic_name?: string | null;
          email?: string | null;
          role?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      remote_assessment_requests: {
        Row: {
          id: string;
          token: string;
          patient_id: string;
          provider_id: string;
          assessment_type: string;
          included_sections: Json | null;
          status: string;
          assessment_id: string | null;
          expires_at: string;
          created_at: string;
          submitted_at: string | null;
        };
        Insert: {
          id?: string;
          token: string;
          patient_id: string;
          provider_id: string;
          assessment_type?: string;
          included_sections?: Json | null;
          status?: string;
          assessment_id?: string | null;
          expires_at?: string;
          created_at?: string;
          submitted_at?: string | null;
        };
        Update: {
          id?: string;
          token?: string;
          patient_id?: string;
          provider_id?: string;
          assessment_type?: string;
          included_sections?: Json | null;
          status?: string;
          assessment_id?: string | null;
          expires_at?: string;
          created_at?: string;
          submitted_at?: string | null;
        };
        Relationships: [];
      };
      session_logs: {
        Row: {
          id: string;
          plan_id: string;
          plan_session_id: string | null;
          provider_id: string;
          patient_id: string;
          patient_token: string;
          effort_score: number | null;
          exercises_completed: number;
          pain_score: number | null;
          notes: string | null;
          completed_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          plan_id: string;
          plan_session_id?: string | null;
          provider_id: string;
          patient_id: string;
          patient_token: string;
          effort_score?: number | null;
          exercises_completed?: number;
          pain_score?: number | null;
          notes?: string | null;
          completed_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          plan_id?: string;
          plan_session_id?: string | null;
          provider_id?: string;
          patient_id?: string;
          patient_token?: string;
          effort_score?: number | null;
          exercises_completed?: number;
          pain_score?: number | null;
          notes?: string | null;
          completed_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      treatment_plans: {
        Row: {
          id: string;
          provider_id: string;
          patient_id: string;
          assessment_id: string | null;
          title: string;
          diagnosis: string | null;
          phase: number;
          total_weeks: number;
          current_week: number;
          status: string;
          clinician_note: string | null;
          structured_data: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          provider_id: string;
          patient_id: string;
          assessment_id?: string | null;
          title: string;
          diagnosis?: string | null;
          phase?: number;
          total_weeks?: number;
          current_week?: number;
          status?: string;
          clinician_note?: string | null;
          structured_data?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          provider_id?: string;
          patient_id?: string;
          assessment_id?: string | null;
          title?: string;
          diagnosis?: string | null;
          phase?: number;
          total_weeks?: number;
          current_week?: number;
          status?: string;
          clinician_note?: string | null;
          structured_data?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

/** Shorthand for a table Row type. */
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type PatientsRow = Tables<"patients">;
export type TreatmentPlansRow = Tables<"treatment_plans">;
export type PlanSessionsRow = Tables<"plan_sessions">;
export type AssessmentsRow = Tables<"assessments">;
