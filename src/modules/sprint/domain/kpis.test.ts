import { describe, expect, test } from "bun:test";
import { computeKpis, monthRangeSP, simulateMix, type KpiEntry, type KpiLead } from "./kpis";
import { SPRINT_STEPS, UNKNOWN, findDuplicateLead, sprintProgress, stepStatus } from "./sprint";

const base = {
  events: [],
  offers: [],
  from: "2026-10-01",
  to: "2026-10-31",
  includeDemo: false,
  availableMinutes: null,
};
const entry = (p: Partial<KpiEntry>): KpiEntry => ({
  entry_type: "contrato",
  amount: 0,
  entry_date: "2026-10-10",
  status: "ok",
  is_renewal: false,
  offer_id: null,
  lead_id: null,
  is_demo: false,
  ...p,
});
const lead = (p: Partial<KpiLead>): KpiLead => ({
  id: crypto.randomUUID(),
  source: "instagram",
  stage: "novo",
  created_at: "2026-10-05T12:00:00Z",
  is_demo: false,
  ...p,
});

describe("KPIs", () => {
  test("denominador zero vira N/D (null)", () => {
    const k = computeKpis({ ...base, leads: [], entries: [] });
    expect(k.averageTicket).toBe(null);
    expect(k.schedulingRate).toBe(null);
    expect(k.attendanceRate).toBe(null);
    expect(k.margin).toBe(null);
    expect(k.delinquencyRate).toBe(null);
  });

  test("contratado, recebido e reconhecido não se somam", () => {
    const k = computeKpis({
      ...base,
      leads: [],
      entries: [
        entry({ amount: 2190 }),
        entry({ entry_type: "recebimento", amount: 730 }),
        entry({ entry_type: "reconhecimento", amount: 730 }),
      ],
    });
    expect(k.contracted).toBe(2190);
    expect(k.received).toBe(730);
    expect(k.recognized).toBe(730);
    expect(k.averageTicket).toBe(2190);
  });

  test("dados demo ficam fora por padrão", () => {
    const entries = [entry({ amount: 200 }), entry({ amount: 999, is_demo: true })];
    expect(computeKpis({ ...base, leads: [], entries }).contracted).toBe(200);
    expect(computeKpis({ ...base, leads: [], entries, includeDemo: true }).contracted).toBe(1199);
  });

  test("filtro de período exclui fora do intervalo", () => {
    expect(
      computeKpis({
        ...base,
        leads: [],
        entries: [entry({ amount: 200, entry_date: "2026-09-30" })],
      }).contracted,
    ).toBe(0);
  });

  test("funil: agendamento, comparecimento e conversão", () => {
    const leads = [
      lead({ stage: "ganho" }),
      lead({ stage: "realizada" }),
      lead({ stage: "confirmada" }),
      lead({ stage: "novo" }),
    ];
    const k = computeKpis({ ...base, leads, entries: [] });
    expect(k.schedulingRate).toBe(0.75);
    expect(Math.round((k.attendanceRate ?? 0) * 1000)).toBe(667);
    expect(k.protocolConversion).toBe(0.5);
  });

  test("inadimplência = atrasado / recebimentos esperados", () => {
    const k = computeKpis({
      ...base,
      leads: [],
      entries: [
        entry({ entry_type: "recebimento", amount: 300 }),
        entry({ entry_type: "recebimento", amount: 100, status: "atrasado" }),
      ],
    });
    expect(k.delinquencyRate).toBe(0.25);
  });

  test("consulta paga exige recebimento ok vinculado ao lead", () => {
    const paid = lead({ id: "paid", stage: "confirmada" });
    const unpaid = lead({ id: "unpaid", stage: "confirmada" });
    const k = computeKpis({
      ...base,
      leads: [paid, unpaid],
      entries: [entry({ entry_type: "recebimento", amount: 200, lead_id: paid.id })],
    });
    expect(k.schedulingRate).toBe(1);
    expect(k.paidConsultations).toBe(1);
  });
});

describe("mix", () => {
  test("protocolo 3m parcelado: contrata 2190, caixa 730, reconhece 730", () => {
    const r = simulateMix(
      [{ price: 2190, quantity: 1, installments: 3, duration_months: 3, kind: "servico_clinico" }],
      30000,
    );
    expect(r.contracted).toBe(2190);
    expect(r.cash).toBe(730);
    expect(r.recognized).toBe(730);
    expect(r.gap).toBe(27810);
  });
});

describe("wizard", () => {
  const step = SPRINT_STEPS[0]!;
  test("não conclui com essenciais vazios", () => {
    expect(stepStatus(step, {}, {}).canComplete).toBe(false);
  });
  test("aceita 'Não sei' como pendência explícita", () => {
    const answers = Object.fromEntries(
      step.fields.filter((f) => f.essential).map((f) => [f.key, UNKNOWN]),
    );
    const checks = Object.fromEntries(step.checklist.map((c) => [`${step.id}.${c.key}`, true]));
    const s = stepStatus(step, answers, checks);
    expect(s.canComplete).toBe(true);
    expect(s.unknown.length).toBe(6);
  });
  test("checklist incompleto bloqueia", () => {
    const answers = Object.fromEntries(step.fields.map((f) => [f.key, "1"]));
    expect(stepStatus(step, answers, {}).canComplete).toBe(false);
  });
  test("progresso conta etapas válidas e únicas", () => {
    expect(sprintProgress(["diagnostico", "diagnostico", "xyz"])).toBe(17);
  });
  test("dedup por telefone com DDI e por e-mail", () => {
    const leads = [
      { id: "a", phone: "(31) 99945-8139", email: null },
      { id: "b", phone: null, email: "X@Y.com" },
    ];
    expect(findDuplicateLead(leads, { phone: "+55 31 999458139" })?.id).toBe("a");
    expect(findDuplicateLead(leads, { email: " x@y.com" })?.id).toBe("b");
    expect(findDuplicateLead(leads, { phone: "123" })).toBe(undefined);
  });
  test("mês no fuso de São Paulo", () => {
    expect(monthRangeSP(new Date("2026-11-01T02:00:00Z"))).toEqual({
      from: "2026-10-01",
      to: "2026-10-31",
    });
  });
});
