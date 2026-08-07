/**
 * Domínio da avaliação antropométrica.
 *
 * Puro: recebe as medidas informadas (sempre como texto vindo do formulário) e
 * o perfil do paciente, e devolve os resultados analíticos calculados por
 * fórmulas validadas. Não conhece banco, rede nem IA.
 */

export type AnthroData = Record<string, string | undefined>;

export interface PatientProfile {
  /** Idade em anos completos. */
  age: number | null;
  /** "feminino" | "masculino" (qualquer outro valor é tratado como feminino). */
  sex: string | null;
}

export interface AnthroField {
  key: string;
  label: string;
}

export interface AnthroSection {
  id: string;
  title: string;
  hint?: string;
  fields: AnthroField[];
}

/** Estrutura do formulário de avaliação, agrupada como a nutricionista mede. */
export const ANTHRO_SECTIONS: AnthroSection[] = [
  {
    id: "basicos",
    title: "Dados antropométricos básicos",
    fields: [
      { key: "peso", label: "Peso (kg)" },
      { key: "altura", label: "Altura (cm)" },
      { key: "altura_sentado", label: "Altura sentado (cm)" },
      { key: "altura_joelho", label: "Altura do joelho (cm)" },
    ],
  },
  {
    id: "dobras",
    title: "Dobras cutâneas (mm)",
    hint: "Usadas nas fórmulas de percentual de gordura.",
    fields: [
      { key: "d_tricipital", label: "Tricipital" },
      { key: "d_bicipital", label: "Bicipital" },
      { key: "d_abdominal", label: "Abdominal" },
      { key: "d_subescapular", label: "Subescapular" },
      { key: "d_axilar_media", label: "Axilar média" },
      { key: "d_coxa", label: "Coxa" },
      { key: "d_toracica", label: "Torácica / peitoral" },
      { key: "d_suprailiaca", label: "Supra-ilíaca" },
      { key: "d_panturrilha", label: "Panturrilha medial" },
      { key: "d_supraespinhal", label: "Supraespinhal" },
    ],
  },
  {
    id: "circunferencias",
    title: "Circunferências corporais (cm)",
    hint: "Importantes para RCQ, CMB e risco metabólico.",
    fields: [
      { key: "c_pescoco", label: "Pescoço" },
      { key: "c_torax", label: "Tórax" },
      { key: "c_ombro", label: "Ombro" },
      { key: "c_cintura", label: "Cintura" },
      { key: "c_quadril", label: "Quadril" },
      { key: "c_abdomen", label: "Abdômen" },
      { key: "c_braco_relaxado", label: "Braço relaxado" },
      { key: "c_braco_contraido", label: "Braço contraído" },
      { key: "c_antebraco", label: "Antebraço" },
      { key: "c_punho", label: "Punho" },
      { key: "c_coxa_proximal", label: "Coxa proximal" },
      { key: "c_coxa_medial", label: "Coxa medial" },
      { key: "c_coxa_distal", label: "Coxa distal" },
      { key: "c_panturrilha", label: "Panturrilha" },
    ],
  },
  {
    id: "diametros",
    title: "Diâmetro ósseo (cm)",
    hint: "Necessários para peso ósseo e massa muscular (Matiegka).",
    fields: [
      { key: "dia_umero", label: "Diâmetro do úmero" },
      { key: "dia_punho", label: "Diâmetro do punho" },
      { key: "dia_femur", label: "Diâmetro do fêmur" },
    ],
  },
  {
    id: "bioimpedancia",
    title: "Balança de bioimpedância",
    hint: "Insira os dados da balança, quando houver.",
    fields: [
      { key: "bia_gordura_pct", label: "% de gordura" },
      { key: "bia_massa_gorda", label: "Massa gorda (kg)" },
      { key: "bia_musculo_pct", label: "% de massa muscular" },
      { key: "bia_musculo", label: "Massa muscular (kg)" },
      { key: "bia_mlg", label: "Massa livre de gordura (kg)" },
      { key: "bia_peso_osseo", label: "Peso ósseo (kg)" },
      { key: "bia_visceral", label: "Gordura visceral (índice)" },
      { key: "bia_agua", label: "Água corporal (L)" },
      { key: "bia_idade_metabolica", label: "Idade metabólica (anos)" },
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
  durnin: "Durnin",
  faulkner: "Faulkner",
};

/** Dobras exigidas por cada fórmula, por sexo — usado para destacar campos obrigatórios. */
export function requiredSkinfolds(formula: SkinfoldFormula, male: boolean): string[] {
  switch (formula) {
    case "pollock3":
      return male
        ? ["d_toracica", "d_abdominal", "d_coxa"]
        : ["d_tricipital", "d_suprailiaca", "d_coxa"];
    case "pollock7":
      return ["d_toracica", "d_axilar_media", "d_tricipital", "d_subescapular", "d_abdominal", "d_suprailiaca", "d_coxa"];
    case "petroski":
      return ["d_subescapular", "d_tricipital", "d_suprailiaca", "d_panturrilha"];
    case "guedes":
      return male
        ? ["d_tricipital", "d_suprailiaca", "d_abdominal"]
        : ["d_coxa", "d_suprailiaca", "d_subescapular"];
    case "durnin":
      return ["d_bicipital", "d_tricipital", "d_subescapular", "d_suprailiaca"];
    case "faulkner":
      return ["d_tricipital", "d_subescapular", "d_suprailiaca", "d_abdominal"];
  }
}

export function num(value: string | undefined | null): number | null {
  if (value === undefined || value === null) return null;
  const parsed = Number(String(value).replace(",", ".").trim());
  return Number.isFinite(parsed) && parsed !== 0 ? parsed : null;
}

function round(value: number, decimals = 1) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function isMale(sex: string | null | undefined) {
  return (sex ?? "").toLowerCase().startsWith("m");
}

/** Classificação do IMC (OMS, adultos). */
export function bmiClass(bmi: number): string {
  if (bmi < 16) return "Magreza grau III";
  if (bmi < 17) return "Magreza grau II";
  if (bmi < 18.5) return "Magreza grau I";
  if (bmi < 25) return "Eutrófico";
  if (bmi < 30) return "Sobrepeso";
  if (bmi < 35) return "Obesidade grau I";
  if (bmi < 40) return "Obesidade grau II";
  return "Obesidade grau III";
}

/** Classificação do percentual de gordura (Lohman / ACSM, adultos). */
export function bodyFatClass(percent: number, male: boolean): string {
  const limits = male ? [6, 15, 20, 25] : [14, 23, 28, 33];
  if (percent < limits[0]!) return "Muito baixa";
  if (percent < limits[1]!) return "Baixa / atlética";
  if (percent < limits[2]!) return "Adequada";
  if (percent < limits[3]!) return "Acima do ideal";
  return "Muito alta";
}

function siri(density: number) {
  return 495 / density - 450;
}

function sum(data: AnthroData, keys: string[]): number | null {
  let total = 0;
  for (const key of keys) {
    const value = num(data[key]);
    if (value === null) return null;
    total += value;
  }
  return total;
}

/** Percentual de gordura pela fórmula escolhida. Retorna null quando faltam dobras. */
export function bodyFatByFormula(
  data: AnthroData,
  profile: PatientProfile,
  formula: SkinfoldFormula,
): { percent: number; density: number | null } | null {
  const male = isMale(profile.sex);
  const age = profile.age ?? 30;
  const keys = requiredSkinfolds(formula, male);
  const total = sum(data, keys);
  if (total === null) return null;

  let density: number | null = null;
  let percent: number | null = null;

  switch (formula) {
    case "pollock3":
      density = male
        ? 1.10938 - 0.0008267 * total + 0.0000016 * total * total - 0.0002574 * age
        : 1.0994921 - 0.0009929 * total + 0.0000023 * total * total - 0.0001392 * age;
      break;
    case "pollock7":
      density = male
        ? 1.112 - 0.00043499 * total + 0.00000055 * total * total - 0.00028826 * age
        : 1.097 - 0.00046971 * total + 0.00000056 * total * total - 0.00012828 * age;
      break;
    case "petroski":
      density = male
        ? 1.10726863 - 0.00081201 * total + 0.00000212 * total * total - 0.00041761 * age
        : 1.1954713 - 0.07513507 * Math.log10(total) - 0.00041072 * age;
      break;
    case "guedes":
      density = male
        ? 1.1714 - 0.0671 * Math.log10(total)
        : 1.1665 - 0.0706 * Math.log10(total);
      break;
    case "durnin": {
      const c = durninConstants(age, male);
      density = c.c - c.m * Math.log10(total);
      break;
    }
    case "faulkner":
      percent = total * 0.153 + 5.783;
      break;
  }

  if (percent === null && density !== null) percent = siri(density);
  if (percent === null || !Number.isFinite(percent) || percent <= 0) return null;
  return { percent: round(percent, 1), density: density ? round(density, 4) : null };
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

export interface AnthroResult {
  label: string;
  value: string;
  detail?: string;
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
  groups: { title: string; results: AnthroResult[] }[];
}

const dash = "—";
const fmt = (value: number | null, unit = "", decimals = 1) =>
  value === null ? dash : `${round(value, decimals).toLocaleString("pt-BR")}${unit ? ` ${unit}` : ""}`;

/** Calcula todos os resultados analíticos da avaliação. */
export function analyzeAnthropometry(
  data: AnthroData,
  profile: PatientProfile,
  formula: SkinfoldFormula = "pollock3",
): AnthroAnalysis {
  const male = isMale(profile.sex);
  const weight = num(data["peso"]);
  const heightCm = num(data["altura"]);
  const height = heightCm ? heightCm / 100 : null;
  const bmi = weight && height ? weight / (height * height) : null;
  const idealWeightRange: [number, number] | null = height
    ? [round(18.5 * height * height, 1), round(24.9 * height * height, 1)]
    : null;

  const waist = num(data["c_cintura"]);
  const hip = num(data["c_quadril"]);
  const abdomen = num(data["c_abdomen"]);
  const whr = waist && hip ? round(waist / hip, 2) : null;
  const whrLimit = male ? 0.9 : 0.85;
  const waistLimit = male ? 94 : 80;

  const arm = num(data["c_braco_relaxado"]);
  const triceps = num(data["d_tricipital"]);
  const cmb = arm && triceps ? round(arm - Math.PI * (triceps / 10), 1) : null;
  const amb = cmb ? round((cmb * cmb) / (4 * Math.PI) - (male ? 10 : 6.5), 1) : null;

  const skinfold = bodyFatByFormula(data, profile, formula);
  const biaFat = num(data["bia_gordura_pct"]);
  const bodyFatPercent = skinfold?.percent ?? biaFat ?? null;

  const fatMass = weight && bodyFatPercent ? round((weight * bodyFatPercent) / 100, 1) : null;
  const leanMass = weight && fatMass !== null ? round(weight - fatMass, 1) : num(data["bia_mlg"]);

  const wrist = num(data["dia_punho"]);
  const femur = num(data["dia_femur"]);
  const boneMass =
    height && wrist && femur
      ? round(3.02 * Math.pow(height * height * (wrist / 100) * (femur / 100) * 400, 0.712), 1)
      : num(data["bia_peso_osseo"]) ?? (leanMass ? round(leanMass * 0.07, 1) : null);
  const residualMass = weight ? round(weight * (male ? 0.241 : 0.209), 1) : null;
  const muscleMass =
    weight && fatMass !== null && boneMass !== null && residualMass !== null
      ? round(weight - fatMass - boneMass - residualMass, 1)
      : num(data["bia_musculo"]);

  // Água corporal total — fórmula de Watson.
  const totalWater =
    weight && heightCm && profile.age !== null
      ? round(
          male
            ? 2.447 - 0.09156 * profile.age + 0.1074 * heightCm + 0.3362 * weight
            : -2.097 + 0.1069 * heightCm + 0.2466 * weight,
          1,
        )
      : num(data["bia_agua"]);

  const groups: AnthroAnalysis["groups"] = [
    {
      title: "Análises de pesos e medidas",
      results: [
        { label: "Peso atual", value: fmt(weight, "kg") },
        { label: "Altura atual", value: fmt(heightCm, "cm", 0) },
        { label: "Índice de Massa Corporal", value: fmt(bmi, "kg/m²") },
        { label: "Classificação do IMC", value: bmi ? bmiClass(bmi) : dash },
        {
          label: "Faixa de peso ideal",
          value: idealWeightRange ? `${idealWeightRange[0]} a ${idealWeightRange[1]} kg` : dash,
        },
        {
          label: "Relação cintura/quadril (RCQ)",
          value: fmt(whr, "", 2),
          detail: whr ? (whr > whrLimit ? "Risco aumentado" : "Adequado") : undefined,
        },
        {
          label: "Circunferência da cintura",
          value: fmt(waist, "cm"),
          detail: waist ? (waist > waistLimit ? `Acima do limite (${waistLimit} cm)` : "Adequada") : undefined,
        },
        {
          label: "Circunferência abdominal",
          value: fmt(abdomen, "cm"),
          detail: abdomen ? (abdomen > (male ? 102 : 88) ? "Risco metabólico elevado" : "Adequada") : undefined,
        },
        { label: "Circunferência muscular do braço (CMB)", value: fmt(cmb, "cm") },
        { label: "Área muscular do braço (AMB)", value: fmt(amb, "cm²") },
      ],
    },
    {
      title: "Análises por dobras e diâmetro ósseo",
      results: [
        {
          label: "Percentual de gordura",
          value: fmt(skinfold?.percent ?? null, "%"),
          detail: `${SKINFOLD_FORMULA_LABELS[formula]}${skinfold ? ` · ${bodyFatClass(skinfold.percent, male)}` : ""}`,
        },
        { label: "Densidade corporal", value: skinfold?.density ? String(skinfold.density) : dash },
        {
          label: "Somatório de dobras",
          value: fmt(sum(data, requiredSkinfolds(formula, male)), "mm"),
        },
        { label: "Peso de gordura", value: fmt(fatMass, "kg") },
        { label: "Massa livre de gordura", value: fmt(leanMass, "kg") },
        { label: "Peso ósseo", value: fmt(boneMass, "kg") },
        { label: "Massa muscular (Matiegka)", value: fmt(muscleMass, "kg") },
        { label: "Peso residual", value: fmt(residualMass, "kg") },
        { label: "Água corporal total (Watson)", value: fmt(totalWater, "L") },
      ],
    },
    {
      title: "Análises por bioimpedância",
      results: [
        {
          label: "Percentual de gordura",
          value: fmt(biaFat, "%"),
          detail: biaFat ? bodyFatClass(biaFat, male) : undefined,
        },
        { label: "Massa gorda", value: fmt(num(data["bia_massa_gorda"]), "kg") },
        { label: "Percentual de massa muscular", value: fmt(num(data["bia_musculo_pct"]), "%") },
        { label: "Massa muscular", value: fmt(num(data["bia_musculo"]), "kg") },
        { label: "Massa livre de gordura", value: fmt(num(data["bia_mlg"]), "kg") },
        { label: "Peso ósseo", value: fmt(num(data["bia_peso_osseo"]), "kg") },
        {
          label: "Índice de gordura visceral",
          value: fmt(num(data["bia_visceral"]), "", 0),
          detail: (() => {
            const v = num(data["bia_visceral"]);
            if (!v) return undefined;
            return v <= 5 ? "Ideal" : v <= 9 ? "Moderado — atenção" : "Elevado";
          })(),
        },
        { label: "Água corporal", value: fmt(num(data["bia_agua"]), "L") },
        { label: "Idade metabólica", value: fmt(num(data["bia_idade_metabolica"]), "anos", 0) },
      ],
    },
  ];

  return {
    bmi: bmi ? round(bmi, 1) : null,
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
    groups,
  };
}

/** Idade em anos completos a partir da data de nascimento. */
export function ageFromBirthDate(birthDate: string | null | undefined): number | null {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - born.getFullYear();
  const month = today.getMonth() - born.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < born.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}