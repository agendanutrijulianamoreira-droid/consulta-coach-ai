import { biologicalSex, num, type AnthroData, type PatientProfile } from "./anthropometry";

const round = (value: number, decimals = 1) => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const asInput = (value: number) => String(round(value, 1));

export interface BedriddenWeightEstimate {
  weight: number | null;
  missing: string[];
  method: "Chumlea et al. (1988)";
}

/**
 * Estima peso de paciente que não pode ser pesado em pé.
 * Chumlea et al. (1988): usa circunferência do braço e panturrilha (cm),
 * dobra subescapular (mm) e altura do joelho (cm), com equações por sexo.
 */
export function estimateBedriddenWeight(data: AnthroData, profile: PatientProfile): BedriddenWeightEstimate {
  const sex = biologicalSex(profile.sex);
  const arm = num(data["c_braco_relaxado"]);
  const calf = num(data["c_panturrilha"]);
  const subscapular = num(data["d_subescapular"]);
  const kneeHeight = num(data["altura_joelho"]);
  const missing: string[] = [];

  if (sex === null) missing.push("sexo biológico no cadastro");
  if (arm === null) missing.push("circunferência do braço relaxado");
  if (calf === null) missing.push("circunferência da panturrilha");
  if (subscapular === null) missing.push("dobra subescapular");
  if (kneeHeight === null) missing.push("altura do joelho");
  if (missing.length) return { weight: null, missing, method: "Chumlea et al. (1988)" };

  const weight = sex === "male"
    ? 1.73 * arm! + 0.98 * calf! + 0.37 * subscapular! + 1.16 * kneeHeight! - 81.69
    : 0.98 * arm! + 1.27 * calf! + 0.4 * subscapular! + 0.87 * kneeHeight! - 62.35;

  if (!Number.isFinite(weight) || weight <= 20 || weight >= 350) {
    return { weight: null, missing: ["medidas dentro de uma faixa antropométrica plausível"], method: "Chumlea et al. (1988)" };
  }

  return { weight: round(weight, 1), missing: [], method: "Chumlea et al. (1988)" };
}

/**
 * Calcula a massa livre de gordura da bioimpedância a partir do peso e da
 * massa gorda. O valor é sempre derivado, nunca tratado como medida primária.
 */
export function deriveBioimpedanceLeanMass(data: AnthroData): AnthroData {
  const next = { ...data };
  const weight = num(next["peso"]);
  const fatMass = num(next["bia_massa_gorda"]);
  if (weight !== null && weight > 0 && fatMass !== null && fatMass >= 0 && fatMass < weight) {
    next["bia_mlg"] = asInput(weight - fatMass);
    next["bia_mlg_source"] = "derived_weight_minus_fat_mass";
  } else {
    next["bia_mlg"] = "";
    next["bia_mlg_source"] = "";
  }
  return next;
}

/**
 * Mantém pares de bioimpedância sincronizados. O último campo digitado é a
 * fonte e o complementar é derivado. Quando o peso muda, recalcula somente o
 * lado derivado, preservando o dado efetivamente informado pelo equipamento.
 * Massa livre de gordura é sempre derivada de peso - massa gorda.
 */
export function applyAnthropometryInput(data: AnthroData, key: string, value: string): AnthroData {
  let next: AnthroData = { ...data, [key]: value };
  const weight = key === "peso" ? num(value) : num(next["peso"]);

  if (key === "bia_gordura_pct") {
    next["bia_fat_source"] = "percent";
    const pct = num(value);
    next["bia_massa_gorda"] = weight !== null && pct !== null ? asInput((weight * pct) / 100) : "";
  } else if (key === "bia_massa_gorda") {
    next["bia_fat_source"] = "mass";
    const mass = num(value);
    next["bia_gordura_pct"] = weight !== null && weight > 0 && mass !== null ? asInput((mass / weight) * 100) : "";
  }

  if (key === "bia_musculo_pct") {
    next["bia_muscle_source"] = "percent";
    const pct = num(value);
    next["bia_musculo"] = weight !== null && pct !== null ? asInput((weight * pct) / 100) : "";
  } else if (key === "bia_musculo") {
    next["bia_muscle_source"] = "mass";
    const mass = num(value);
    next["bia_musculo_pct"] = weight !== null && weight > 0 && mass !== null ? asInput((mass / weight) * 100) : "";
  }

  if (key === "peso" && weight !== null && weight > 0) {
    if (next["bia_fat_source"] === "mass") {
      const mass = num(next["bia_massa_gorda"]);
      if (mass !== null) next["bia_gordura_pct"] = asInput((mass / weight) * 100);
    } else {
      const pct = num(next["bia_gordura_pct"]);
      if (pct !== null) next["bia_massa_gorda"] = asInput((weight * pct) / 100);
    }

    if (next["bia_muscle_source"] === "mass") {
      const mass = num(next["bia_musculo"]);
      if (mass !== null) next["bia_musculo_pct"] = asInput((mass / weight) * 100);
    } else {
      const pct = num(next["bia_musculo_pct"]);
      if (pct !== null) next["bia_musculo"] = asInput((weight * pct) / 100);
    }
  }

  next = deriveBioimpedanceLeanMass(next);
  return next;
}

/** Marca o peso aplicado pelo estimador para rastreabilidade no prontuário/parecer. */
export function applyEstimatedWeight(data: AnthroData, weight: number): AnthroData {
  return applyAnthropometryInput({ ...data, weight_source: "estimated_chumlea" }, "peso", asInput(weight));
}
