/**
 * Consultório Estruturado — Sprint 90 minutos.
 * Definições puras (sem UI/banco): etapas do wizard, regras de conclusão,
 * catálogo inicial editável, jornada, rotinas e entregáveis.
 */

export const UNKNOWN = "__desconhecido__";

export type FieldType = "text" | "number" | "money" | "textarea";
export interface StepField {
  key: string;
  label: string;
  type: FieldType;
  essential: boolean;
  hint?: string;
}
export interface SprintStep {
  id: string;
  title: string;
  minutes: number;
  goal: string;
  fields: StepField[];
  checklist: { key: string; label: string }[];
}

export const SPRINT_STEPS: SprintStep[] = [
  {
    id: "diagnostico",
    title: "Diagnóstico empresarial",
    minutes: 15,
    goal: "Registrar a foto atual do negócio. Use “Não sei” quando não tiver o número — vira pendência.",
    fields: [
      { key: "receita_mensal", label: "Receita média mensal (R$)", type: "money", essential: true },
      { key: "leads_mes", label: "Leads por mês", type: "number", essential: true },
      { key: "consultas_mes", label: "Consultas por mês", type: "number", essential: true },
      { key: "pacientes_ativos", label: "Pacientes ativos", type: "number", essential: true },
      {
        key: "horas_disponiveis_mes",
        label: "Horas clínicas disponíveis por mês",
        type: "number",
        essential: true,
      },
      { key: "custos_fixos", label: "Custos fixos mensais (R$)", type: "money", essential: true },
      { key: "observacoes_diag", label: "Observações", type: "textarea", essential: false },
    ],
    checklist: [
      { key: "receita_mensal_revisada", label: "Revisei a receita média mensal e sua fonte" },
      { key: "volume_atendimento_revisado", label: "Revisei leads, consultas e pacientes ativos" },
      { key: "capacidade_custos_revisados", label: "Revisei horas disponíveis e custos fixos" },
    ],
  },
  {
    id: "ofertas",
    title: "Ofertas, margem e capacidade",
    minutes: 15,
    goal: "Revisar o catálogo, preencher custos variáveis e tempo gasto por oferta.",
    fields: [
      { key: "oferta_principal", label: "Oferta principal", type: "text", essential: true },
      {
        key: "meta_receita",
        label: "Meta de contratação mensal (R$)",
        type: "money",
        essential: true,
        hint: "Ex.: 30000",
      },
      {
        key: "politica_desconto",
        label: "Política de desconto / à vista",
        type: "textarea",
        essential: false,
      },
    ],
    checklist: [
      { key: "oferta_principal_revisada", label: "Defini e revisei a oferta principal" },
      { key: "meta_receita_revisada", label: "Defini a meta de contratação mensal" },
      {
        key: "politica_desconto_revisada",
        label: "Registrei a política de desconto ou preço à vista",
      },
    ],
  },
  {
    id: "jornada",
    title: "Jornada e onboarding",
    minutes: 15,
    goal: "Definir os passos do paciente e personalizar os rascunhos de mensagem.",
    fields: [
      {
        key: "canal_principal",
        label: "Canal principal de contato",
        type: "text",
        essential: true,
      },
      { key: "prazo_resposta", label: "Prazo de resposta ao lead", type: "text", essential: true },
      {
        key: "onboarding",
        label: "O que o paciente recebe após contratar",
        type: "textarea",
        essential: true,
      },
    ],
    checklist: [
      { key: "canal_revisado", label: "Defini o canal principal de contato" },
      { key: "prazo_revisado", label: "Defini o prazo de resposta ao lead" },
      { key: "onboarding_revisado", label: "Descrevi o que o paciente recebe após contratar" },
    ],
  },
  {
    id: "crm",
    title: "CRM e follow-ups",
    minutes: 15,
    goal: "Cadastrar os leads em aberto e a próxima ação de cada um.",
    fields: [
      {
        key: "regra_followup",
        label: "Regra de follow-up (ex.: D+1, D+3, D+7)",
        type: "text",
        essential: true,
      },
      { key: "responsavel_crm", label: "Quem atualiza o CRM", type: "text", essential: true },
    ],
    checklist: [
      { key: "regra_followup_revisada", label: "Defini a regra de follow-up" },
      { key: "responsavel_revisado", label: "Defini quem atualiza o CRM" },
    ],
  },
  {
    id: "financeiro",
    title: "Financeiro e KPIs",
    minutes: 15,
    goal: "Separar contratado, recebido e receita reconhecida. Definir metas.",
    fields: [
      {
        key: "meio_recebimento",
        label: "Como recebe (Pix, cartão, plataforma)",
        type: "text",
        essential: true,
      },
      { key: "dia_fechamento", label: "Dia do fechamento mensal", type: "number", essential: true },
      { key: "meta_leads", label: "Meta de leads/mês", type: "number", essential: false },
    ],
    checklist: [
      { key: "meio_recebimento_revisado", label: "Defini os meios de recebimento" },
      { key: "fechamento_revisado", label: "Defini o dia de fechamento mensal" },
    ],
  },
  {
    id: "ativacao",
    title: "Central IA e ativação",
    minutes: 15,
    goal: "Entender a Central de Aprovações e agendar a rotina pós-instalação.",
    fields: [
      { key: "horario_rotina", label: "Horário da rotina diária", type: "text", essential: true },
      {
        key: "data_revisao_30",
        label: "Data da reunião de 30 dias",
        type: "text",
        essential: true,
      },
    ],
    checklist: [
      { key: "rotina_revisada", label: "Defini o horário da rotina diária" },
      { key: "revisao_revisada", label: "Agendei a reunião de revisão de 30 dias" },
    ],
  },
];

export type Answers = Record<string, string>;
export type ChecklistState = Record<string, boolean>;

export function isFilled(value: string | undefined): boolean {
  return value !== undefined && value.trim() !== "";
}

/** Uma etapa só conclui com todos os essenciais preenchidos (ou "Não sei") e o checklist todo marcado. */
export function stepStatus(step: SprintStep, answers: Answers, checks: ChecklistState) {
  const missing = step.fields
    .filter((f) => f.essential && !isFilled(answers[f.key]))
    .map((f) => f.label);
  const unknown = step.fields.filter((f) => answers[f.key] === UNKNOWN).map((f) => f.label);
  const unchecked = step.checklist
    .filter((c) => !checks[`${step.id}.${c.key}`])
    .map((c) => c.label);
  return {
    canComplete: missing.length === 0 && unchecked.length === 0,
    missing,
    unknown,
    unchecked,
  };
}

export function sprintProgress(completed: string[]): number {
  const valid = completed.filter((id) => SPRINT_STEPS.some((s) => s.id === id));
  return Math.round((new Set(valid).size / SPRINT_STEPS.length) * 100);
}

export type OfferKind = "assinatura" | "checkout" | "servico_clinico";
export const OFFER_KIND_LABEL: Record<OfferKind, string> = {
  assinatura: "Assinatura",
  checkout: "Checkout (digital)",
  servico_clinico: "Serviço clínico",
};

/** Catálogo inicial informado pela profissional — editável; custos começam em 0 (a preencher). */
export const SEED_OFFERS: Array<{
  name: string;
  kind: OfferKind;
  price: number;
  cash_price: number | null;
  duration_months: number;
}> = [
  { name: "E-book", kind: "checkout", price: 37, cash_price: null, duration_months: 0 },
  {
    name: "Comunidade (mensal)",
    kind: "assinatura",
    price: 97,
    cash_price: null,
    duration_months: 1,
  },
  { name: "Consulta", kind: "servico_clinico", price: 200, cash_price: null, duration_months: 0 },
  { name: "Check-up", kind: "servico_clinico", price: 520, cash_price: 480, duration_months: 0 },
  {
    name: "Protocolo 3 meses",
    kind: "servico_clinico",
    price: 2190,
    cash_price: null,
    duration_months: 3,
  },
  {
    name: "Protocolo 6 meses",
    kind: "servico_clinico",
    price: 4190,
    cash_price: null,
    duration_months: 6,
  },
  {
    name: "Protocolo 12 meses",
    kind: "servico_clinico",
    price: 7590,
    cash_price: null,
    duration_months: 12,
  },
  {
    name: "Mapa genético",
    kind: "servico_clinico",
    price: 997,
    cash_price: null,
    duration_months: 0,
  },
];

export const CRM_STAGES = [
  { id: "novo", label: "Novo lead" },
  { id: "qualificacao", label: "Qualificação" },
  { id: "consulta_oferecida", label: "Consulta oferecida" },
  { id: "aguardando_pagamento", label: "Aguardando pagamento" },
  { id: "confirmada", label: "Confirmada" },
  { id: "realizada", label: "Realizada" },
  { id: "protocolo_apresentado", label: "Protocolo apresentado" },
  { id: "ganho", label: "Ganho" },
  { id: "perdido", label: "Perdido" },
  { id: "reagendado", label: "Reagendado" },
] as const;
export type CrmStage = (typeof CRM_STAGES)[number]["id"];

export const LEAD_SOURCES = [
  { id: "instagram", label: "Instagram" },
  { id: "google", label: "Google" },
  { id: "whatsapp", label: "WhatsApp" },
  { id: "indicacao", label: "Indicação" },
  { id: "outro", label: "Outro" },
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number]["id"];

export function normalizePhone(v: string | null | undefined) {
  return (v ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
}
export function normalizeEmail(v: string | null | undefined) {
  return (v ?? "").trim().toLowerCase();
}
export function findDuplicateLead<
  T extends { id: string; phone: string | null; email: string | null },
>(
  leads: T[],
  candidate: { phone?: string | null; email?: string | null },
  ignoreId?: string,
): T | undefined {
  const phone = normalizePhone(candidate.phone);
  const email = normalizeEmail(candidate.email);
  return leads.find(
    (l) =>
      l.id !== ignoreId &&
      ((phone.length >= 8 && normalizePhone(l.phone) === phone) ||
        (email !== "" && normalizeEmail(l.email) === email)),
  );
}

export const JOURNEY_TEMPLATES: Array<{ step: string; title: string; body: string }> = [
  {
    step: "primeiro_contato",
    title: "Primeiro contato",
    body: "Olá, {nome}! Obrigada pelo contato. Posso te fazer duas perguntas rápidas para entender o seu objetivo?",
  },
  {
    step: "qualificacao",
    title: "Qualificação",
    body: "{nome}, qual é hoje o seu principal objetivo com a nutrição e há quanto tempo isso te incomoda?",
  },
  {
    step: "link_pagamento",
    title: "Link de pagamento",
    body: "{nome}, segue o link para confirmar sua consulta: {link}. Assim que o pagamento for confirmado, eu te envio as orientações.",
  },
  {
    step: "pre_consulta",
    title: "Pré-consulta",
    body: "{nome}, sua consulta está marcada para {data}. Traga seus exames recentes e venha em jejum de 3 horas.",
  },
  {
    step: "consulta",
    title: "Dia da consulta",
    body: "Bom dia, {nome}! Te espero hoje às {hora}. Qualquer imprevisto, me avise por aqui.",
  },
  {
    step: "protocolo",
    title: "Apresentação do protocolo",
    body: "{nome}, como conversamos, o protocolo de {duracao} inclui {entregas}. Posso te enviar a proposta?",
  },
  {
    step: "checkin",
    title: "Check-in",
    body: "Oi, {nome}! Como foi a sua semana com o plano? Me conta de 0 a 10 a sua adesão.",
  },
  {
    step: "relatorio_reino",
    title: "Relatório REINO",
    body: "{nome}, preparei o seu relatório de evolução do período. Vamos revisar juntas na próxima consulta?",
  },
  {
    step: "renovacao",
    title: "Renovação",
    body: "{nome}, seu ciclo termina em {data}. Quer conversar sobre a próxima fase do acompanhamento?",
  },
  {
    step: "indicacao",
    title: "Indicação",
    body: "{nome}, se alguém próximo também quiser cuidar da saúde, fico feliz em receber a sua indicação.",
  },
];

export type DeliveryStatus = "pendente" | "instalado" | "validado" | "apurado";
export const DELIVERY_STATUS_LABEL: Record<DeliveryStatus, string> = {
  pendente: "Pendente",
  instalado: "Instalado/configurado",
  validado: "Validado em uso",
  apurado: "Resultado apurado",
};

export const ROUTINES: Array<{ group: string; items: { key: string; label: string }[] }> = [
  {
    group: "Diária",
    items: [
      { key: "d_crm", label: "Atualizar estágios do CRM e próximas ações" },
      { key: "d_resp", label: "Responder leads dentro do prazo definido" },
      { key: "d_aprov", label: "Revisar a Central de Aprovações" },
    ],
  },
  {
    group: "Semanal",
    items: [
      { key: "s_kpi", label: "Revisar painel executivo da semana" },
      { key: "s_follow", label: "Follow-up de leads parados há mais de 3 dias" },
      { key: "s_fin", label: "Conferir recebimentos e atrasos" },
    ],
  },
  {
    group: "Mensal",
    items: [
      { key: "m_fech", label: "Fechamento: contratado × recebido × reconhecido" },
      { key: "m_meta", label: "Definir metas do próximo mês" },
      { key: "m_ofertas", label: "Revisar preços, custos e capacidade" },
    ],
  },
];

export const SPRINT_7_DAYS = [
  "Dia 1 — Lançar todos os leads em aberto no CRM",
  "Dia 2 — Personalizar 3 rascunhos de mensagem",
  "Dia 3 — Registrar contratos e recebimentos do mês",
  "Dia 4 — Preencher custo e tempo de cada oferta",
  "Dia 5 — Revisar as primeiras propostas da IA",
  "Dia 6 — Conferir o painel com números reais",
  "Dia 7 — Revisão semanal e ajustes",
];

export const MEETING_TEMPLATES = [
  {
    title: "Reunião de 30 dias",
    agenda: [
      "Uso real do CRM e rotina",
      "KPIs do mês vs metas",
      "Pendências do diagnóstico",
      "Ajustes de ofertas",
      "Próximos 30 dias",
    ],
  },
  {
    title: "Reunião de 60 dias",
    agenda: [
      "Tendência de 2 meses",
      "Conversão consulta → protocolo",
      "Renovações e inadimplência",
      "Capacidade e margem",
      "Plano para o dia 90",
    ],
  },
];

export const DELIVERABLES = [
  "Diagnóstico empresarial registrado",
  "Catálogo de ofertas com margem",
  "Simulação de mix mensal",
  "Jornada do paciente definida",
  "Biblioteca de mensagens (rascunhos)",
  "CRM Kanban ativo",
  "Regra de follow-up",
  "Lançamentos financeiros separados",
  "Metas mensais",
  "Painel executivo",
  "Central de Aprovações IA",
  "Rotina operacional",
  "Dossiê final de 90 dias",
];

export const LOCKED_PHASES = [
  { title: "Negócio Lucrativo", description: "Otimização de margem, precificação e mix." },
  { title: "Estrutura Empresarial", description: "Processos, equipe e governança." },
  { title: "Escala e Tempo", description: "Automação aprovada e liberação de agenda." },
];

export const INTEGRATIONS = ["Kiwify", "Google Calendar", "WhatsApp", "Google Drive"];
