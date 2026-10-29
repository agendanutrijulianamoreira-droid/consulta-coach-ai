import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";
import type {
  ConditionKey,
  Protocolo,
  ProtocoloInput,
} from "@/modules/protocolos/domain/protocolos";

type ProtocoloRow = {
  id: string;
  professional_id: string;
  title: string;
  conditions: ConditionKey[];
  objetivo: string;
  pilares: string[];
  atencao: string[];
  alimentos_sugeridos: string[];
  observacoes: string | null;
  created_at: string;
  updated_at: string;
};

type AplicacaoRow = {
  id: string;
  professional_id: string;
  protocolo_id: string;
  patient_id: string;
  snapshot: Json;
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

type ProtocolosTables = {
  protocolos: TableDef<
    ProtocoloRow,
    {
      id?: string;
      professional_id?: string;
      title: string;
      conditions?: ConditionKey[];
      objetivo?: string;
      pilares?: string[];
      atencao?: string[];
      alimentos_sugeridos?: string[];
      observacoes?: string | null;
      created_at?: string;
      updated_at?: string;
    },
    Partial<ProtocoloRow>,
    []
  >;
  protocolo_aplicacoes: TableDef<
    AplicacaoRow,
    {
      id?: string;
      professional_id?: string;
      protocolo_id: string;
      patient_id: string;
      snapshot?: Json;
      created_at?: string;
    },
    Partial<AplicacaoRow>,
    []
  >;
};

type ProtocolosDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & ProtocolosTables;
  };
};

/** Extensão local tipada até a próxima regeneração automática do schema Supabase. */
export function asProtocolosClient(client: SupabaseClient<Database>) {
  return client as unknown as SupabaseClient<ProtocolosDatabase>;
}

const protocolosSupabase = asProtocolosClient(supabase);

const SELECT_FIELDS =
  "id, professional_id, title, conditions, objetivo, pilares, atencao, alimentos_sugeridos, observacoes, created_at, updated_at";

function mapRow(row: ProtocoloRow): Protocolo {
  return {
    id: row.id,
    title: row.title,
    conditions: row.conditions ?? [],
    objetivo: row.objetivo ?? "",
    pilares: row.pilares ?? [],
    atencao: row.atencao ?? [],
    alimentosSugeridos: row.alimentos_sugeridos ?? [],
    observacoes: row.observacoes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listProtocolos(): Promise<Protocolo[]> {
  const { data, error } = await protocolosSupabase
    .from("protocolos")
    .select(SELECT_FIELDS)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as ProtocoloRow[]).map(mapRow);
}

export async function createProtocolo(input: ProtocoloInput): Promise<Protocolo> {
  const { data, error } = await protocolosSupabase
    .from("protocolos")
    .insert({
      title: input.title,
      conditions: input.conditions,
      objetivo: input.objetivo,
      pilares: input.pilares,
      atencao: input.atencao,
      alimentos_sugeridos: input.alimentosSugeridos,
      observacoes: input.observacoes,
    })
    .select(SELECT_FIELDS)
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as unknown as ProtocoloRow);
}

export async function updateProtocolo(id: string, input: ProtocoloInput): Promise<Protocolo> {
  const { data, error } = await protocolosSupabase
    .from("protocolos")
    .update({
      title: input.title,
      conditions: input.conditions,
      objetivo: input.objetivo,
      pilares: input.pilares,
      atencao: input.atencao,
      alimentos_sugeridos: input.alimentosSugeridos,
      observacoes: input.observacoes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(SELECT_FIELDS)
    .single();
  if (error) throw new Error(error.message);
  return mapRow(data as unknown as ProtocoloRow);
}

export async function deleteProtocolo(id: string): Promise<void> {
  const { error } = await protocolosSupabase.from("protocolos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function aplicarProtocolo(
  protocoloId: string,
  patientId: string,
  snapshot: unknown,
): Promise<void> {
  const { error } = await protocolosSupabase.from("protocolo_aplicacoes").insert({
    protocolo_id: protocoloId,
    patient_id: patientId,
    snapshot: snapshot as Json,
  });
  if (error) throw new Error(error.message);
}

export interface ProtocoloStats {
  count: number;
  lastAppliedAt: string;
}

export async function listApplicationStats(): Promise<Record<string, ProtocoloStats>> {
  const { data, error } = await protocolosSupabase
    .from("protocolo_aplicacoes")
    .select("protocolo_id, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const stats: Record<string, ProtocoloStats> = {};
  for (const row of (data ?? []) as unknown as { protocolo_id: string; created_at: string }[]) {
    const current = stats[row.protocolo_id];
    if (!current) {
      stats[row.protocolo_id] = { count: 1, lastAppliedAt: row.created_at };
    } else {
      current.count += 1;
    }
  }
  return stats;
}
