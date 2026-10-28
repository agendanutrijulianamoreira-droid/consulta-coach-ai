import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { AppointmentStatus } from "@/modules/agenda/domain/agenda";

type AppointmentRow = {
  id: string;
  professional_id: string;
  patient_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string | null;
  consultation_id: string | null;
  reminder_sent_at: string | null;
  created_at: string;
  updated_at: string;
};

type WaitlistStatus = "aguardando" | "contatada" | "agendada" | "cancelada";

type WaitlistRow = {
  id: string;
  professional_id: string;
  patient_id: string;
  desired_period: string | null;
  notes: string | null;
  status: WaitlistStatus;
  created_at: string;
  updated_at: string;
};

type TableDef<
  Row,
  Insert,
  Update = Partial<Insert>,
  Relationships extends readonly unknown[] = [],
> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: Relationships;
};

type AgendaTables = {
  appointments: TableDef<
    AppointmentRow,
    {
      id?: string;
      professional_id?: string;
      patient_id: string;
      scheduled_at: string;
      duration_minutes?: number;
      status?: AppointmentStatus;
      notes?: string | null;
      consultation_id?: string | null;
      reminder_sent_at?: string | null;
      created_at?: string;
      updated_at?: string;
    },
    Partial<AppointmentRow>,
    [
      {
        foreignKeyName: "appointments_patient_id_fkey";
        columns: ["patient_id"];
        isOneToOne: false;
        referencedRelation: "patients";
        referencedColumns: ["id"];
      },
    ]
  >;
  appointment_waitlist: TableDef<
    WaitlistRow,
    {
      id?: string;
      professional_id?: string;
      patient_id: string;
      desired_period?: string | null;
      notes?: string | null;
      status?: WaitlistStatus;
      created_at?: string;
      updated_at?: string;
    },
    Partial<WaitlistRow>,
    [
      {
        foreignKeyName: "appointment_waitlist_patient_id_fkey";
        columns: ["patient_id"];
        isOneToOne: false;
        referencedRelation: "patients";
        referencedColumns: ["id"];
      },
    ]
  >;
};

type AgendaDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & AgendaTables;
  };
};

/** Extensão local tipada até a próxima regeneração automática do schema Supabase. */
const agendaSupabase = supabase as unknown as SupabaseClient<AgendaDatabase>;

export interface Appointment {
  id: string;
  patient_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes: string | null;
  consultation_id: string | null;
}

export interface AppointmentWithPatient extends Appointment {
  patient_name: string;
}

const APPOINTMENT_COLUMNS =
  "id, patient_id, scheduled_at, duration_minutes, status, notes, consultation_id";

export async function listAppointmentsInRange(rangeStartIso: string, rangeEndIso: string) {
  const { data, error } = await agendaSupabase
    .from("appointments")
    .select(`${APPOINTMENT_COLUMNS}, patients(name)`)
    .gte("scheduled_at", rangeStartIso)
    .lt("scheduled_at", rangeEndIso)
    .order("scheduled_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToAppointmentWithPatient(row)) as AppointmentWithPatient[];
}

export async function listUpcomingAppointments(fromIso: string, limit = 50) {
  const { data, error } = await agendaSupabase
    .from("appointments")
    .select(`${APPOINTMENT_COLUMNS}, patients(name)`)
    .gte("scheduled_at", fromIso)
    .order("scheduled_at", { ascending: true })
    .limit(limit);
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => rowToAppointmentWithPatient(row)) as AppointmentWithPatient[];
}

export async function listAppointmentsForConflictCheck(rangeStartIso: string, rangeEndIso: string) {
  const { data, error } = await agendaSupabase
    .from("appointments")
    .select("id, scheduled_at, duration_minutes, status")
    .gte("scheduled_at", rangeStartIso)
    .lt("scheduled_at", rangeEndIso);
  if (error) throw new Error(error.message);
  return (data ?? []) as {
    id: string;
    scheduled_at: string;
    duration_minutes: number;
    status: AppointmentStatus;
  }[];
}

export async function createAppointment(input: {
  patient_id: string;
  scheduled_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  notes?: string | null;
}) {
  const { data, error } = await agendaSupabase
    .from("appointments")
    .insert(input)
    .select(APPOINTMENT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Appointment;
}

export async function updateAppointment(
  id: string,
  patch: Partial<{
    scheduled_at: string;
    duration_minutes: number;
    status: AppointmentStatus;
    notes: string | null;
    consultation_id: string | null;
  }>,
) {
  const { data, error } = await agendaSupabase
    .from("appointments")
    .update(patch)
    .eq("id", id)
    .select(APPOINTMENT_COLUMNS)
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Appointment;
}

export async function deleteAppointment(id: string) {
  const { error } = await agendaSupabase.from("appointments").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface WaitlistEntry {
  id: string;
  patient_id: string;
  patient_name: string;
  desired_period: string | null;
  notes: string | null;
  status: WaitlistStatus;
}

export async function listWaitlist() {
  const { data, error } = await agendaSupabase
    .from("appointment_waitlist")
    .select("id, patient_id, desired_period, notes, status, patients(name)")
    .neq("status", "cancelada")
    .neq("status", "agendada")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    id: row.id,
    patient_id: row.patient_id,
    patient_name:
      (row as unknown as { patients: { name: string } | null }).patients?.name ?? "Paciente",
    desired_period: row.desired_period,
    notes: row.notes,
    status: row.status,
  })) as WaitlistEntry[];
}

export async function addToWaitlist(input: {
  patient_id: string;
  desired_period?: string | null;
  notes?: string | null;
}) {
  const { data, error } = await agendaSupabase
    .from("appointment_waitlist")
    .insert(input)
    .select("id, patient_id, desired_period, notes, status")
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as Omit<WaitlistEntry, "patient_name">;
}

export async function updateWaitlistEntry(
  id: string,
  patch: Partial<{ status: WaitlistStatus; notes: string | null }>,
) {
  const { error } = await agendaSupabase.from("appointment_waitlist").update(patch).eq("id", id);
  if (error) throw new Error(error.message);
}

export async function removeFromWaitlist(id: string) {
  const { error } = await agendaSupabase.from("appointment_waitlist").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

function rowToAppointmentWithPatient(row: unknown): AppointmentWithPatient {
  const record = row as Appointment & { patients: { name: string } | null };
  const { patients, ...appointment } = record;
  return { ...appointment, patient_name: patients?.name ?? "Paciente" };
}
