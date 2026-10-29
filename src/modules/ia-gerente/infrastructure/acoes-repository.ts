import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

const json = (value: unknown) => value as Json;

export type Agente = "resumo_diario" | "mensagem_whatsapp";
export type StatusAprovacao = "rascunho" | "aprovado" | "rejeitado";

type AcaoRow = {
  id: string;
  professional_id: string;
  agente: Agente;
  entrada: Json;
  saida: Json;
  status: StatusAprovacao;
  aprovado_em: string | null;
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

type AcoesTables = {
  acoes_agente: TableDef<
    AcaoRow,
    {
      id?: string;
      professional_id?: string;
      agente: Agente;
      entrada?: Json;
      saida?: Json;
      status?: StatusAprovacao;
      aprovado_em?: string | null;
      created_at?: string;
    },
    Partial<AcaoRow>,
    []
  >;
};

type AcoesDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Database["public"]["Tables"] & AcoesTables;
  };
};

/** Extensão local tipada até a próxima regeneração automática do schema Supabase. */
export function asAcoesClient(client: SupabaseClient<Database>) {
  return client as unknown as SupabaseClient<AcoesDatabase>;
}

const acoesSupabase = asAcoesClient(supabase);

export interface AcaoAgente {
  id: string;
  agente: Agente;
  entrada: unknown;
  saida: unknown;
  status: StatusAprovacao;
  aprovadoEm: string | null;
  createdAt: string;
}

/** Registra o rascunho gerado pela IA. Chamado a partir do servidor, logo após cada geração. */
export async function registrarAcao(
  client: SupabaseClient<Database>,
  input: { agente: Agente; entrada: unknown; saida: unknown },
) {
  const acoes = asAcoesClient(client);
  const { data, error } = await acoes
    .from("acoes_agente")
    .insert({ agente: input.agente, entrada: json(input.entrada), saida: json(input.saida) })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** Marca que a profissional de fato usou o rascunho (ex.: copiou a mensagem). */
export async function aprovarAcao(id: string) {
  const { error } = await acoesSupabase
    .from("acoes_agente")
    .update({ status: "aprovado", aprovado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listAcoesRecentes(limit = 30) {
  const { data, error } = await acoesSupabase
    .from("acoes_agente")
    .select("id, agente, entrada, saida, status, aprovado_em, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as AcaoRow[]).map((row): AcaoAgente => ({
    id: row.id,
    agente: row.agente,
    entrada: row.entrada,
    saida: row.saida,
    status: row.status,
    aprovadoEm: row.aprovado_em,
    createdAt: row.created_at,
  }));
}
