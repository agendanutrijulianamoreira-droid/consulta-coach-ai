import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase as baseSupabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type SprintProgress = Tables["sprint_progress"]["Row"];
export type Offer = Tables["biz_offers"]["Row"];
export type Lead = Tables["crm_leads"]["Row"] & { patient_id: string | null };
export type LeadEvent = Tables["crm_lead_events"]["Row"];
export type Entry = Tables["biz_entries"]["Row"] & { patient_id: string | null };
export type Proposal = Tables["ai_proposals"]["Row"];
export type MessageTemplate = Tables["message_templates"]["Row"];

/**
 * crm_leads e biz_entries ganharam patient_id nesta mesma leva de
 * trabalho, mas o schema gerado do Supabase só conhece essa coluna na
 * próxima regeneração automática — extensão local tipada até então,
 * mesmo padrão já usado para as outras tabelas novas desta sessão.
 */
type FinanceTables = {
  crm_leads: {
    Row: Lead;
    Insert: Tables["crm_leads"]["Insert"] & { patient_id?: string | null };
    Update: Partial<Lead>;
    Relationships: Tables["crm_leads"]["Relationships"];
  };
  biz_entries: {
    Row: Entry;
    Insert: Tables["biz_entries"]["Insert"] & { patient_id?: string | null };
    Update: Partial<Entry>;
    Relationships: Tables["biz_entries"]["Relationships"];
  };
};

type FinanceDatabase = Omit<Database, "public"> & {
  public: Omit<Database["public"], "Tables"> & {
    Tables: Omit<Tables, keyof FinanceTables> & FinanceTables;
  };
};

const supabase = baseSupabase as unknown as SupabaseClient<FinanceDatabase>;

const json = (value: unknown) => value as Json;

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export async function getSprintProgress() {
  const result = await supabase.from("sprint_progress").select("*").maybeSingle();
  if (result.error) throw new Error(result.error.message);
  return result.data as SprintProgress | null;
}

export async function saveSprintProgress(input: {
  answers: Record<string, string>;
  checks: Record<string, boolean>;
  completed_steps: string[];
  current_step: string;
}) {
  return unwrap(
    await supabase
      .from("sprint_progress")
      .upsert(
        {
          answers: json(input.answers),
          checks: json(input.checks),
          completed_steps: input.completed_steps,
          current_step: input.current_step,
          started_at: new Date().toISOString(),
        },
        { onConflict: "owner_id" },
      )
      .select()
      .single(),
  ) as SprintProgress;
}

export async function listOffers() {
  return unwrap(
    await supabase.from("biz_offers").select("*").order("position").order("created_at"),
  ) as Offer[];
}

export async function createOffer(input: {
  name: string;
  kind: string;
  price: number;
  cash_price?: number | null;
  duration_months?: number;
  variable_cost?: number;
  minutes_spent?: number;
  position?: number;
}) {
  return unwrap(await supabase.from("biz_offers").insert(input).select().single()) as Offer;
}

export async function updateOffer(id: string, input: Partial<Offer>) {
  return unwrap(
    await supabase.from("biz_offers").update(input).eq("id", id).select().single(),
  ) as Offer;
}

export async function deleteOffer(id: string) {
  const { error } = await supabase.from("biz_offers").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function listLeads() {
  return unwrap(
    await supabase.from("crm_leads").select("*").order("updated_at", { ascending: false }),
  ) as unknown as Lead[];
}

export async function createLead(input: {
  name: string;
  phone?: string | null;
  email?: string | null;
  source?: string;
  next_action?: string | null;
  next_action_at?: string | null;
  patient_id?: string | null;
}) {
  return unwrap(
    await supabase.from("crm_leads").insert(input).select().single(),
  ) as unknown as Lead;
}

export async function updateLead(id: string, input: Partial<Lead>) {
  const current = unwrap(
    await supabase.from("crm_leads").select("*").eq("id", id).single(),
  ) as unknown as Lead;
  const updated = unwrap(
    await supabase.from("crm_leads").update(input).eq("id", id).select().single(),
  ) as unknown as Lead;
  if (input.stage && input.stage !== current.stage) {
    await recordLeadEvent({
      lead_id: id,
      kind: "mudanca_estagio",
      from_stage: current.stage,
      to_stage: input.stage,
      description: `Estágio alterado de ${current.stage} para ${input.stage}`,
    });
  }
  return updated;
}

export async function deleteLead(id: string) {
  const { error } = await supabase.from("crm_leads").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function recordLeadEvent(input: {
  lead_id: string;
  kind: string;
  from_stage?: string | null;
  to_stage?: string | null;
  description?: string | null;
}) {
  return unwrap(
    await supabase.from("crm_lead_events").insert(input).select().single(),
  ) as LeadEvent;
}

export async function listLeadEvents() {
  return unwrap(
    await supabase.from("crm_lead_events").select("*").order("created_at", { ascending: false }),
  ) as LeadEvent[];
}

export async function listEntries() {
  return unwrap(
    await supabase.from("biz_entries").select("*").order("entry_date", { ascending: false }),
  ) as unknown as Entry[];
}

export async function listEntriesForPatient(patientId: string) {
  return unwrap(
    await supabase
      .from("biz_entries")
      .select("*")
      .eq("patient_id", patientId)
      .order("entry_date", { ascending: false }),
  ) as unknown as Entry[];
}

export async function createEntry(input: {
  entry_type: "contrato" | "recebimento" | "reconhecimento";
  amount: number;
  entry_date: string;
  due_date?: string | null;
  status?: "ok" | "pendente" | "atrasado";
  is_renewal?: boolean;
  offer_id?: string | null;
  lead_id?: string | null;
  patient_id?: string | null;
  description?: string | null;
}) {
  return unwrap(
    await supabase.from("biz_entries").insert(input).select().single(),
  ) as unknown as Entry;
}

export async function updateEntryStatus(id: string, status: "ok" | "pendente" | "atrasado") {
  return unwrap(
    await supabase.from("biz_entries").update({ status }).eq("id", id).select().single(),
  ) as unknown as Entry;
}

export async function listGoals(periodMonth: string) {
  return unwrap(
    await supabase.from("biz_goals").select("*").eq("period_month", periodMonth),
  ) as Tables["biz_goals"]["Row"][];
}

export async function upsertGoal(input: { metric: string; target: number; period_month: string }) {
  return unwrap(
    await supabase
      .from("biz_goals")
      .upsert(input, { onConflict: "owner_id,metric,period_month" })
      .select()
      .single(),
  ) as Tables["biz_goals"]["Row"];
}

export async function listProposals() {
  return unwrap(
    await supabase.from("ai_proposals").select("*").order("created_at", { ascending: false }),
  ) as Proposal[];
}

export async function updateProposal(id: string, status: string) {
  return unwrap(
    await supabase.from("ai_proposals").update({ status }).eq("id", id).select().single(),
  ) as Proposal;
}

export async function recordProposalEvent(input: {
  proposal_id: string;
  actor: string;
  action: string;
  note?: string | null;
}) {
  return unwrap(await supabase.from("ai_proposal_events").insert(input).select().single());
}

export async function listMessageTemplates() {
  return unwrap(
    await supabase.from("message_templates").select("*").order("created_at"),
  ) as MessageTemplate[];
}

export async function createMessageTemplate(input: {
  journey_step: string;
  title: string;
  body: string;
}) {
  return unwrap(
    await supabase.from("message_templates").insert(input).select().single(),
  ) as MessageTemplate;
}

export async function updateMessageTemplate(
  id: string,
  input: { title?: string; body?: string; status?: "rascunho" | "aprovado" },
) {
  return unwrap(
    await supabase.from("message_templates").update(input).eq("id", id).select().single(),
  ) as MessageTemplate;
}
