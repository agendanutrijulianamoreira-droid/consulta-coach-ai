/**
 * Domínio dos cálculos energéticos (TMB, GET, MET, injúria e gestação).
 *
 * Puro e determinístico: recebe os dados já coletados na antropometria e no
 * cadastro do paciente e devolve todas as estimativas disponíveis, para que a
 * nutricionista escolha a fórmula e ajuste os fatores.
 */

export interface EnergyInputs {
  weight: number | null;
  height: number | null; // cm
  age: number | null;
  male: boolean;
  leanMass: number | null; // kg
  /** Fórmula escolhida para compor o GET. */
  formula: string;
  activityFactor: number;
  injuryFactor: number;
  /** Atividades em MET: intensidade e duração diária em minutos. */
  met: number | null;
  metMinutes: number | null;
  /** Adicional energético: gestação/lactação ou ajuste manual. */
  pregnancy: string;
  manualAdjust: number;
}

export const DEFAULT_ENERGY: EnergyInputs = {
  weight: null,
  height: null,
  age: null,
  male: false,
  leanMass: null,
  formula: "mifflin",
  activityFactor: 1.375,
  injuryFactor: 1,
  met: null,
  metMinutes: null,
  pregnancy: "nenhum",
  manualAdjust: 0,
};

export const ACTIVITY_FACTORS = [
  { value: 1.2, label: "Sedentário (1,20)" },
  { value: 1.375, label: "Levemente ativo (1,375)" },
  { value: 1.55, label: "Moderadamente ativo (1,55)" },
  { value: 1.725, label: "Muito ativo (1,725)" },
  { value: 1.9, label: "Extremamente ativo (1,90)" },
];

export const INJURY_FACTORS = [
  { value: 1, label: "Sem injúria (1,00)" },
  { value: 1.1, label: "Pós-operatório eletivo (1,10)" },
  { value: 1.2, label: "Infecção leve (1,20)" },
  { value: 1.3, label: "Trauma / fratura (1,30)" },
  { value: 1.4, label: "Sepse (1,40)" },
  { value: 1.5, label: "Câncer / caquexia (1,50)" },
  { value: 1.8, label: "Grande queimado (1,80)" },
];

export const PREGNANCY_OPTIONS = [
  { value: "nenhum", label: "Não se aplica", kcal: 0 },
  { value: "gest_1", label: "Gestação — 1º trimestre", kcal: 0 },
  { value: "gest_2", label: "Gestação — 2º trimestre (+340 kcal)", kcal: 340 },
  { value: "gest_3", label: "Gestação — 3º trimestre (+452 kcal)", kcal: 452 },
  { value: "lact_1", label: "Lactação — 0 a 6 meses (+500 kcal)", kcal: 500 },
  { value: "lact_2", label: "Lactação — 7 a 12 meses (+400 kcal)", kcal: 400 },
];

export const ENERGY_FORMULAS = [
  { value: "harris", label: "Harris-Benedict (1919)" },
  { value: "harris_rev", label: "Harris-Benedict revisada (1984)" },
  { value: "mifflin", label: "Mifflin-St Jeor (1990)" },
  { value: "fao", label: "FAO/OMS/UNU (2004)" },
  { value: "owen", label: "Owen (1986)" },
  { value: "cunningham", label: "Cunningham (1980)" },
  { value: "katch", label: "Katch-McArdle" },
  { value: "eer", label: "EER — IOM/DRI (2005)" },
];

function faoCoefficients(age: number, male: boolean): { a: number; b: number } {
  if (male) {
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

export interface EnergyEstimate {
  key: string;
  label: string;
  kcal: number | null;
  note?: string | undefined;
}

/** Todas as estimativas de taxa metabólica basal disponíveis com os dados atuais. */
export function basalEstimates(input: EnergyInputs): EnergyEstimate[] {
  const { weight: p, height: a, age: i, male, leanMass } = input;
  const ready = p !== null && a !== null && i !== null;
  const r = (value: number | null) => (value === null ? null : Math.round(value));

  return [
    {
      key: "harris",
      label: "Harris-Benedict (1919)",
      kcal: r(ready ? (male ? 66.47 + 13.75 * p! + 5.003 * a! - 6.755 * i! : 655.1 + 9.563 * p! + 1.85 * a! - 4.676 * i!) : null),
    },
    {
      key: "harris_rev",
      label: "Harris-Benedict revisada (1984)",
      kcal: r(ready ? (male ? 88.362 + 13.397 * p! + 4.799 * a! - 5.677 * i! : 447.593 + 9.247 * p! + 3.098 * a! - 4.33 * i!) : null),
    },
    {
      key: "mifflin",
      label: "Mifflin-St Jeor (1990)",
      kcal: r(ready ? 10 * p! + 6.25 * a! - 5 * i! + (male ? 5 : -161) : null),
      note: "Melhor acurácia em adultos saudáveis",
    },
    {
      key: "fao",
      label: "FAO/OMS/UNU (2004)",
      kcal: r(
        p !== null && i !== null
          ? (() => {
              const c = faoCoefficients(i, male);
              return c.a * p + c.b;
            })()
          : null,
      ),
      note: "Referência para saúde pública",
    },
    {
      key: "owen",
      label: "Owen (1986)",
      kcal: r(p !== null ? (male ? 879 + 10.2 * p : 795 + 7.18 * p) : null),
    },
    {
      key: "cunningham",
      label: "Cunningham (1980)",
      kcal: r(leanMass !== null ? 500 + 22 * leanMass : null),
      note: leanMass === null ? "Requer massa livre de gordura" : "Baseada na massa magra",
    },
    {
      key: "katch",
      label: "Katch-McArdle",
      kcal: r(leanMass !== null ? 370 + 21.6 * leanMass : null),
      note: leanMass === null ? "Requer massa livre de gordura" : "Indicada para atletas",
    },
    {
      key: "eer",
      label: "EER — IOM/DRI (2005)",
      kcal: r(
        ready
          ? male
            ? 662 - 9.53 * i! + input.activityFactor * (15.91 * p! + 539.6 * (a! / 100))
            : 354 - 6.91 * i! + input.activityFactor * (9.36 * p! + 726 * (a! / 100))
          : null,
      ),
      note: "Já inclui o nível de atividade",
    },
  ];
}

export interface EnergyResult {
  estimates: EnergyEstimate[];
  bmr: number | null;
  metKcal: number;
  pregnancyKcal: number;
  tee: number | null;
}

/** Gasto energético total: TMB × fator de atividade × fator de injúria + adicionais. */
export function calculateEnergy(input: EnergyInputs): EnergyResult {
  const estimates = basalEstimates(input);
  const bmr = estimates.find((estimate) => estimate.key === input.formula)?.kcal ?? null;
  const metKcal =
    input.met && input.metMinutes && input.weight
      ? Math.round(input.met * input.weight * (input.metMinutes / 60))
      : 0;
  const pregnancyKcal = PREGNANCY_OPTIONS.find((option) => option.value === input.pregnancy)?.kcal ?? 0;

  // A EER já embute o nível de atividade; não multiplicamos duas vezes.
  const activity = input.formula === "eer" ? 1 : input.activityFactor;
  const tee =
    bmr === null
      ? null
      : Math.round(bmr * activity * input.injuryFactor + metKcal + pregnancyKcal + input.manualAdjust);

  return { estimates, bmr, metKcal, pregnancyKcal, tee };
}