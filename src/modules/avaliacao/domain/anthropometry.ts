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

/**
 * Classificação do IMC.
 * Adultos (20-59 anos): OMS (1995/2000).
 * Idosos (>= 60 anos): Lipschitz (1994), adotada pelo SISVAN/MS.
 */
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

/**
 * Classificação do percentual de gordura por faixa etária e sexo biológico.
 * Referência: Gallagher et al. (2000), Am J Clin Nutr — pontos de corte de
 * gordura corporal correspondentes ao IMC de risco, por idade e sexo.
 */
export function bodyFatClass(percent: number, male: boolean, age: number | null = null): string {
  const a = age ?? 30;
  const band = a < 40 ? 0 : a < 60 ? 1 : 2;
  const table: Record<"m" | "f", number[][]> = {
    m: [
      [8, 20, 25],
      [11, 22, 28],
      [13, 25, 30],
    ],
    f: [
      [21, 33, 39],
      [23, 34, 40],
      [24, 36, 42],
    ],
  };
  const [low, high, obese] = table[male ? "m" : "f"][band]!;
  const ref = `Gallagher, ${a < 40 ? "20-39" : a < 60 ? "40-59" : "60-79"} anos`;
  if (percent < low!) return `Abaixo do recomendado (${ref})`;
  if (percent < high!) return `Adequado (${ref})`;
  if (percent < obese!) return `Acima do ideal (${ref})`;
  return `Obesidade por adiposidade (${ref})`;
}

/**
 * Risco cardiometabólico pela relação cintura/quadril, por idade e sexo.
 * Referência: Bray & Gray (1988) apud Heyward & Stolarczyk — pontos de corte
 * de risco alto por faixa etária.
 */
export function whrRiskClass(whr: number, male: boolean, age: number | null = null): string {
  const a = age ?? 30;
  const cuts = male
    ? [
        [29, 0.94],
        [39, 0.96],
        [49, 1.0],
        [59, 1.02],
        [200, 1.03],
      ]
    : [
        [29, 0.82],
        [39, 0.84],
        [49, 0.88],
        [59, 0.9],
        [200, 0.91],
      ];
  const cut = (cuts.find(([limit]) => a <= limit!) ?? cuts[cuts.length - 1]!)[1]!;
  const band = a < 30 ? "20-29" : a < 40 ? "30-39" : a < 50 ? "40-49" : a < 60 ? "50-59" : "60-69";
  return whr >= cut
    ? `Risco alto (≥ ${cut} · ${band} anos)`
    : whr >= cut - 0.06
      ? `Risco moderado (corte ${cut} · ${band} anos)`
      : `Risco baixo (corte ${cut} · ${band} anos)`;
}

/**
 * Percentil 50 de referência de CMB (cm) e AMB (cm²) por idade e sexo.
 * Referência: Frisancho AR (1981/1990), tabelas antropométricas NHANES.
 */
function frisanchoP50(age: number | null, male: boolean): { cmb: number; amb: number } {
  const a = age ?? 30;
  const rows: [number, number, number][] = male
    ? [
        [24, 27.9, 54.5],
        [34, 28.6, 58.3],
        [44, 28.7, 58.8],
        [54, 28.1, 56.9],
        [64, 27.8, 55.4],
        [200, 26.8, 52.0],
      ]
    : [
        [24, 21.2, 30.9],
        [34, 21.8, 32.8],
        [44, 22.0, 33.5],
        [54, 22.5, 35.1],
        [64, 22.5, 35.4],
        [200, 22.5, 34.7],
      ];
  const row = rows.find(([limit]) => a <= limit) ?? rows[rows.length - 1]!;
  return { cmb: row[1], amb: row[2] };
}

/** Classificação de adequação (Blackburn & Thornton, 1979) sobre o P50 de Frisancho. */
function adequacyClass(measured: number, reference: number): { percent: number; label: string } {
  const percent = round((measured / reference) * 100, 1);
  const label =
    percent >= 110
      ? "Acima da referência"
      : percent >= 90
        ? "Eutrofia"
        : percent >= 80
          ? "Depleção leve"
          : percent >= 70
            ? "Depleção moderada"
            : "Depleção grave";
  return { percent, label };
}

/** Classificação da gordura visceral por índice de bioimpedância (Tanita). */
function visceralClass(value: number): string {
  return value <= 9 ? "Saudável (1-9 · Tanita)" : value <= 14 ? "Elevado (10-14 · Tanita)" : "Muito elevado (≥ 15 · Tanita)";
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
  detail?: string | undefined;
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
  const reference = frisanchoP50(profile.age, male);
  const cmbAdequacy = cmb ? adequacyClass(cmb, reference.cmb) : null;
  const ambAdequacy = amb && amb > 0 ? adequacyClass(amb, reference.amb) : null;

  const skinfold = bodyFatByFormula(data, profile, formula);
  // Bioimpedância: o percentual informado já gera massa gorda e massa magra em kg
  // (e vice-versa, quando a balança informa apenas a massa gorda).
  const biaFatRaw = num(data["bia_gordura_pct"]);
  const biaFatMassRaw = num(data["bia_massa_gorda"]);
  const biaFat = biaFatRaw ?? (weight && biaFatMassRaw ? round((biaFatMassRaw / weight) * 100, 1) : null);
  const biaFatMass = biaFatMassRaw ?? (weight && biaFat ? round((weight * biaFat) / 100, 1) : null);
  const biaLeanMass =
    num(data["bia_mlg"]) ?? (weight && biaFatMass !== null ? round(weight - biaFatMass, 1) : null);
  const biaMusclePct =
    num(data["bia_musculo_pct"]) ??
    (weight && num(data["bia_musculo"]) ? round((num(data["bia_musculo"])! / weight) * 100, 1) : null);
  const biaMuscle =
    num(data["bia_musculo"]) ??
    (weight && num(data["bia_musculo_pct"]) ? round((weight * num(data["bia_musculo_pct"])!) / 100, 1) : null);
  const bodyFatPercent = skinfold?.percent ?? biaFat ?? null;

  const fatMass = weight && bodyFatPercent ? round((weight * bodyFatPercent) / 100, 1) : null;
  const leanMass = weight && fatMass !== null ? round(weight - fatMass, 1) : biaLeanMass;

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
      : biaMuscle;

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
        { label: "Classificação do IMC", value: bmi ? bmiClass(bmi, profile.age) : dash },
        {
          label: "Faixa de peso ideal",
          value: idealWeightRange ? `${idealWeightRange[0]} a ${idealWeightRange[1]} kg` : dash,
        },
        {
          label: "Relação cintura/quadril (RCQ)",
          value: fmt(whr, "", 2),
          detail: whr ? whrRiskClass(whr, male, profile.age) : undefined,
        },
        {
          label: "Circunferência da cintura",
          value: fmt(waist, "cm"),
          detail: waist
            ? waist >= (male ? 102 : 88)
              ? `Risco muito aumentado (≥ ${male ? 102 : 88} cm · OMS)`
              : waist >= waistLimit
                ? `Risco aumentado (≥ ${waistLimit} cm · OMS)`
                : `Adequada (< ${waistLimit} cm · OMS)`
            : undefined,
        },
        {
          label: "Circunferência abdominal",
          value: fmt(abdomen, "cm"),
          detail: abdomen ? (abdomen > (male ? 102 : 88) ? "Risco metabólico elevado" : "Adequada") : undefined,
        },
        {
          label: "Circunferência muscular do braço (CMB)",
          value: fmt(cmb, "cm"),
          detail: cmbAdequacy
            ? `${cmbAdequacy.percent}% do P50 (${reference.cmb} cm · Frisancho ${profile.age ?? "?"} anos, ${male ? "masc." : "fem."}) · ${cmbAdequacy.label}`
            : "Informe braço relaxado, dobra tricipital, idade e sexo no cadastro",
        },
        {
          label: "Área muscular do braço (AMB)",
          value: fmt(amb, "cm²"),
          detail: ambAdequacy
            ? `${ambAdequacy.percent}% do P50 (${reference.amb} cm² · Frisancho) · ${ambAdequacy.label}`
            : undefined,
        },
      ],
    },
    {
      title: "Análises por dobras e diâmetro ósseo",
      results: [
        {
          label: "Percentual de gordura",
          value: fmt(skinfold?.percent ?? null, "%"),
          detail: `${SKINFOLD_FORMULA_LABELS[formula]}${skinfold ? ` · ${bodyFatClass(skinfold.percent, male, profile.age)}` : ""}`,
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
          detail: biaFat
            ? `${bodyFatClass(biaFat, male, profile.age)}${biaFatRaw === null ? " · derivado da massa gorda" : ""}`
            : undefined,
        },
        {
          label: "Massa gorda",
          value: fmt(biaFatMass, "kg"),
          detail: biaFatMassRaw === null && biaFatMass !== null ? "Calculada a partir do % de gordura" : undefined,
        },
        { label: "Percentual de massa muscular", value: fmt(biaMusclePct, "%") },
        { label: "Massa muscular", value: fmt(biaMuscle, "kg") },
        {
          label: "Massa livre de gordura (massa magra)",
          value: fmt(biaLeanMass, "kg"),
          detail: num(data["bia_mlg"]) === null && biaLeanMass !== null ? "Peso menos massa gorda" : undefined,
        },
        { label: "Peso ósseo", value: fmt(num(data["bia_peso_osseo"]), "kg") },
        {
          label: "Índice de gordura visceral",
          value: fmt(num(data["bia_visceral"]), "", 0),
          detail: (() => {
            const v = num(data["bia_visceral"]);
            return v ? visceralClass(v) : undefined;
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