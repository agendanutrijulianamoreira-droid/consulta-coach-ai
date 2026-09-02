/**
 * Domínio puro da avaliação antropométrica do Cach AI.
 *
 * Princípios:
 * - nunca inventar idade/sexo para satisfazer uma fórmula;
 * - diferenciar medida informada de valor derivado;
 * - não misturar dobras e bioimpedância sem escolha explícita;
 * - não estimar composição corporal por atalhos sem base selecionada;
 * - devolver avisos de qualidade de dados em vez de produzir números frágeis.
 */

export type AnthroData = Record<string, string | undefined>;
export type CompositionMethod = "skinfolds" | "bioimpedance";
export type VisceralScale = "omron" | "tanita";
export type BiologicalSex = "male" | "female" | null;

export interface PatientProfile {
  age: number | null;
  sex: string | null;
}

export interface AnthroField {
  key: string;
  label: string;
  min?: number;
  max?: number;
  unit?: string;
}

export interface AnthroSection {
  id: string;
  title: string;
  hint?: string;
  fields: AnthroField[];
}

export interface AnthroIssue {
  field?: string;
  severity: "warning" | "error";
  message: string;
}

export const ANTHRO_SECTIONS: AnthroSection[] = [
  {
    id: "basicos",
    title: "Dados antropométricos básicos",
    fields: [
      { key: "peso", label: "Peso (kg)", min: 20, max: 350, unit: "kg" },
      { key: "altura", label: "Altura (cm)", min: 100, max: 230, unit: "cm" },
      { key: "altura_sentado", label: "Altura sentado (cm)", min: 40, max: 140, unit: "cm" },
      { key: "altura_joelho", label: "Altura do joelho (cm)", min: 25, max: 80, unit: "cm" },
    ],
  },
  {
    id: "dobras",
    title: "Dobras cutâneas (mm)",
    hint: "Use a fórmula compatível com sexo biológico, idade e pontos medidos.",
    fields: [
      { key: "d_tricipital", label: "Tricipital", min: 1, max: 80, unit: "mm" },
      { key: "d_bicipital", label: "Bicipital", min: 1, max: 70, unit: "mm" },
      { key: "d_abdominal", label: "Abdominal", min: 1, max: 100, unit: "mm" },
      { key: "d_subescapular", label: "Subescapular", min: 1, max: 80, unit: "mm" },
      { key: "d_axilar_media", label: "Axilar média", min: 1, max: 80, unit: "mm" },
      { key: "d_coxa", label: "Coxa", min: 1, max: 90, unit: "mm" },
      { key: "d_toracica", label: "Torácica / peitoral", min: 1, max: 80, unit: "mm" },
      { key: "d_suprailiaca", label: "Supra-ilíaca", min: 1, max: 80, unit: "mm" },
      { key: "d_panturrilha", label: "Panturrilha medial", min: 1, max: 70, unit: "mm" },
      { key: "d_supraespinhal", label: "Supraespinhal", min: 1, max: 70, unit: "mm" },
    ],
  },
  {
    id: "circunferencias",
    title: "Circunferências corporais (cm)",
    hint: "Cintura e quadril alimentam os indicadores cardiometabólicos; braço + dobra tricipital alimentam CMB/AMB.",
    fields: [
      { key: "c_pescoco", label: "Pescoço", min: 20, max: 80, unit: "cm" },
      { key: "c_torax", label: "Tórax", min: 40, max: 220, unit: "cm" },
      { key: "c_ombro", label: "Ombro", min: 50, max: 220, unit: "cm" },
      { key: "c_cintura", label: "Cintura", min: 35, max: 220, unit: "cm" },
      { key: "c_quadril", label: "Quadril", min: 45, max: 240, unit: "cm" },
      { key: "c_abdomen", label: "Abdômen", min: 35, max: 240, unit: "cm" },
      { key: "c_braco_relaxado", label: "Braço relaxado", min: 10, max: 80, unit: "cm" },
      { key: "c_braco_contraido", label: "Braço contraído", min: 10, max: 85, unit: "cm" },
      { key: "c_antebraco", label: "Antebraço", min: 10, max: 60, unit: "cm" },
      { key: "c_punho", label: "Punho", min: 8, max: 35, unit: "cm" },
      { key: "c_coxa_proximal", label: "Coxa proximal", min: 20, max: 120, unit: "cm" },
      { key: "c_coxa_medial", label: "Coxa medial", min: 20, max: 110, unit: "cm" },
      { key: "c_coxa_distal", label: "Coxa distal", min: 15, max: 90, unit: "cm" },
      { key: "c_panturrilha", label: "Panturrilha", min: 15, max: 80, unit: "cm" },
    ],
  },
  {
    id: "diametros",
    title: "Diâmetros ósseos (cm)",
    hint: "Use somente quando a técnica de composição corporal escolhida exigir esses dados.",
    fields: [
      { key: "dia_umero", label: "Diâmetro do úmero", min: 3, max: 12, unit: "cm" },
      { key: "dia_punho", label: "Diâmetro do punho", min: 3, max: 10, unit: "cm" },
      { key: "dia_femur", label: "Diâmetro do fêmur", min: 5, max: 16, unit: "cm" },
    ],
  },
  {
    id: "bioimpedancia",
    title: "Bioimpedância",
    hint: "Transcreva os valores exatamente como aparecem no equipamento; o sistema deriva apenas relações matemáticas seguras.",
    fields: [
      { key: "bia_gordura_pct", label: "% de gordura", min: 1, max: 75, unit: "%" },
      { key: "bia_massa_gorda", label: "Massa gorda (kg)", min: 1, max: 250, unit: "kg" },
      { key: "bia_musculo_pct", label: "% de massa muscular", min: 5, max: 70, unit: "%" },
      { key: "bia_musculo", label: "Massa muscular (kg)", min: 5, max: 180, unit: "kg" },
      { key: "bia_mlg", label: "Massa livre de gordura (kg)", min: 5, max: 250, unit: "kg" },
      { key: "bia_peso_osseo", label: "Peso ósseo (kg)", min: 0.5, max: 12, unit: "kg" },
      { key: "bia_visceral", label: "Gordura visceral (índice)", min: 1, max: 59 },
      { key: "bia_agua", label: "Água corporal", min: 5, max: 150, unit: "L" },
      { key: "bia_idade_metabolica", label: "Idade metabólica (anos)", min: 10, max: 100, unit: "anos" },
    ],
  },
];

export const SKINFOLD_FORMULAS = ["pollock3", "pollock7", "petroski", "guedes", "durnin", "faulkner"] as const;
export type SkinfoldFormula = (typeof SKINFOLD_FORMULAS)[number];

export const SKINFOLD_FORMULA_LABELS: Record<SkinfoldFormula, string> = {
  pollock3: "Pollock 3",
  pollock7: "Pollock 7",
  petroski: "Petroski",
  guedes: "Guedes",
  durnin: "Durnin & Womersley",
  faulkner: "Faulkner",
};

export function num(value: string | undefined | null): number | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const parsed = Number(String(value).replace(",", ".").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function biologicalSex(sex: string | null | undefined): BiologicalSex {
  const normalized = (sex ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.startsWith("m") || normalized.includes("mascul")) return "male";
  if (normalized.startsWith("f") || normalized.includes("femin")) return "female";
  return null;
}

/** Mantido por compatibilidade. Nunca use isoladamente quando sexo ausente puder invalidar um cálculo. */
export function isMale(sex: string | null | undefined) {
  return biologicalSex(sex) === "male";
}

export function selectedCompositionMethod(data: AnthroData): CompositionMethod {
  if (data["composition_method"] === "bioimpedance") return "bioimpedance";
  if (data["composition_method"] === "skinfolds") return "skinfolds";
  const hasBia = num(data["bia_gordura_pct"]) !== null || num(data["bia_massa_gorda"]) !== null || num(data["bia_mlg"]) !== null;
  return hasBia ? "bioimpedance" : "skinfolds";
}

export function selectedVisceralScale(data: AnthroData): VisceralScale {
  return data["visceral_scale"] === "tanita" ? "tanita" : "omron";
}

export function requiredSkinfolds(formula: SkinfoldFormula, male: boolean): string[] {
  switch (formula) {
    case "pollock3":
      return male ? ["d_toracica", "d_abdominal", "d_coxa"] : ["d_tricipital", "d_suprailiaca", "d_coxa"];
    case "pollock7":
      return ["d_toracica", "d_axilar_media", "d_tricipital", "d_subescapular", "d_abdominal", "d_suprailiaca", "d_coxa"];
    case "petroski":
      return ["d_subescapular", "d_tricipital", "d_suprailiaca", "d_panturrilha"];
    case "guedes":
      return male ? ["d_tricipital", "d_suprailiaca", "d_abdominal"] : ["d_coxa", "d_suprailiaca", "d_subescapular"];
    case "durnin":
      return ["d_bicipital", "d_tricipital", "d_subescapular", "d_suprailiaca"];
    case "faulkner":
      return ["d_tricipital", "d_subescapular", "d_suprailiaca", "d_abdominal"];
  }
}

function formulaNeedsAge(formula: SkinfoldFormula) {
  return formula === "pollock3" || formula === "pollock7" || formula === "petroski" || formula === "durnin";
}

function formulaNeedsSex(formula: SkinfoldFormula) {
  return formula !== "faulkner";
}

export function skinfoldEligibility(data: AnthroData, profile: PatientProfile, formula: SkinfoldFormula) {
  const sex = biologicalSex(profile.sex);
  const missing: string[] = [];
  if (formulaNeedsSex(formula) && sex === null) missing.push("sexo biológico no cadastro");
  if (formulaNeedsAge(formula) && profile.age === null) missing.push("data de nascimento/idade");
  const required = requiredSkinfolds(formula, sex === "male");
  const missingFolds = required.filter((key) => num(data[key]) === null);
  if (missingFolds.length) missing.push(`${missingFolds.length} dobra${missingFolds.length === 1 ? "" : "s"} obrigatória${missingFolds.length === 1 ? "" : "s"}`);
  return { eligible: missing.length === 0, missing, required };
}

export function validateAnthropometry(data: AnthroData, profile?: PatientProfile): AnthroIssue[] {
  const issues: AnthroIssue[] = [];
  const definitions = ANTHRO_SECTIONS.flatMap((section) => section.fields);
  for (const field of definitions) {
    const raw = data[field.key];
    if (raw === undefined || raw === null || raw.trim() === "") continue;
    const value = num(raw);
    if (value === null) {
      issues.push({ field: field.key, severity: "error", message: `${field.label}: valor inválido.` });
      continue;
    }
    if (field.min !== undefined && value < field.min) issues.push({ field: field.key, severity: "warning", message: `${field.label}: confira o valor informado (${value}${field.unit ? ` ${field.unit}` : ""}).` });
    if (field.max !== undefined && value > field.max) issues.push({ field: field.key, severity: "warning", message: `${field.label}: confira o valor informado (${value}${field.unit ? ` ${field.unit}` : ""}).` });
  }

  const weight = num(data["peso"]);
  const fatMass = num(data["bia_massa_gorda"]);
  const leanMass = num(data["bia_mlg"]);
  const muscle = num(data["bia_musculo"]);
  if (weight !== null && fatMass !== null && fatMass >= weight) issues.push({ field: "bia_massa_gorda", severity: "error", message: "Massa gorda não pode ser igual ou maior que o peso corporal." });
  if (weight !== null && leanMass !== null && leanMass > weight) issues.push({ field: "bia_mlg", severity: "error", message: "Massa livre de gordura não pode ser maior que o peso corporal." });
  if (weight !== null && muscle !== null && muscle > weight) issues.push({ field: "bia_musculo", severity: "error", message: "Massa muscular não pode ser maior que o peso corporal." });

  if (profile && biologicalSex(profile.sex) === null) issues.push({ severity: "warning", message: "Sexo biológico não informado/reconhecido: classificações e fórmulas dependentes de sexo ficam bloqueadas." });
  return issues;
}

export function bmiClass(bmi: number, age: number | null = null): string {
  if (age !== null && age >= 60) {
    if (bmi < 22) return "Magreza (Lipschitz, idoso)";
    if (bmi <= 27) return "Eutrofia (Lipschitz, idoso)";
    return "Excesso de peso (Lipschitz, idoso)";
  }
  if (bmi < 16) return "Magreza grau III (OMS)";
  if (bmi < 17) return "Magreza grau II (OMS)";
  if (bmi < 18.5) return "Magreza grau I (OMS)";
  if (bmi < 25) return "Eutrofia (OMS)";
  if (bmi < 30) return "Sobrepeso (OMS)";
  if (bmi < 35) return "Obesidade grau I (OMS)";
  if (bmi < 40) return "Obesidade grau II (OMS)";
  return "Obesidade grau III (OMS)";
}

export function bodyFatClass(percent: number, male: boolean, age: number | null = null): string {
  if (age === null) return "Classificação depende da idade";
  const band = age < 40 ? 0 : age < 60 ? 1 : 2;
  const table: Record<"m" | "f", number[][]> = {
    m: [[8, 20, 25], [11, 22, 28], [13, 25, 30]],
    f: [[21, 33, 39], [23, 34, 40], [24, 36, 42]],
  };
  const [low, high, obese] = table[male ? "m" : "f"][band]!;
  const ref = `Gallagher, ${age < 40 ? "20-39" : age < 60 ? "40-59" : "60-79"} anos`;
  if (percent < low!) return `Abaixo do recomendado (${ref})`;
  if (percent < high!) return `Adequado (${ref})`;
  if (percent < obese!) return `Acima do ideal (${ref})`;
  return `Obesidade por adiposidade (${ref})`;
}

export function whrRiskClass(whr: number, male: boolean, age: number | null = null): string {
  if (age === null) return "Classificação depende da idade";
  const cuts = male
    ? [[29, 0.94], [39, 0.96], [49, 1], [59, 1.02], [200, 1.03]]
    : [[29, 0.82], [39, 0.84], [49, 0.88], [59, 0.9], [200, 0.91]];
  const cut = (cuts.find(([limit]) => age <= limit!) ?? cuts[cuts.length - 1]!)[1]!;
  const band = age < 30 ? "20-29" : age < 40 ? "30-39" : age < 50 ? "40-49" : age < 60 ? "50-59" : "60+";
  return whr >= cut ? `Risco alto (≥ ${cut} · ${band} anos)` : whr >= cut - 0.06 ? `Risco moderado (corte ${cut} · ${band} anos)` : `Risco baixo (corte ${cut} · ${band} anos)`;
}

function frisanchoP50(age: number | null, male: boolean): { cmb: number; amb: number } | null {
  if (age === null) return null;
  const rows: [number, number, number][] = male
    ? [[24, 27.9, 54.5], [34, 28.6, 58.3], [44, 28.7, 58.8], [54, 28.1, 56.9], [64, 27.8, 55.4], [200, 26.8, 52]]
    : [[24, 21.2, 30.9], [34, 21.8, 32.8], [44, 22, 33.5], [54, 22.5, 35.1], [64, 22.5, 35.4], [200, 22.5, 34.7]];
  const row = rows.find(([limit]) => age <= limit) ?? rows[rows.length - 1]!;
  return { cmb: row[1], amb: row[2] };
}

function adequacyClass(measured: number, reference: number) {
  const percent = round((measured / reference) * 100, 1);
  const label = percent >= 110 ? "Acima da referência" : percent >= 90 ? "Eutrofia" : percent >= 80 ? "Depleção leve" : percent >= 70 ? "Depleção moderada" : "Depleção grave";
  return { percent, label };
}

export function visceralFatClass(value: number, scale: VisceralScale = "omron"): string {
  if (scale === "omron") {
    if (value < 1 || value > 30) return "Fora da escala Omron (1-30)";
    if (value < 7) return "Normal (1-6,99 · Omron)";
    if (value < 10) return "Aumentado (7-9,99 · Omron)";
    if (value <= 12) return "Alto (10-12 · Omron)";
    return "Muito alto (13-30 · Omron)";
  }
  if (value <= 9) return "Saudável (1-9 · Tanita)";
  if (value <= 14) return "Elevado (10-14 · Tanita)";
  return "Muito elevado (≥ 15 · Tanita)";
}

function siri(density: number) {
  return 495 / density - 450;
}

function sum(data: AnthroData, keys: string[]): number | null {
  let total = 0;
  for (const key of keys) {
    const value = num(data[key]);
    if (value === null || value <= 0) return null;
    total += value;
  }
  return total;
}

function durninConstants(age: number, male: boolean) {
  if (male) {
    if (age < 20) return { c: 1.162, m: 0.063 };
    if (age < 30) return { c: 1.1631, m: 0.0632 };
    if (age < 40) return { c: 1.1422, m: 0.0544 };
    if (age < 50) return { c: 1.162, m: 0.07 };
    return { c: 1.1715, m: 0.0779 };
  }
  if (age < 20) return { c: 1.1549, m: 0.0678 };
  if (age < 30) return { c: 1.1599, m: 0.0717 };
  if (age < 40) return { c: 1.1423, m: 0.0632 };
  if (age < 50) return { c: 1.1333, m: 0.0612 };
  return { c: 1.1339, m: 0.0645 };
}

export function bodyFatByFormula(data: AnthroData, profile: PatientProfile, formula: SkinfoldFormula): { percent: number; density: number | null } | null {
  const sex = biologicalSex(profile.sex);
  const eligibility = skinfoldEligibility(data, profile, formula);
  if (!eligibility.eligible) return null;
  const male = sex === "male";
  const age = profile.age;
  const total = sum(data, eligibility.required);
  if (total === null) return null;

  let density: number | null = null;
  let percent: number | null = null;
  switch (formula) {
    case "pollock3":
      if (age === null) return null;
      density = male ? 1.10938 - 0.0008267 * total + 0.0000016 * total ** 2 - 0.0002574 * age : 1.0994921 - 0.0009929 * total + 0.0000023 * total ** 2 - 0.0001392 * age;
      break;
    case "pollock7":
      if (age === null) return null;
      density = male ? 1.112 - 0.00043499 * total + 0.00000055 * total ** 2 - 0.00028826 * age : 1.097 - 0.00046971 * total + 0.00000056 * total ** 2 - 0.00012828 * age;
      break;
    case "petroski":
      if (age === null) return null;
      density = male ? 1.10726863 - 0.00081201 * total + 0.00000212 * total ** 2 - 0.00041761 * age : 1.1954713 - 0.07513507 * Math.log10(total) - 0.00041072 * age;
      break;
    case "guedes":
      density = male ? 1.1714 - 0.0671 * Math.log10(total) : 1.1665 - 0.0706 * Math.log10(total);
      break;
    case "durnin": {
      if (age === null) return null;
      const constants = durninConstants(age, male);
      density = constants.c - constants.m * Math.log10(total);
      break;
    }
    case "faulkner":
      percent = total * 0.153 + 5.783;
      break;
  }

  if (percent === null && density !== null) percent = siri(density);
  if (percent === null || !Number.isFinite(percent) || percent <= 0 || percent >= 80) return null;
  return { percent: round(percent, 1), density: density === null ? null : round(density, 4) };
}

export interface AnthroResult {
  label: string;
  value: string;
  detail?: string;
  source?: "measured" | "derived" | "calculated";
}

export interface AnthroAnalysis {
  bmi: number | null;
  bodyFatPercent: number | null;
  fatMass: number | null;
  leanMass: number | null;
  muscleMass: number | null;
  boneMass: number | null;
  residualMass: number | null;
  totalWater: number | null;
  whr: number | null;
  amb: number | null;
  cmb: number | null;
  idealWeightRange: [number, number] | null;
  compositionMethod: CompositionMethod;
  issues: AnthroIssue[];
  groups: { title: string; results: AnthroResult[] }[];
}

const dash = "—";
const fmt = (value: number | null, unit = "", decimals = 1) => value === null ? dash : `${round(value, decimals).toLocaleString("pt-BR")}${unit ? ` ${unit}` : ""}`;

export function analyzeAnthropometry(data: AnthroData, profile: PatientProfile, formula: SkinfoldFormula = "pollock3"): AnthroAnalysis {
  const sex = biologicalSex(profile.sex);
  const male = sex === "male";
  const weight = num(data["peso"]);
  const heightCm = num(data["altura"]);
  const height = heightCm && heightCm > 0 ? heightCm / 100 : null;
  const bmi = weight && weight > 0 && height ? weight / height ** 2 : null;
  const idealWeightRange: [number, number] | null = height ? [round(18.5 * height ** 2, 1), round(24.9 * height ** 2, 1)] : null;

  const waist = num(data["c_cintura"]);
  const hip = num(data["c_quadril"]);
  const abdomen = num(data["c_abdomen"]);
  const whr = waist && hip && hip > 0 ? round(waist / hip, 2) : null;

  const arm = num(data["c_braco_relaxado"]);
  const triceps = num(data["d_tricipital"]);
  const cmb = arm && triceps ? round(arm - Math.PI * (triceps / 10), 1) : null;
  const amb = cmb && sex !== null ? round((cmb ** 2) / (4 * Math.PI) - (male ? 10 : 6.5), 1) : null;
  const reference = sex === null ? null : frisanchoP50(profile.age, male);
  const cmbAdequacy = cmb && reference ? adequacyClass(cmb, reference.cmb) : null;
  const ambAdequacy = amb && amb > 0 && reference ? adequacyClass(amb, reference.amb) : null;

  const skinfold = bodyFatByFormula(data, profile, formula);
  const biaFatRaw = num(data["bia_gordura_pct"]);
  const biaFatMassRaw = num(data["bia_massa_gorda"]);
  const biaFat = biaFatRaw ?? (weight && biaFatMassRaw ? round((biaFatMassRaw / weight) * 100, 1) : null);
  const biaFatMass = biaFatMassRaw ?? (weight && biaFat !== null ? round((weight * biaFat) / 100, 1) : null);
  const biaLeanMassRaw = num(data["bia_mlg"]);
  const biaLeanMass = biaLeanMassRaw ?? (weight && biaFatMass !== null ? round(weight - biaFatMass, 1) : null);
  const biaMuscleRaw = num(data["bia_musculo"]);
  const biaMusclePctRaw = num(data["bia_musculo_pct"]);
  const biaMusclePct = biaMusclePctRaw ?? (weight && biaMuscleRaw ? round((biaMuscleRaw / weight) * 100, 1) : null);
  const biaMuscle = biaMuscleRaw ?? (weight && biaMusclePctRaw ? round((weight * biaMusclePctRaw) / 100, 1) : null);

  const compositionMethod = selectedCompositionMethod(data);
  const bodyFatPercent = compositionMethod === "bioimpedance" ? biaFat : skinfold?.percent ?? null;
  const fatMass = compositionMethod === "bioimpedance" ? biaFatMass : weight && skinfold ? round((weight * skinfold.percent) / 100, 1) : null;
  const leanMass = compositionMethod === "bioimpedance" ? biaLeanMass : weight && fatMass !== null ? round(weight - fatMass, 1) : null;

  const wrist = num(data["dia_punho"]);
  const femur = num(data["dia_femur"]);
  const boneMassCalculated = height && wrist && femur ? round(3.02 * Math.pow(height ** 2 * (wrist / 100) * (femur / 100) * 400, 0.712), 1) : null;
  const boneMass = compositionMethod === "bioimpedance" ? num(data["bia_peso_osseo"]) : boneMassCalculated;
  const residualMass = weight && sex !== null ? round(weight * (male ? 0.241 : 0.209), 1) : null;
  const muscleMass = compositionMethod === "bioimpedance"
    ? biaMuscle
    : weight && fatMass !== null && boneMass !== null && residualMass !== null
      ? round(weight - fatMass - boneMass - residualMass, 1)
      : null;

  const totalWaterCalculated = weight && heightCm && profile.age !== null && sex !== null
    ? round(male ? 2.447 - 0.09156 * profile.age + 0.1074 * heightCm + 0.3362 * weight : -2.097 + 0.1069 * heightCm + 0.2466 * weight, 1)
    : null;
  const totalWater = compositionMethod === "bioimpedance" ? num(data["bia_agua"]) : totalWaterCalculated;

  const visceral = num(data["bia_visceral"]);
  const visceralScale = selectedVisceralScale(data);
  const issues = validateAnthropometry(data, profile);
  const eligibility = skinfoldEligibility(data, profile, formula);
  if (compositionMethod === "skinfolds" && !eligibility.eligible) issues.push({ severity: "warning", message: `Dobras: cálculo indisponível — falta ${eligibility.missing.join(", ")}.` });
  if (compositionMethod === "bioimpedance" && biaFat === null && biaLeanMass === null) issues.push({ severity: "warning", message: "Bioimpedância selecionada, mas ainda não há composição corporal suficiente informada." });

  const waistDetail = waist && sex !== null
    ? waist >= (male ? 102 : 88) ? `Risco muito aumentado (≥ ${male ? 102 : 88} cm · OMS)` : waist >= (male ? 94 : 80) ? `Risco aumentado (≥ ${male ? 94 : 80} cm · OMS)` : `Abaixo do ponto de corte de risco aumentado (< ${male ? 94 : 80} cm · OMS)`
    : undefined;

  const groups: AnthroAnalysis["groups"] = [
    {
      title: "Pesos e medidas",
      results: [
        { label: "Peso atual", value: fmt(weight, "kg"), source: weight === null ? undefined : "measured" },
        { label: "Altura atual", value: fmt(heightCm, "cm", 0), source: heightCm === null ? undefined : "measured" },
        { label: "Índice de Massa Corporal", value: fmt(bmi, "kg/m²"), detail: bmi ? bmiClass(bmi, profile.age) : undefined, source: bmi === null ? undefined : "calculated" },
        { label: "Faixa de peso pelo IMC 18,5-24,9", value: idealWeightRange ? `${idealWeightRange[0]} a ${idealWeightRange[1]} kg` : dash, source: idealWeightRange ? "calculated" : undefined },
        { label: "Relação cintura/quadril (RCQ)", value: fmt(whr, "", 2), detail: whr && sex !== null ? whrRiskClass(whr, male, profile.age) : whr ? "Classificação depende de sexo biológico e idade" : undefined, source: whr === null ? undefined : "calculated" },
        { label: "Circunferência da cintura", value: fmt(waist, "cm"), detail: waistDetail, source: waist === null ? undefined : "measured" },
        { label: "Circunferência abdominal", value: fmt(abdomen, "cm"), source: abdomen === null ? undefined : "measured" },
        { label: "Circunferência muscular do braço (CMB)", value: fmt(cmb, "cm"), detail: cmbAdequacy && reference ? `${cmbAdequacy.percent}% do P50 (${reference.cmb} cm · Frisancho) · ${cmbAdequacy.label}` : cmb ? "Classificação depende de idade e sexo biológico" : undefined, source: cmb === null ? undefined : "calculated" },
        { label: "Área muscular do braço (AMB)", value: fmt(amb, "cm²"), detail: ambAdequacy && reference ? `${ambAdequacy.percent}% do P50 (${reference.amb} cm² · Frisancho) · ${ambAdequacy.label}` : undefined, source: amb === null ? undefined : "calculated" },
      ],
    },
    {
      title: "Dobras cutâneas",
      results: [
        { label: "Método", value: SKINFOLD_FORMULA_LABELS[formula], detail: eligibility.eligible ? "Dados suficientes para cálculo" : `Falta: ${eligibility.missing.join(", ")}` },
        { label: "Percentual de gordura", value: fmt(skinfold?.percent ?? null, "%"), detail: skinfold && sex !== null ? bodyFatClass(skinfold.percent, male, profile.age) : undefined, source: skinfold ? "calculated" : undefined },
        { label: "Densidade corporal", value: skinfold?.density ? String(skinfold.density) : dash, source: skinfold?.density ? "calculated" : undefined },
        { label: "Somatório das dobras da fórmula", value: fmt(sum(data, eligibility.required), "mm"), source: sum(data, eligibility.required) === null ? undefined : "calculated" },
        { label: "Massa gorda", value: compositionMethod === "skinfolds" ? fmt(fatMass, "kg") : dash, detail: compositionMethod === "skinfolds" ? "Derivada do % por dobras" : "Bioimpedância selecionada como método principal", source: compositionMethod === "skinfolds" && fatMass !== null ? "derived" : undefined },
        { label: "Massa livre de gordura", value: compositionMethod === "skinfolds" ? fmt(leanMass, "kg") : dash, source: compositionMethod === "skinfolds" && leanMass !== null ? "derived" : undefined },
        { label: "Peso ósseo", value: fmt(boneMassCalculated, "kg"), detail: boneMassCalculated === null ? "Exige altura, diâmetro do punho e diâmetro do fêmur" : "Cálculo antropométrico; não usa estimativa percentual genérica", source: boneMassCalculated === null ? undefined : "calculated" },
        { label: "Massa muscular (Matiegka)", value: compositionMethod === "skinfolds" ? fmt(muscleMass, "kg") : dash, source: compositionMethod === "skinfolds" && muscleMass !== null ? "calculated" : undefined },
        { label: "Peso residual", value: fmt(residualMass, "kg"), detail: residualMass === null && weight ? "Exige sexo biológico reconhecido" : undefined, source: residualMass === null ? undefined : "calculated" },
        { label: "Água corporal total (Watson)", value: fmt(totalWaterCalculated, "L"), detail: totalWaterCalculated === null ? "Exige peso, altura, idade e sexo biológico" : undefined, source: totalWaterCalculated === null ? undefined : "calculated" },
      ],
    },
    {
      title: "Bioimpedância",
      results: [
        { label: "Percentual de gordura", value: fmt(biaFat, "%"), detail: biaFat && sex !== null ? `${bodyFatClass(biaFat, male, profile.age)}${biaFatRaw === null ? " · derivado da massa gorda" : ""}` : biaFat ? "Sem classificação por ausência de sexo/idade" : undefined, source: biaFatRaw !== null ? "measured" : biaFat !== null ? "derived" : undefined },
        { label: "Massa gorda", value: fmt(biaFatMass, "kg"), detail: biaFatMassRaw === null && biaFatMass !== null ? "Calculada a partir do % informado" : undefined, source: biaFatMassRaw !== null ? "measured" : biaFatMass !== null ? "derived" : undefined },
        { label: "Percentual de massa muscular", value: fmt(biaMusclePct, "%"), source: biaMusclePctRaw !== null ? "measured" : biaMusclePct !== null ? "derived" : undefined },
        { label: "Massa muscular", value: fmt(biaMuscle, "kg"), source: biaMuscleRaw !== null ? "measured" : biaMuscle !== null ? "derived" : undefined },
        { label: "Massa livre de gordura", value: fmt(biaLeanMass, "kg"), detail: biaLeanMassRaw === null && biaLeanMass !== null ? "Derivada de peso - massa gorda" : undefined, source: biaLeanMassRaw !== null ? "measured" : biaLeanMass !== null ? "derived" : undefined },
        { label: "Peso ósseo", value: fmt(num(data["bia_peso_osseo"]), "kg"), source: num(data["bia_peso_osseo"]) === null ? undefined : "measured" },
        { label: "Índice de gordura visceral", value: fmt(visceral, "", 1), detail: visceral ? visceralFatClass(visceral, visceralScale) : undefined, source: visceral === null ? undefined : "measured" },
        { label: "Água corporal", value: fmt(num(data["bia_agua"]), "L"), source: num(data["bia_agua"]) === null ? undefined : "measured" },
        { label: "Idade metabólica", value: fmt(num(data["bia_idade_metabolica"]), "anos", 0), source: num(data["bia_idade_metabolica"]) === null ? undefined : "measured" },
      ],
    },
  ];

  return {
    bmi: bmi === null ? null : round(bmi, 1),
    bodyFatPercent,
    fatMass,
    leanMass,
    muscleMass,
    boneMass,
    residualMass,
    totalWater,
    whr,
    amb,
    cmb,
    idealWeightRange,
    compositionMethod,
    issues,
    groups,
  };
}

export function ageFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const born = new Date(`${birthDate}T12:00:00`);
  if (Number.isNaN(born.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const month = today.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < born.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}
