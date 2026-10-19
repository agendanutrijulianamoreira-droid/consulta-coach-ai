/** Cálculo puro dos KPIs do painel executivo. Denominador zero → null (exibido como N/D). */
import { CRM_STAGES, type CrmStage } from "./sprint";

export interface KpiLead {
  id: string;
  source: string;
  stage: string;
  created_at: string;
  is_demo: boolean;
}
export interface KpiEvent {
  lead_id: string;
  to_stage: string | null;
}
export interface KpiEntry {
  entry_type: "contrato" | "recebimento" | "reconhecimento";
  amount: number;
  entry_date: string; // YYYY-MM-DD
  status: "ok" | "pendente" | "atrasado";
  is_renewal: boolean;
  offer_id: string | null;
  lead_id: string | null;
  is_demo: boolean;
}
export interface KpiOffer {
  id: string;
  variable_cost: number;
  minutes_spent: number;
}

export function ratio(n: number, d: number): number | null {
  return d > 0 ? n / d : null;
}

const FUNNEL: CrmStage[] = [
  "novo",
  "qualificacao",
  "consulta_oferecida",
  "aguardando_pagamento",
  "confirmada",
  "realizada",
  "protocolo_apresentado",
  "ganho",
];
const order = (s: string | null | undefined) => (s ? FUNNEL.indexOf(s as CrmStage) : -1);
export const isKnownStage = (s: string) => CRM_STAGES.some((c) => c.id === s);

/** Maior estágio do funil já atingido pelo lead (histórico + estágio atual). */
export function furthestStage(lead: KpiLead, events: KpiEvent[]): number {
  let max = order(lead.stage);
  for (const e of events) if (e.lead_id === lead.id) max = Math.max(max, order(e.to_stage));
  return max;
}

export interface KpiInput {
  leads: KpiLead[];
  events: KpiEvent[];
  entries: KpiEntry[];
  offers: KpiOffer[];
  from: string;
  to: string;
  includeDemo: boolean;
  availableMinutes: number | null;
}

export function computeKpis(input: KpiInput) {
  const inRange = (d: string) => d.slice(0, 10) >= input.from && d.slice(0, 10) <= input.to;
  const leads = input.leads.filter(
    (l) => (input.includeDemo || !l.is_demo) && inRange(l.created_at),
  );
  const entries = input.entries.filter(
    (e) => (input.includeDemo || !e.is_demo) && inRange(e.entry_date),
  );
  const sum = (xs: KpiEntry[]) => xs.reduce((a, e) => a + Number(e.amount), 0);

  const contracts = entries.filter((e) => e.entry_type === "contrato");
  const receipts = entries.filter((e) => e.entry_type === "recebimento");
  const paidLeadIds = new Set(
    receipts.filter((e) => e.status === "ok" && e.lead_id).map((e) => e.lead_id as string),
  );
  const contracted = sum(contracts);
  const received = sum(receipts.filter((e) => e.status === "ok"));
  const overdue = sum(receipts.filter((e) => e.status === "atrasado"));
  const expected = sum(receipts);
  const recognized = sum(entries.filter((e) => e.entry_type === "reconhecimento"));

  const offerById = new Map(input.offers.map((o) => [o.id, o]));
  const variableCost = contracts.reduce(
    (a, e) => a + (e.offer_id ? Number(offerById.get(e.offer_id)?.variable_cost ?? 0) : 0),
    0,
  );
  const minutesUsed = contracts.reduce(
    (a, e) => a + (e.offer_id ? Number(offerById.get(e.offer_id)?.minutes_spent ?? 0) : 0),
    0,
  );

  const reached = (stage: CrmStage) =>
    leads.filter((l) => furthestStage(l, input.events) >= order(stage)).length;
  const confirmed = reached("confirmada");
  const paidConsultations = leads.filter(
    (lead) => furthestStage(lead, input.events) >= order("confirmada") && paidLeadIds.has(lead.id),
  ).length;
  const done = reached("realizada");
  const won = reached("ganho");

  const bySource: Record<string, number> = {};
  for (const l of leads) bySource[l.source] = (bySource[l.source] ?? 0) + 1;

  return {
    leads: leads.length,
    bySource,
    contracted,
    received,
    recognized,
    contractsCount: contracts.length,
    averageTicket: ratio(contracted, contracts.length),
    schedulingRate: ratio(confirmed, leads.length),
    paidConsultations,
    attendanceRate: ratio(done, confirmed),
    protocolConversion: ratio(won, done),
    renewals: contracts.filter((e) => e.is_renewal).length,
    delinquencyRate: ratio(overdue, expected),
    margin: ratio(contracted - variableCost, contracted),
    capacityUse: input.availableMinutes ? ratio(minutesUsed, input.availableMinutes) : null,
  };
}

export interface MixLine {
  price: number;
  quantity: number;
  installments: number;
  duration_months: number;
  kind: string;
}
/** Simulação do mix: contratado ≠ caixa do mês ≠ receita reconhecida; cada venda conta uma vez. */
export function simulateMix(lines: MixLine[], goal: number) {
  let contracted = 0,
    cash = 0,
    recognized = 0;
  for (const l of lines) {
    const q = Math.max(0, l.quantity);
    contracted += l.price * q;
    cash += (l.price / Math.max(1, l.installments)) * q;
    recognized += (l.duration_months > 1 ? l.price / l.duration_months : l.price) * q;
  }
  return { contracted, cash, recognized, gap: Math.max(0, goal - contracted) };
}

export const brl = (v: number | null) =>
  v === null ? "N/D" : v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const pct = (v: number | null) =>
  v === null ? "N/D" : `${(v * 100).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;

/** Data de hoje no fuso America/Sao_Paulo (YYYY-MM-DD). */
export function todaySP(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}
export function monthRangeSP(now = new Date()) {
  const today = todaySP(now);
  const [y, m] = today.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).getUTCDate();
  return {
    from: `${today.slice(0, 7)}-01`,
    to: `${today.slice(0, 7)}-${String(last).padStart(2, "0")}`,
  };
}
