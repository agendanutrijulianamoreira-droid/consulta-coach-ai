/** Domínio determinístico do parecer nutricional. A IA redige; nunca calcula números. */
import {
  analyzeAnthropometry,
  biologicalSex,
  bmiClass,
  bodyFatClass,
  num,
  selectedVisceralScale,
  visceralFatClass,
  whrRiskClass,
  type AnthroData,
} from "@/modules/avaliacao/domain/anthropometry";

export interface ParecerPatient {
  name: string;
  age: number | null;
  sex: string | null;
  evaluationDate: string;
  phase: string;
}

export interface ParecerRow {
  label: string;
  value: string;
  reference: string;
  calculated?: boolean | undefined;
  tone?: "ok" | "atencao" | "alto" | "neutro" | undefined;
}

export interface ParecerGauge {
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  refMin: number;
  refMax: number;
}

export interface ParecerMetrics {
  weight: number | null;
  weightEstimated: boolean;
  height: number | null;
  bmi: number | null;
  bmiClass: string | null;
  waist: number | null;
  hip: number | null;
  abdomen: number | null;
  arm: number | null;
  whr: number | null;
  whrClass: string | null;
  fatPct: number | null;
  fatClass: string | null;
  fatMass: number | null;
  fatExcess: number | null;
  musclePct: number | null;
  muscleMass: number | null;
  leanMass: number | null;
  visceral: number | null;
  visceralClass: string | null;
  metabolicAge: number | null;
  boneWeight: number | null;
  boneWeightSource: "bioimpedance" | "diameters" | null;
  hydration: number | null;
  hydrationDescriptive: boolean;
  bmr: number | null;
  cmb: number | null;
  cmbClass: string | null;
  amb: number | null;
  score: number;
  male: boolean;
}

const r = (value: number, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

function cmbReference(male: boolean) {
  return male ? 25.3 : 21.97;
}

function cmbClassification(pct: number) {
  if (pct < 70) return "Desnutrição grave";
  if (pct < 80) return "Desnutrição moderada";
  if (pct < 90) return "Desnutrição leve";
  if (pct <= 110) return "Eutrofia";
  return "Acima do padrão de referência";
}

function compositionScore(m: {
  fatPct: number | null;
  musclePct: number | null;
  metabolicAge: number | null;
  age: number | null;
  visceral: number | null;
  whr: number | null;
  male: boolean;
}) {
  const fatCut = m.male ? 20 : 28;
  const muscleCut = m.male ? 38 : 30;
  const whrCut = m.male ? 0.9 : 0.8;
  let penalty = 0;
  if (m.fatPct !== null && m.fatPct > fatCut) penalty += Math.min(35, (m.fatPct - fatCut) * 1.5);
  if (m.musclePct !== null && m.musclePct < muscleCut) penalty += Math.min(20, (muscleCut - m.musclePct) * 1.2);
  if (m.metabolicAge !== null && m.age !== null && m.metabolicAge > m.age) penalty += Math.min(20, (m.metabolicAge - m.age) * 0.6);
  if (m.visceral !== null && m.visceral >= 7) penalty += Math.min(15, (m.visceral - 6) * 2.2);
  if (m.whr !== null && m.whr >= whrCut) penalty += Math.min(10, (m.whr - (whrCut - 0.01)) * 30);
  return Math.max(0, Math.min(100, Math.round(100 - penalty)));
}

export function buildParecerMetrics(data: AnthroData, patient: ParecerPatient): ParecerMetrics {
  const sex = biologicalSex(patient.sex);
  const male = sex === "male";
  const age = patient.age;
  const weight = num(data["peso"]);
  const height = num(data["altura"]);
  const bmi = weight && height ? r(weight / (height / 100) ** 2, 1) : null;
  const waist = num(data["c_cintura"]);
  const hip = num(data["c_quadril"]);
  const abdomen = num(data["c_abdomen"]);
  const arm = num(data["c_braco_relaxado"]);
  const triceps = num(data["d_tricipital"]);
  const whr = waist && hip ? r(waist / hip, 2) : null;

  const fatPctRaw = num(data["bia_gordura_pct"]);
  const fatMassRaw = num(data["bia_massa_gorda"]);
  const fatPct = fatPctRaw ?? (weight && fatMassRaw ? r((fatMassRaw / weight) * 100, 1) : null);
  const fatMass = fatMassRaw ?? (weight && fatPctRaw ? r((weight * fatPctRaw) / 100, 1) : null);
  const leanMass = num(data["bia_mlg"]) ?? (weight && fatMass !== null ? r(weight - fatMass, 1) : null);
  const musclePctRaw = num(data["bia_musculo_pct"]);
  const muscleRaw = num(data["bia_musculo"]);
  const musclePct = musclePctRaw ?? (weight && muscleRaw ? r((muscleRaw / weight) * 100, 1) : null);
  const muscleMass = muscleRaw ?? (weight && musclePctRaw ? r((weight * musclePctRaw) / 100, 1) : null);
  const visceral = num(data["bia_visceral"]);
  const metabolicAge = num(data["bia_idade_metabolica"]);

  const anthro = analyzeAnthropometry({ ...data, composition_method: "skinfolds" }, { age, sex: patient.sex }, (data["formula"] as any) || "pollock3");
  const biaBone = num(data["bia_peso_osseo"]);
  const boneWeight = biaBone ?? anthro.boneMass;
  const boneWeightSource = biaBone !== null ? "bioimpedance" : anthro.boneMass !== null ? "diameters" : null;

  const hydrationMeasured = num(data["bia_agua"]);
  const hydration = hydrationMeasured ?? (sex !== null && age !== null && weight && height
    ? r(male ? 2.447 - 0.09156 * age + 0.1074 * height + 0.3362 * weight : -2.097 + 0.1069 * height + 0.2466 * weight, 1)
    : null);
  const bmr = leanMass !== null ? Math.round(370 + 21.6 * leanMass) : null;
  const fatExcess = fatMass !== null && weight ? r(fatMass - (male ? 0.2 : 0.28) * weight, 1) : null;
  const cmb = arm && triceps ? r(arm - (Math.PI * triceps) / 10, 1) : null;
  const cmbPct = cmb !== null && sex !== null ? r((cmb / cmbReference(male)) * 100, 1) : null;
  const amb = cmb !== null && sex !== null ? r(cmb ** 2 / (4 * Math.PI) - (male ? 10 : 6.5), 1) : null;

  return {
    weight,
    weightEstimated: data["weight_source"] === "estimated_chumlea",
    height,
    bmi,
    bmiClass: bmi !== null ? bmiClass(bmi, age) : null,
    waist,
    hip,
    abdomen,
    arm,
    whr,
    whrClass: whr !== null && sex !== null ? whrRiskClass(whr, male, age) : null,
    fatPct,
    fatClass: fatPct !== null && sex !== null ? bodyFatClass(fatPct, male, age) : null,
    fatMass,
    fatExcess: fatExcess !== null && fatExcess > 0 ? fatExcess : null,
    musclePct,
    muscleMass,
    leanMass,
    visceral,
    visceralClass: visceral !== null ? visceralFatClass(visceral, selectedVisceralScale(data)) : null,
    metabolicAge,
    boneWeight,
    boneWeightSource,
    hydration,
    hydrationDescriptive: hydrationMeasured === null && (bmi ?? 0) >= 30,
    bmr,
    cmb,
    cmbClass: cmbPct !== null ? `${cmbClassification(cmbPct)} · ${cmbPct}% do padrão` : null,
    amb,
    score: compositionScore({ fatPct, musclePct, metabolicAge, age, visceral, whr, male }),
    male,
  };
}

const n = (value: number | null, unit: string, digits = 1) =>
  value === null ? "—" : `${value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}${unit ? ` ${unit}` : ""}`;

export function biaRows(m: ParecerMetrics): ParecerRow[] {
  const rows: ParecerRow[] = [];
  if (m.fatPct !== null) rows.push({ label: "% Gordura corporal", value: n(m.fatPct, "%"), reference: m.fatClass ?? "", tone: "atencao" });
  if (m.fatMass !== null) rows.push({ label: "Massa de gordura", value: n(m.fatMass, "kg"), reference: m.fatExcess !== null ? `Excesso estimado: ${n(m.fatExcess, "kg")} acima da faixa de referência` : "Acompanhar evolução" });
  if (m.musclePct !== null) rows.push({ label: "% Massa muscular", value: n(m.musclePct, "%"), reference: m.male ? "Referência masculina: 38-44%" : "Referência feminina: 30-35%" });
  if (m.muscleMass !== null) rows.push({ label: "Massa muscular", value: n(m.muscleMass, "kg"), reference: "Parâmetro de acompanhamento prioritário" });
  if (m.leanMass !== null) rows.push({ label: "Massa livre de gordura", value: n(m.leanMass, "kg"), reference: "Composta por músculo, osso e água corporais" });
  if (m.visceral !== null) rows.push({ label: "Índice de gordura visceral", value: `IGV ${m.visceral}`, reference: m.visceralClass ?? "" });
  if (m.metabolicAge !== null) rows.push({ label: "Idade metabólica", value: `${m.metabolicAge} anos`, reference: "Valor informado pelo equipamento" });
  if (m.boneWeight !== null) rows.push({ label: m.boneWeightSource === "diameters" ? "Peso ósseo (calculado)" : "Peso ósseo", value: n(m.boneWeight, "kg"), reference: m.boneWeightSource === "diameters" ? "Calculado a partir de estatura e diâmetros ósseos" : "Valor informado pelo equipamento", calculated: m.boneWeightSource === "diameters" });
  if (m.hydration !== null) rows.push({ label: "Hidratação corporal total", value: n(m.hydration, "L"), reference: m.hydrationDescriptive ? "Estimativa via Watson · interpretar com cautela em IMC elevado" : "Valor informado ou estimativa clínica validada", calculated: true });
  if (m.bmr !== null) rows.push({ label: "Taxa metabólica basal (calculada)", value: `${m.bmr} kcal/dia`, reference: "Estimativa de gasto energético em repouso", calculated: true });
  if (m.cmb !== null) rows.push({ label: "Circunf. muscular do braço (CMB)", value: n(m.cmb, "cm"), reference: m.cmbClass ?? "", calculated: true });
  if (m.amb !== null) rows.push({ label: "Área muscular do braço (AMB)", value: `${n(m.amb, "")} cm²`, reference: "Medida complementar · cruzar com CMB na evolução", calculated: true });
  return rows;
}

export function circumferenceRows(m: ParecerMetrics): ParecerRow[] {
  const limit = m.male ? { waist: 94, abdomen: 102, whr: 0.9 } : { waist: 80, abdomen: 88, whr: 0.8 };
  const rows: ParecerRow[] = [];
  if (m.waist !== null) rows.push({ label: "Cintura", value: n(m.waist, "cm", 0), reference: `Limite: ${limit.waist} cm`, tone: m.waist >= limit.waist ? "alto" : "ok" });
  if (m.abdomen !== null) rows.push({ label: "Abdômen", value: n(m.abdomen, "cm", 0), reference: `Limite: ${limit.abdomen} cm`, tone: m.abdomen >= limit.abdomen ? "alto" : "ok" });
  if (m.hip !== null) rows.push({ label: "Quadril", value: n(m.hip, "cm", 0), reference: "Referência relativa", tone: "neutro" });
  if (m.arm !== null) rows.push({ label: "Braço relaxado", value: n(m.arm, "cm", 0), reference: m.cmb !== null ? `CMB calculada: ${n(m.cmb, "cm")}` : "Base para cálculo de CMB", tone: "neutro" });
  if (m.whr !== null) rows.push({ label: "RCQ (cintura/quadril)", value: m.whr.toLocaleString("pt-BR", { minimumFractionDigits: 2 }), reference: `Limite: ${limit.whr.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`, tone: m.whr >= limit.whr ? "alto" : "ok" });
  return rows;
}

export function compositionGauges(m: ParecerMetrics): ParecerGauge[] {
  const gauges: ParecerGauge[] = [];
  if (m.fatPct !== null) gauges.push({ label: "% Gordura corporal", value: m.fatPct, display: n(m.fatPct, "%"), min: 10, max: 60, refMin: m.male ? 12 : 22, refMax: m.male ? 20 : 28 });
  if (m.muscleMass !== null) gauges.push({ label: "Massa muscular (kg)", value: m.muscleMass, display: n(m.muscleMass, "kg"), min: 10, max: 60, refMin: m.male ? 30 : 20, refMax: m.male ? 42 : 30 });
  if (m.visceral !== null) gauges.push({ label: "Gordura visceral (IGV)", value: m.visceral, display: `IGV ${m.visceral}`, min: 1, max: 30, refMin: 1, refMax: 6.99 });
  if (m.hydration !== null) gauges.push({ label: "Hidratação corporal (L)", value: m.hydration, display: n(m.hydration, "L"), min: 15, max: 60, refMin: m.male ? 35 : 27, refMax: m.male ? 45 : 37 });
  return gauges;
}

export function metricsToPrompt(m: ParecerMetrics, patient: ParecerPatient) {
  return [
    `Paciente: ${patient.name}`,
    `Idade: ${patient.age ?? "não informada"}`,
    `Sexo biológico: ${biologicalSex(patient.sex) === "male" ? "masculino" : biologicalSex(patient.sex) === "female" ? "feminino" : "não informado"}`,
    `Fase: ${patient.phase}`,
    `Peso: ${n(m.weight, "kg")}${m.weightEstimated ? " (ESTIMADO por Chumlea; não aferido)" : ""} · Altura: ${n(m.height, "cm", 0)} · IMC: ${n(m.bmi, "")} (${m.bmiClass ?? "—"})`,
    `Cintura: ${n(m.waist, "cm", 0)} · Abdômen: ${n(m.abdomen, "cm", 0)} · Quadril: ${n(m.hip, "cm", 0)} · RCQ: ${m.whr ?? "—"} (${m.whrClass ?? "—"})`,
    `% gordura: ${n(m.fatPct, "%")} (${m.fatClass ?? "—"}) · massa gorda: ${n(m.fatMass, "kg")}`,
    `% músculo: ${n(m.musclePct, "%")} · massa muscular: ${n(m.muscleMass, "kg")} · MLG: ${n(m.leanMass, "kg")}`,
    `IGV: ${m.visceral ?? "—"} (${m.visceralClass ?? "—"}) · idade metabólica: ${m.metabolicAge ?? "—"}`,
    `Peso ósseo: ${n(m.boneWeight, "kg")} (${m.boneWeightSource ?? "não disponível"}) · hidratação: ${n(m.hydration, "L")} · TMB: ${m.bmr ?? "—"} kcal`,
    `CMB: ${n(m.cmb, "cm")} (${m.cmbClass ?? "—"}) · AMB: ${n(m.amb, "cm²")}`,
    `Score de composição corporal: ${m.score}/100`,
  ].join("\n");
}

export interface ParecerTexts {
  interpretacao_1: string;
  interpretacao_2: string;
  prioridades: { titulo: string; texto: string }[];
  metas: { parametro: string; atual: string; meta_60_90: string; meta_final: string }[];
  nota_metas: string;
}

export interface ParecerDocument {
  patient: ParecerPatient;
  metrics: ParecerMetrics;
  texts: ParecerTexts;
  generatedAt: string;
}
