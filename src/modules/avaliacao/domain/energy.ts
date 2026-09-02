/**
 * Domínio puro dos cálculos energéticos do Cach AI.
 *
 * Regras de segurança:
 * - sexo biológico ausente nunca é convertido silenciosamente em feminino;
 * - EER é necessidade energética total, não TMB;
 * - atividade por fator e exercício por MET são estratégias alternativas;
 * - quando MET é usado, soma-se apenas o custo líquido acima do repouso;
 * - GET de manutenção é separado da meta calórica prescrita;
 * - fatores de estresse permanecem uma decisão clínica explícita.
 */

export type EnergySex = "male" | "female" | null;
export type ExerciseMode = "activity_factor" | "met";
export type EerActivity = "sedentary" | "low_active" | "active" | "very_active";

export interface EnergyInputs {
  weight: number | null;
  height: number | null; // cm
  age: number | null;
  sex: EnergySex;
  leanMass: number | null; // kg
  /** Fórmula escolhida. EER é tratada como estimativa de gasto total. */
  formula: string;
  /** Estratégia para atividade: fator diário OU exercício informado em MET. */
  exerciseMode: ExerciseMode;
  activityFactor: number;
  /** Categoria própria usada pela equação EER/DRI 2005. */
  eerActivity: EerActivity;
  /** Fator clínico de estresse/injúria, aplicado somente quando selecionado conscientemente. */
  injuryFactor: number;
  /** Atividade estruturada em MET e duração diária. */
  met: number | null;
  metMinutes: number | null;
  /** Adicional energético de gestação/lactação (DRI 2005) ou nenhum. */
  pregnancy: string;
  /** Ajuste da prescrição sobre o GET de manutenção (déficit negativo / superávit positivo). */
  manualAdjust: number;
  /** Compatibilidade de leitura de registros antigos; não deve ser persistido em novos cálculos. */
  male?: boolean | undefined;
}

export const DEFAULT_ENERGY: EnergyInputs = {
  weight: null,
  height: null,
  age: null,
  sex: null,
  leanMass: null,
  formula: "mifflin",
  exerciseMode: "activity_factor",
  activityFactor: 1.375,
  eerActivity: "low_active",
  injuryFactor: 1,
  met: null,
  metMinutes: null,
  pregnancy: "nenhum",
  manualAdjust: 0,
};

export const ACTIVITY_FACTORS = [
  { value: 1.2, label: "Sedentário / rotina pouco ativa (1,20)" },
  { value: 1.375, label: "Levemente ativo (1,375)" },
  { value: 1.55, label: "Moderadamente ativo (1,55)" },
  { value: 1.725, label: "Muito ativo (1,725)" },
  { value: 1.9, label: "Extremamente ativo (1,90)" },
];

/**
 * Não associa doença a um multiplicador fixo: a magnitude do estresse metabólico
 * depende do quadro e deve ser escolhida pela nutricionista.
 */
export const INJURY_FACTORS = [
  { value: 1, label: "Sem fator adicional (1,00)" },
  { value: 1.1, label: "Estresse metabólico leve (1,10)" },
  { value: 1.2, label: "Estresse metabólico moderado (1,20)" },
  { value: 1.3, label: "Estresse metabólico importante (1,30)" },
  { value: 1.5, label: "Estresse metabólico muito importante (1,50)" },
];

export const EER_ACTIVITY_OPTIONS: { value: EerActivity; label: string }[] = [
  { value: "sedentary", label: "Sedentário" },
  { value: "low_active", label: "Pouco ativo" },
  { value: "active", label: "Ativo" },
  { value: "very_active", label: "Muito ativo" },
];

export const PREGNANCY_OPTIONS = [
  { value: "nenhum", label: "Não se aplica", kcal: 0 },
  { value: "gest_1", label: "Gestação — 1º trimestre (sem adicional fixo)", kcal: 0 },
  { value: "gest_2", label: "Gestação — 2º trimestre (+340 kcal · DRI 2005)", kcal: 340 },
  { value: "gest_3", label: "Gestação — 3º trimestre (+452 kcal · DRI 2005)", kcal: 452 },
  { value: "lact_1", label: "Lactação — 0 a 6 meses (+500 kcal · DRI 2005)", kcal: 500 },
  { value: "lact_2", label: "Lactação — 7 a 12 meses (+400 kcal · DRI 2005)", kcal: 400 },
];

export const ENERGY_FORMULAS = [
  { value: "mifflin", label: "Mifflin-St Jeor (1990)", kind: "basal" },
  { value: "harris_rev", label: "Harris-Benedict revisada (1984)", kind: "basal" },
  { value: "harris", label: "Harris-Benedict original (1919)", kind: "basal" },
  { value: "fao", label: "FAO/OMS/UNU", kind: "basal" },
  { value: "owen", label: "Owen", kind: "basal" },
  { value: "cunningham", label: "Cunningham (massa livre de gordura)", kind: "basal" },
  { value: "katch", label: "Katch-McArdle (massa livre de gordura)", kind: "basal" },
  { value: "eer", label: "EER — DRI/IOM 2005", kind: "total" },
] as const;

function resolvedSex(input: EnergyInputs): EnergySex {
  if (input.sex === "male" || input.sex === "female") return input.sex;
  if (input.male === true) return "male";
  // `male: false` de registros antigos não é suficiente para inferir sexo feminino.
  return null;
}

function faoCoefficients(age: number, sex: Exclude<EnergySex, null>): { a: number; b: number } {
  if (sex === "male") {
    if (age < 3) return { a: 59.512, b: -30.4 };
    if (age < 10) return { a: 22.706, b: 504.3 };
    if (age < 18) return { a: 17.686, b: 658.2 };
    if (age < 30) return { a: 15.057, b: 692.2 };
    if (age < 60) return { a: 11.472, b: 873.1 };
    return { a: 11.711, b: 587.7 };
  }
  if (age < 3) return { a: 58.317, b: -31.1 };
  if (age < 10) return { a: 20.315, b: 485.9 };
  if (age < 18) return { a: 13.384, b: 692.6 };
  if (age < 30) return { a: 14.818, b: 486.6 };
  if (age < 60) return { a: 8.126, b: 845.6 };
  return { a: 9.082, b: 658.5 };
}

function eerPhysicalActivityCoefficient(sex: Exclude<EnergySex, null>, category: EerActivity) {
  if (sex === "male") {
    return { sedentary: 1, low_active: 1.11, active: 1.25, very_active: 1.48 }[category];
  }
  return { sedentary: 1, low_active: 1.12, active: 1.27, very_active: 1.45 }[category];
}

export interface EnergyEstimate {
  key: string;
  label: string;
  kcal: number | null;
  note?: string | undefined;
  requires?: string[] | undefined;
}

/** Estimativas de TMB/GER. EER fica separada porque já é uma estimativa de necessidade total. */
export function basalEstimates(input: EnergyInputs): EnergyEstimate[] {
  const { weight: p, height: a, age: i, leanMass } = input;
  const sex = resolvedSex(input);
  const ready = p !== null && a !== null && i !== null && sex !== null;
  const r = (value: number | null) => (value === null ? null : Math.round(value));
  const sexMissing = sex === null ? ["sexo biológico"] : undefined;

  return [
    {
      key: "mifflin",
      label: "Mifflin-St Jeor (1990)",
      kcal: r(ready ? 10 * p! + 6.25 * a! - 5 * i! + (sex === "male" ? 5 : -161) : null),
      note: "Adultos; usa peso, altura, idade e sexo biológico.",
      requires: !ready ? [...(p === null ? ["peso"] : []), ...(a === null ? ["altura"] : []), ...(i === null ? ["idade"] : []), ...(sexMissing ?? [])] : undefined,
    },
    {
      key: "harris_rev",
      label: "Harris-Benedict revisada (1984)",
      kcal: r(ready ? (sex === "male" ? 88.362 + 13.397 * p! + 4.799 * a! - 5.677 * i! : 447.593 + 9.247 * p! + 3.098 * a! - 4.33 * i!) : null),
      requires: !ready ? [...(p === null ? ["peso"] : []), ...(a === null ? ["altura"] : []), ...(i === null ? ["idade"] : []), ...(sexMissing ?? [])] : undefined,
    },
    {
      key: "harris",
      label: "Harris-Benedict original (1919)",
      kcal: r(ready ? (sex === "male" ? 66.47 + 13.75 * p! + 5.003 * a! - 6.755 * i! : 655.1 + 9.563 * p! + 1.85 * a! - 4.676 * i!) : null),
      note: "Mantida para comparação histórica.",
      requires: !ready ? [...(p === null ? ["peso"] : []), ...(a === null ? ["altura"] : []), ...(i === null ? ["idade"] : []), ...(sexMissing ?? [])] : undefined,
    },
    {
      key: "fao",
      label: "FAO/OMS/UNU",
      kcal: r(p !== null && i !== null && sex !== null ? (() => { const c = faoCoefficients(i, sex); return c.a * p + c.b; })() : null),
      note: "Equação dependente da faixa etária e sexo biológico.",
      requires: p === null || i === null || sex === null ? [...(p === null ? ["peso"] : []), ...(i === null ? ["idade"] : []), ...(sexMissing ?? [])] : undefined,
    },
    {
      key: "owen",
      label: "Owen",
      kcal: r(p !== null && sex !== null ? (sex === "male" ? 879 + 10.2 * p : 795 + 7.18 * p) : null),
      requires: p === null || sex === null ? [...(p === null ? ["peso"] : []), ...(sexMissing ?? [])] : undefined,
    },
    {
      key: "cunningham",
      label: "Cunningham",
      kcal: r(leanMass !== null ? 500 + 22 * leanMass : null),
      note: leanMass === null ? "Requer massa livre de gordura válida." : "Baseada na massa livre de gordura.",
      requires: leanMass === null ? ["massa livre de gordura"] : undefined,
    },
    {
      key: "katch",
      label: "Katch-McArdle",
      kcal: r(leanMass !== null ? 370 + 21.6 * leanMass : null),
      note: leanMass === null ? "Requer massa livre de gordura válida." : "Baseada na massa livre de gordura.",
      requires: leanMass === null ? ["massa livre de gordura"] : undefined,
    },
  ];
}

/** EER de adultos pela DRI/IOM 2005. Não é TMB: já incorpora a atividade física. */
export function eerEstimate(input: EnergyInputs): EnergyEstimate {
  const sex = resolvedSex(input);
  const { weight, height, age } = input;
  const ready = weight !== null && height !== null && age !== null && sex !== null && age >= 19;
  const missing = [
    ...(weight === null ? ["peso"] : []),
    ...(height === null ? ["altura"] : []),
    ...(age === null ? ["idade"] : []),
    ...(sex === null ? ["sexo biológico"] : []),
    ...(age !== null && age < 19 ? ["idade adulta (≥19 anos)"] : []),
  ];
  if (!ready) return { key: "eer", label: "EER — DRI/IOM 2005", kcal: null, note: "Necessidade energética total; não é TMB.", requires: missing };
  const pa = eerPhysicalActivityCoefficient(sex, input.eerActivity);
  const heightM = height / 100;
  const kcal = sex === "male"
    ? 662 - 9.53 * age + pa * (15.91 * weight + 539.6 * heightM)
    : 354 - 6.91 * age + pa * (9.36 * weight + 726 * heightM);
  return { key: "eer", label: "EER — DRI/IOM 2005", kcal: Math.round(kcal), note: "Já incorpora a categoria de atividade física." };
}

export interface EnergyIssue {
  severity: "warning" | "error";
  message: string;
}

export interface EnergyResult {
  estimates: EnergyEstimate[];
  eer: EnergyEstimate;
  /** TMB/GER selecionada. Null quando EER foi escolhida. */
  bmr: number | null;
  /** Exercício líquido acima do repouso; evita dupla contagem de 1 MET. */
  metKcal: number;
  pregnancyKcal: number;
  /** GET antes do ajuste de prescrição. */
  maintenanceKcal: number | null;
  /** Meta calórica final para alimentar o plano. Mantido também em `tee` por compatibilidade. */
  targetKcal: number | null;
  tee: number | null;
  issues: EnergyIssue[];
  formulaKind: "basal" | "total";
}

export function calculateEnergy(input: EnergyInputs): EnergyResult {
  const estimates = basalEstimates(input);
  const eer = eerEstimate(input);
  const formulaKind = input.formula === "eer" ? "total" : "basal";
  const selected = formulaKind === "total" ? eer : estimates.find((estimate) => estimate.key === input.formula) ?? null;
  const bmr = formulaKind === "basal" ? selected?.kcal ?? null : null;
  const issues: EnergyIssue[] = [];

  if (!selected || selected.kcal === null) {
    issues.push({ severity: "error", message: selected?.requires?.length ? `Faltam dados para ${selected.label}: ${selected.requires.join(", ")}.` : "A fórmula selecionada ainda não pode ser calculada." });
  }

  let metKcal = 0;
  if (formulaKind === "basal" && input.exerciseMode === "met" && input.met !== null && input.metMinutes !== null && input.weight !== null) {
    if (input.met < 1) issues.push({ severity: "warning", message: "MET abaixo de 1 foi desconsiderado no adicional de exercício." });
    else if (input.metMinutes > 0) metKcal = Math.round((input.met - 1) * input.weight * (input.metMinutes / 60));
  }

  if (input.exerciseMode === "met" && (input.met === null || input.metMinutes === null)) {
    issues.push({ severity: "warning", message: "Modo MET selecionado: informe intensidade (MET) e minutos/dia para adicionar o exercício." });
  }

  if (input.injuryFactor < 1 || input.injuryFactor > 2) {
    issues.push({ severity: "error", message: "Fator de estresse/injúria fora da faixa aceita (1,00 a 2,00)." });
  } else if (input.injuryFactor > 1) {
    issues.push({ severity: "warning", message: "Fator de estresse/injúria é um ajuste clínico e não deve ser inferido automaticamente pelo diagnóstico." });
  }

  const pregnancyKcal = PREGNANCY_OPTIONS.find((option) => option.value === input.pregnancy)?.kcal ?? 0;
  if (input.pregnancy !== "nenhum" && resolvedSex(input) !== "female") {
    issues.push({ severity: "error", message: "Gestação/lactação só pode ser aplicada quando o sexo biológico cadastrado é feminino." });
  }

  let maintenanceKcal: number | null = null;
  if (selected?.kcal !== null && selected?.kcal !== undefined && input.injuryFactor >= 1 && input.injuryFactor <= 2) {
    if (formulaKind === "total") {
      // EER já incorpora atividade; não recebe fator de atividade nem MET adicional.
      maintenanceKcal = Math.round(selected.kcal * input.injuryFactor + pregnancyKcal);
      if (input.exerciseMode === "met" && input.metKcal !== undefined) {
        // Campo legado inexistente na interface atual; intencionalmente ignorado.
      }
    } else {
      const activityComponent = input.exerciseMode === "activity_factor" ? input.activityFactor : 1.2;
      maintenanceKcal = Math.round(selected.kcal * activityComponent * input.injuryFactor + metKcal + pregnancyKcal);
    }
  }

  const targetKcal = maintenanceKcal === null ? null : Math.round(maintenanceKcal + input.manualAdjust);
  if (targetKcal !== null && targetKcal <= 0) issues.push({ severity: "error", message: "O ajuste clínico resultou em meta calórica não positiva. Revise o ajuste." });

  return {
    estimates,
    eer,
    bmr,
    metKcal,
    pregnancyKcal,
    maintenanceKcal,
    targetKcal: targetKcal !== null && targetKcal > 0 ? targetKcal : null,
    tee: targetKcal !== null && targetKcal > 0 ? targetKcal : null,
    issues,
    formulaKind,
  };
}
