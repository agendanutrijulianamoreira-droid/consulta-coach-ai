import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

type Tables = Database["public"]["Tables"];
export type SprintProgress = Tables["sprint_progress"]["Row"];
export type Offer = Tables["biz_offers"]["Row"];
export type Lead = Tables["crm_leads"]["Row"];
export type LeadEvent = Tables["crm_lead_events"]["Row"];
export type Entry = Tables["biz_entries"]["Row"];
export type Proposal = Tables["ai_proposals"]["Row"];
export type MessageTemplate = Tables["message_templates"]["Row"];

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
  ) as Lead[];
}

export async function createLead(input: {
  name: string;
  phone?: string | null;
  email?: string | null;
  source?: string;
  next_action?: string | null;
  next_action_at?: string | null;
}) {
  return unwrap(await supabase.from("crm_leads").insert(input).select().single()) as Lead;
}

export async function updateLead(id: string, input: Partial<Lead>) {
  return unwrap(
    await supabase.from("crm_leads").update(input).eq("id", id).select().single(),
  ) as Lead;
}

export async function listLeadEvents() {
  return unwrap(
    await supabase.from("crm_lead_events").select("*").order("created_at", { ascending: false }),
  ) as LeadEvent[];
}

export async function listEntries() {
  return unwrap(
    await supabase.from("biz_entries").select("*").order("entry_date", { ascending: false }),
  ) as Entry[];
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

export async function listMessageTemplates() {
  return unwrap(
    await supabase.from("message_templates").select("*").order("created_at"),
  ) as MessageTemplate[];
}
