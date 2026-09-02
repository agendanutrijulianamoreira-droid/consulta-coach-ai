/**
 * Cálculos laboratoriais determinísticos do Cach AI.
 *
 * Resultados derivados só usam resultados CONFIRMADOS. Valores importados por
 * imagem/PDF ficam pendentes até revisão profissional e não alimentam fórmulas.
 */

export type LabReviewStatus = "pending" | "confirmed" | "rejected";
export type LabInputMethod = "manual" | "dictation" | "image" | "pdf" | "derived";

export interface LabResultValue {
  id?: string;
  analyte_code: string;
  analyte_name: string;
  value: number | null;
  value_text?: string | null;
  unit?: string | null;
  lab_reference_min?: number | null;
  lab_reference_max?: number | null;
  lab_reference_text?: string | null;
  input_method?: LabInputMethod;
  review_status?: LabReviewStatus;
  is_derived?: boolean;
  calculation_key?: string | null;
  calculation_version?: string | null;
  dependencies?: string[];
  source_note?: string | null;
}

export interface LabPatientContext {
  age: number | null;
  sex: "male" | "female" | null;
  weightKg: number | null;
}

export interface DerivedLabResult extends LabResultValue {
  value: number;
  input_method: "derived";
  review_status: "confirmed";
  is_derived: true;
  calculation_key: string;
  calculation_version: string;
  dependencies: string[];
}

const aliases: Record<string, string> = {
  glicemia: "glucose",
  "glicemia de jejum": "glucose",
  glicose: "glucose",
  glucose: "glucose",
  insulina: "insulin",
  "insulina de jejum": "insulin",
  creatinina: "creatinine",
  creatinine: "creatinine",
  "testosterona total": "testosterone_total",
  testosterone: "testosterone_total",
  shbg: "shbg",
  albumina: "albumin",
  albumin: "albumin",
  triglicerides: "triglycerides",
  triglicérides: "triglycerides",
  hdl: "hdl",
  "hdl-c": "hdl",
  ldl: "ldl",
  "ldl-c": "ldl",
  "colesterol total": "total_cholesterol",
  ast: "ast",
  tgo: "ast",
  alt: "alt",
  tgp: "alt",
  neutrofilos: "neutrophils",
  neutrófilos: "neutrophils",
  linfocitos: "lymphocytes",
  linfócitos: "lymphocytes",
};

export function canonicalAnalyteCode(value: string) {
  const normalized = value.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const direct = Object.entries(aliases).find(([key]) => key.normalize("NFD").replace(/[\u0300-\u036f]/g, "") === normalized);
  if (direct) return direct[1];
  return normalized.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function confirmed(results: LabResultValue[], code: string) {
  return results.find((result) => canonicalAnalyteCode(result.analyte_code || result.analyte_name) === code && result.review_status !== "pending" && result.review_status !== "rejected" && !result.is_derived && result.value !== null && Number.isFinite(result.value));
}

function glucoseMmol(result: LabResultValue | undefined) {
  if (!result || result.value === null) return null;
  const unit = (result.unit ?? "mg/dL").toLowerCase().replace(/\s/g, "");
  if (unit.includes("mmol")) return result.value;
  if (unit.includes("mg/dl") || !unit) return result.value / 18;
  return null;
}

function creatinineMgDl(result: LabResultValue | undefined) {
  if (!result || result.value === null) return null;
  const unit = (result.unit ?? "mg/dL").toLowerCase().replace(/\s/g, "");
  if (unit.includes("mg/dl") || !unit) return result.value;
  if (unit.includes("umol") || unit.includes("µmol")) return result.value / 88.4;
  return null;
}

function testosteroneNmol(result: LabResultValue | undefined) {
  if (!result || result.value === null) return null;
  const unit = (result.unit ?? "nmol/L").toLowerCase().replace(/\s/g, "");
  if (unit.includes("nmol/l")) return result.value;
  if (unit.includes("ng/dl")) return result.value * 0.0347;
  return null;
}

function albuminGL(result: LabResultValue | undefined) {
  if (!result || result.value === null) return null;
  const unit = (result.unit ?? "g/dL").toLowerCase().replace(/\s/g, "");
  if (unit === "g/l") return result.value;
  if (unit === "g/dl") return result.value * 10;
  return null;
}

function derived(params: Omit<DerivedLabResult, "input_method" | "review_status" | "is_derived">): DerivedLabResult {
  return { ...params, input_method: "derived", review_status: "confirmed", is_derived: true };
}

export function calculateDerivedLabResults(results: LabResultValue[], context: LabPatientContext): DerivedLabResult[] {
  const out: DerivedLabResult[] = [];
  const glucose = confirmed(results, "glucose");
  const insulin = confirmed(results, "insulin");
  const glucoseMmolL = glucoseMmol(glucose);

  if (glucoseMmolL !== null && insulin?.value !== null && insulin?.value !== undefined && insulin.value > 0) {
    out.push(derived({
      analyte_code: "homa_ir", analyte_name: "HOMA-IR", value: round((glucoseMmolL * insulin.value) / 22.5, 2), unit: null,
      calculation_key: "homa_ir_matthews", calculation_version: "Matthews 1985",
      dependencies: [glucose?.id ?? "glucose", insulin.id ?? "insulin"],
      source_note: "Calculado a partir de glicemia e insulina de jejum confirmadas.",
    }));
    if (glucoseMmolL > 3.5) {
      out.push(derived({
        analyte_code: "homa_beta", analyte_name: "HOMA-%B", value: round((20 * insulin.value) / (glucoseMmolL - 3.5), 1), unit: "%",
        calculation_key: "homa_beta_matthews", calculation_version: "Matthews 1985",
        dependencies: [glucose?.id ?? "glucose", insulin.id ?? "insulin"],
        source_note: "Estimativa de função beta pelo modelo HOMA original.",
      }));
    }
  }

  const creatinine = confirmed(results, "creatinine");
  const scr = creatinineMgDl(creatinine);
  if (scr && scr > 0 && context.age !== null && context.age >= 18 && context.sex) {
    const kappa = context.sex === "female" ? 0.7 : 0.9;
    const alpha = context.sex === "female" ? -0.241 : -0.302;
    const ratio = scr / kappa;
    const sexFactor = context.sex === "female" ? 1.012 : 1;
    const egfr = 142 * Math.pow(Math.min(ratio, 1), alpha) * Math.pow(Math.max(ratio, 1), -1.2) * Math.pow(0.9938, context.age) * sexFactor;
    out.push(derived({
      analyte_code: "egfr_ckd_epi_2021", analyte_name: "TFGe CKD-EPI 2021", value: round(egfr, 1), unit: "mL/min/1,73m²",
      calculation_key: "ckd_epi_creatinine_2021", calculation_version: "CKD-EPI 2021",
      dependencies: [creatinine?.id ?? "creatinine", "age", "sex"],
      source_note: "Equação CKD-EPI 2021 sem coeficiente de raça; aplicável a adultos.",
    }));

    if (context.weightKg && context.weightKg > 0) {
      const sexFactorCg = context.sex === "female" ? 0.85 : 1;
      const crcl = ((140 - context.age) * context.weightKg * sexFactorCg) / (72 * scr);
      if (crcl > 0) out.push(derived({
        analyte_code: "creatinine_clearance_cg", analyte_name: "Clearance de creatinina (Cockcroft-Gault)", value: round(crcl, 1), unit: "mL/min",
        calculation_key: "cockcroft_gault", calculation_version: "Cockcroft-Gault 1976",
        dependencies: [creatinine?.id ?? "creatinine", "age", "sex", "weight"],
        source_note: `Calculado com peso de ${round(context.weightKg, 1)} kg informado na avaliação antropométrica.`,
      }));
    }
  }

  const totalT = confirmed(results, "testosterone_total");
  const shbg = confirmed(results, "shbg");
  const albumin = confirmed(results, "albumin");
  const ttNmol = testosteroneNmol(totalT);
  const shbgNmol = shbg?.value ?? null;
  const albGL = albuminGL(albumin);
  if (ttNmol !== null && ttNmol > 0 && shbgNmol !== null && shbgNmol > 0 && albGL !== null && albGL > 0) {
    const T = ttNmol * 1e-9;
    const S = shbgNmol * 1e-9;
    const A = albGL / 66500;
    const ka = 3.6e4;
    const ks = 1e9;
    const a = ka + ks + ka * ks * (S + A - T);
    const b = 1 + ks * S + ka * A - (ka + ks) * T;
    const discriminant = b * b + 4 * a * T;
    if (a > 0 && discriminant >= 0) {
      const freeMol = (-b + Math.sqrt(discriminant)) / (2 * a);
      if (freeMol > 0 && Number.isFinite(freeMol)) out.push(derived({
        analyte_code: "free_testosterone_calculated", analyte_name: "Testosterona livre calculada", value: round(freeMol * 1e12, 1), unit: "pmol/L",
        calculation_key: "vermeulen_free_testosterone", calculation_version: "Vermeulen 1999",
        dependencies: [totalT?.id ?? "testosterone_total", shbg?.id ?? "shbg", albumin?.id ?? "albumin"],
        source_note: "Cálculo por lei de ação das massas usando testosterona total, SHBG e albumina confirmadas.",
      }));
    }
  }

  addRatio(out, results, "triglycerides", "hdl", "tg_hdl_ratio", "Relação TG/HDL", "TG/HDL");
  addRatio(out, results, "total_cholesterol", "hdl", "ct_hdl_ratio", "Relação CT/HDL", "CT/HDL");
  addRatio(out, results, "ldl", "hdl", "ldl_hdl_ratio", "Relação LDL/HDL", "LDL/HDL");
  addRatio(out, results, "ast", "alt", "ast_alt_ratio", "Relação AST/ALT", "AST/ALT");
  addRatio(out, results, "neutrophils", "lymphocytes", "nlr", "Relação neutrófilos/linfócitos", "NLR");

  return out;
}

function addRatio(out: DerivedLabResult[], results: LabResultValue[], numeratorCode: string, denominatorCode: string, code: string, name: string, version: string) {
  const numerator = confirmed(results, numeratorCode);
  const denominator = confirmed(results, denominatorCode);
  if (numerator?.value === null || numerator?.value === undefined || denominator?.value === null || denominator?.value === undefined || denominator.value === 0) return;
  out.push(derived({
    analyte_code: code, analyte_name: name, value: round(numerator.value / denominator.value, 2), unit: null,
    calculation_key: code, calculation_version: version,
    dependencies: [numerator.id ?? numeratorCode, denominator.id ?? denominatorCode],
    source_note: "Relação matemática entre resultados confirmados da mesma coleta.",
  }));
}
