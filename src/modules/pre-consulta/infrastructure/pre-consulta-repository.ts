import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import {
  generateToken,
  type PreConsultaFormulario,
  type PreConsultaStatus,
} from "@/modules/pre-consulta/domain/pre-consulta";

type FormularioRow = {
  id: string;
  professional_id: string;
  patient_id: string;
  token: string;
  status: PreConsultaStatus;
  respostas: Json | null;
  submitted_at: string | null;
  expires_at: string;
  created_at: string;
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

type PreConsultaTables = {
  preconsulta_formularios: TableDef<
    FormularioRow,
    {
      id?: string;
      professional_id?: string;
      patient_id: string;
      token: string;
      status?: PreConsultaStatus;
      respostas?: Json | null;
      submitted_at?: string | null;
      expires_at?: string;
      created_at?: string;
    },
    Partial<FormularioRow>,
    []
  >;
};

type PreConsultaDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & PreConsultaTables;
  };
};

/** Extensão local tipada até a próxima regeneração automática do schema Supabase. */
export function asPreConsultaClient(client: SupabaseClient<Database>) {
  return client as unknown as SupabaseClient<PreConsultaDatabase>;
}

const preConsultaSupabase = asPreConsultaClient(supabase);

const SELECT_FIELDS =
  "id, patient_id, token, status, respostas, submitted_at, expires_at, created_at";

function mapRow(row: FormularioRow): PreConsultaFormulario {
  return {
    id: row.id,
    patientId: row.patient_id,
    token: row.token,
    status: row.status,
    respostas: row.respostas as PreConsultaFormulario["respostas"],
    submittedAt: row.submitted_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
  };
}

export async function criarFormulario(patientId: string): Promise<PreConsultaFormulario> {
  const { data, error } = await preConsultaSupabase
    .from("preconsulta_formularios")
    .insert({ patient_id: patientId, token: generateToken() })
    .select(SELECT_FIELDS)
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as unknown as FormularioRow);
}

export async function getLatestFormulario(
  patientId: string,
): Promise<PreConsultaFormulario | null> {
  const { data, error } = await preConsultaSupabase
    .from("preconsulta_formularios")
    .select(SELECT_FIELDS)
    .eq("patient_id", patientId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data as unknown as FormularioRow) : null;
}
