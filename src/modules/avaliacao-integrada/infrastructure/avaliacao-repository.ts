import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

const json = (value: unknown) => value as Json;

export type AvaliacaoTela = "fontes" | "sintese" | "exames" | "hipoteses" | "rotina" | "conduta";
export type AvaliacaoStatus = "rascunho" | "aprovada";
export type TelaStatus = "pendente" | "revisao" | "aprovada";

type AvaliacaoRow = {
  id: string;
  consultation_id: string;
  version: number;
  status: AvaliacaoStatus;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

type TelaRow = {
  id: string;
  avaliacao_id: string;
  tela: AvaliacaoTela;
  ai_text: Json | null;
  final_text: Json | null;
  sources: Json;
  status: TelaStatus;
  created_at: string;
  updated_at: string;
};

type AlertTermRow = {
  id: string;
  professional_id: string;
  term: string;
  active: boolean;
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

type AvaliacaoTables = {
  avaliacoes_integradas: TableDef<
    AvaliacaoRow,
    {
      id?: string;
      consultation_id: string;
      version?: number;
      status?: AvaliacaoStatus;
      approved_by?: string | null;
      approved_at?: string | null;
      created_at?: string;
      updated_at?: string;
    },
    Partial<AvaliacaoRow>,
    [
      {
        foreignKeyName: "avaliacoes_integradas_consultation_id_fkey";
        columns: ["consultation_id"];
        isOneToOne: true;
        referencedRelation: "consultations";
        referencedColumns: ["id"];
      },
    ]
  >;
  avaliacao_telas: TableDef<
    TelaRow,
    {
      id?: string;
      avaliacao_id: string;
      tela: AvaliacaoTela;
      ai_text?: Json | null;
      final_text?: Json | null;
      sources?: Json;
      status?: TelaStatus;
      created_at?: string;
      updated_at?: string;
    },
    Partial<TelaRow>,
    [
      {
        foreignKeyName: "avaliacao_telas_avaliacao_id_fkey";
        columns: ["avaliacao_id"];
        isOneToOne: false;
        referencedRelation: "avaliacoes_integradas";
        referencedColumns: ["id"];
      },
    ]
  >;
  avaliacao_alert_terms: TableDef<
    AlertTermRow,
    {
      id?: string;
      professional_id?: string;
      term: string;
      active?: boolean;
      created_at?: string;
      updated_at?: string;
    },
    Partial<AlertTermRow>,
    [
      {
        foreignKeyName: "avaliacao_alert_terms_professional_id_fkey";
        columns: ["professional_id"];
        isOneToOne: false;
        referencedRelation: "users";
        referencedColumns: ["id"];
      },
    ]
  >;
};

export type AvaliacaoDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & AvaliacaoTables;
  };
};

/** Extensão local tipada até a próxima regeneração automática do schema Supabase. */
export function asAvaliacaoClient(client: SupabaseClient<Database>) {
  return client as unknown as SupabaseClient<AvaliacaoDatabase>;
}

const avaliacaoSupabase = asAvaliacaoClient(supabase);

export interface Avaliacao {
  id: string;
  consultation_id: string;
  version: number;
  status: AvaliacaoStatus;
  approved_by: string | null;
  approved_at: string | null;
}

export interface AvaliacaoTelaRecord {
  id: string;
  avaliacao_id: string;
  tela: AvaliacaoTela;
  ai_text: unknown;
  final_text: unknown;
  sources: unknown[];
  status: TelaStatus;
}

export interface AlertTerm {
  id: string;
  term: string;
  active: boolean;
}

export async function getAvaliacao(consultationId: string) {
  const { data, error } = await avaliacaoSupabase
    .from("avaliacoes_integradas")
    .select("id, consultation_id, version, status, approved_by, approved_at")
    .eq("consultation_id", consultationId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data as Avaliacao | null;
}

export async function createAvaliacao(consultationId: string) {
  const { data, error } = await avaliacaoSupabase
    .from("avaliacoes_integradas")
    .upsert({ consultation_id: consultationId }, { onConflict: "consultation_id" })
    .select("id, consultation_id, version, status, approved_by, approved_at")
    .single();
  if (error) throw new Error(error.message);
  return data as Avaliacao;
}

export async function listTelas(avaliacaoId: string) {
  const { data, error } = await avaliacaoSupabase
    .from("avaliacao_telas")
    .select("id, avaliacao_id, tela, ai_text, final_text, sources, status")
    .eq("avaliacao_id", avaliacaoId);
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as AvaliacaoTelaRecord[];
}

export async function saveTela(
  avaliacaoId: string,
  tela: AvaliacaoTela,
  patch: { ai_text?: unknown; final_text?: unknown; sources?: unknown[]; status?: TelaStatus },
) {
  const payload = {
    avaliacao_id: avaliacaoId,
    tela,
    ...(patch.ai_text !== undefined ? { ai_text: json(patch.ai_text) } : {}),
    ...(patch.final_text !== undefined ? { final_text: json(patch.final_text) } : {}),
    ...(patch.sources !== undefined ? { sources: json(patch.sources) } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
  };
  const { data, error } = await avaliacaoSupabase
    .from("avaliacao_telas")
    .upsert(payload, { onConflict: "avaliacao_id,tela" })
    .select("id, avaliacao_id, tela, ai_text, final_text, sources, status")
    .single();
  if (error) throw new Error(error.message);
  return data as unknown as AvaliacaoTelaRecord;
}

export async function listAlertTerms() {
  const { data, error } = await avaliacaoSupabase
    .from("avaliacao_alert_terms")
    .select("id, term, active")
    .order("term", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as AlertTerm[];
}

export async function saveAlertTerm(term: string) {
  const { data, error } = await avaliacaoSupabase
    .from("avaliacao_alert_terms")
    .upsert({ term }, { onConflict: "professional_id,term" })
    .select("id, term, active")
    .single();
  if (error) throw new Error(error.message);
  return data as AlertTerm;
}

export async function setAlertTermActive(id: string, active: boolean) {
  const { error } = await avaliacaoSupabase
    .from("avaliacao_alert_terms")
    .update({ active })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function deleteAlertTerm(id: string) {
  const { error } = await avaliacaoSupabase.from("avaliacao_alert_terms").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export interface AvaliacaoHistoryRow {
  consultationId: string;
  date: string;
  status: AvaliacaoStatus | null;
}

export async function listAvaliacaoHistory(patientId: string) {
  const { data: consultations, error: consultationError } = await avaliacaoSupabase
    .from("consultations")
    .select("id, consultation_date")
    .eq("patient_id", patientId)
    .order("consultation_date", { ascending: false });
  if (consultationError) throw new Error(consultationError.message);
  const ids = (consultations ?? []).map((item) => item.id);
  if (!ids.length) return [] as AvaliacaoHistoryRow[];

  const { data: avaliacoes, error } = await avaliacaoSupabase
    .from("avaliacoes_integradas")
    .select("consultation_id, status")
    .in("consultation_id", ids);
  if (error) throw new Error(error.message);
  const statusByConsultation = new Map(
    (avaliacoes ?? []).map((item) => [item.consultation_id, item.status]),
  );
  return (consultations ?? []).map((item) => ({
    consultationId: item.id,
    date: item.consultation_date,
    status: statusByConsultation.get(item.id) ?? null,
  })) as AvaliacaoHistoryRow[];
}
