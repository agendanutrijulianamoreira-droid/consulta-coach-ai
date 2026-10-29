import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  isCurrentlyOpen,
  type TarefaOrigem,
  type TarefaStatus,
  type TarefaTipo,
  type TaskCandidate,
} from "@/modules/ia-gerente/domain/fila";

type TarefaRow = {
  id: string;
  professional_id: string;
  patient_id: string | null;
  consultation_id: string | null;
  dedupe_key: string;
  tipo: TarefaTipo;
  prioridade: number;
  titulo: string;
  motivo: string;
  action_label: string;
  action_section: string | null;
  origem: TarefaOrigem;
  status: TarefaStatus;
  adiada_ate: string | null;
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

type TarefasTables = {
  tarefas_gerente: TableDef<
    TarefaRow,
    {
      id?: string;
      professional_id?: string;
      patient_id?: string | null;
      consultation_id?: string | null;
      dedupe_key: string;
      tipo: TarefaTipo;
      prioridade: number;
      titulo: string;
      motivo: string;
      action_label: string;
      action_section?: string | null;
      origem?: TarefaOrigem;
      status?: TarefaStatus;
      adiada_ate?: string | null;
      created_at?: string;
      updated_at?: string;
    },
    Partial<TarefaRow>,
    [
      {
        foreignKeyName: "tarefas_gerente_patient_id_fkey";
        columns: ["patient_id"];
        isOneToOne: false;
        referencedRelation: "patients";
        referencedColumns: ["id"];
      },
    ]
  >;
};

type TarefasDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & TarefasTables;
  };
};

/** Extensão local tipada até a próxima regeneração automática do schema Supabase. */
const tarefasSupabase = supabase as unknown as SupabaseClient<TarefasDatabase>;

export interface TarefaRecord {
  id: string;
  patientId: string | null;
  consultationId: string | null;
  tipo: TarefaTipo;
  prioridade: number;
  titulo: string;
  motivo: string;
  actionLabel: string;
  actionSection: string | null;
  status: TarefaStatus;
  adiadaAte: string | null;
}

const COLUMNS =
  "id, patient_id, consultation_id, dedupe_key, tipo, prioridade, titulo, motivo, action_label, action_section, status, adiada_ate";

/** Todas as tarefas que ainda valem a pena mostrar (abertas, ou adiadas cujo prazo já passou), ordenadas por prioridade. */
export async function listOpenTarefas(): Promise<TarefaRecord[]> {
  const { data, error } = await tarefasSupabase
    .from("tarefas_gerente")
    .select(COLUMNS)
    .in("status", ["aberta", "adiada"])
    .order("prioridade", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  const now = new Date();
  return ((data ?? []) as unknown as (TarefaRow & { adiada_ate: string | null })[])
    .filter((row) => isCurrentlyOpen({ status: row.status, adiadaAte: row.adiada_ate }, now))
    .map(rowToRecord);
}

/**
 * Reconcilia a fila com os candidatos recém-calculados pelas regras: cria
 * os novos, atualiza o texto dos que já existem como "aberta" (sem mexer em
 * tarefas que a nutri já adiou ou descartou — a decisão dela fica valendo),
 * e marca como "feita" automaticamente qualquer tarefa aberta cuja condição
 * não existe mais na lista de candidatos (ex.: a consulta foi finalizada).
 */
export async function syncTarefas(candidates: TaskCandidate[]): Promise<void> {
  const { data, error } = await tarefasSupabase
    .from("tarefas_gerente")
    .select("id, dedupe_key, status");
  if (error) throw new Error(error.message);
  const existing = (data ?? []) as unknown as {
    id: string;
    dedupe_key: string;
    status: TarefaStatus;
  }[];

  const existingByKey = new Map(existing.map((row) => [row.dedupe_key, row]));
  const candidateKeys = new Set(candidates.map((c) => c.dedupeKey));

  const upserts = candidates
    .filter((candidate) => {
      const current = existingByKey.get(candidate.dedupeKey);
      return !current || current.status === "aberta";
    })
    .map((candidate) => ({
      patient_id: candidate.patientId,
      consultation_id: candidate.consultationId,
      dedupe_key: candidate.dedupeKey,
      tipo: candidate.tipo,
      prioridade: candidate.prioridade,
      titulo: candidate.titulo,
      motivo: candidate.motivo,
      action_label: candidate.actionLabel,
      action_section: candidate.actionSection,
    }));

  if (upserts.length) {
    const { error: upsertError } = await tarefasSupabase
      .from("tarefas_gerente")
      .upsert(upserts, { onConflict: "professional_id,dedupe_key" });
    if (upsertError) throw new Error(upsertError.message);
  }

  const resolvedIds = existing
    .filter((row) => row.status === "aberta" && !candidateKeys.has(row.dedupe_key))
    .map((row) => row.id);
  if (resolvedIds.length) {
    const { error: resolveError } = await tarefasSupabase
      .from("tarefas_gerente")
      .update({ status: "feita" })
      .in("id", resolvedIds);
    if (resolveError) throw new Error(resolveError.message);
  }
}

export async function adiarTarefa(id: string, adiadaAteIso: string): Promise<void> {
  const { error } = await tarefasSupabase
    .from("tarefas_gerente")
    .update({ status: "adiada", adiada_ate: adiadaAteIso })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function descartarTarefa(id: string): Promise<void> {
  const { error } = await tarefasSupabase
    .from("tarefas_gerente")
    .update({ status: "descartada" })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function concluirTarefa(id: string): Promise<void> {
  const { error } = await tarefasSupabase
    .from("tarefas_gerente")
    .update({ status: "feita" })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

function rowToRecord(row: TarefaRow): TarefaRecord {
  return {
    id: row.id,
    patientId: row.patient_id,
    consultationId: row.consultation_id,
    tipo: row.tipo,
    prioridade: row.prioridade,
    titulo: row.titulo,
    motivo: row.motivo,
    actionLabel: row.action_label,
    actionSection: row.action_section,
    status: row.status,
    adiadaAte: row.adiada_ate,
  };
}
