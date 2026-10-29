import { ANAMNESIS_FIELDS, type AnamnesisKey } from "@/lib/nutrios/types";

/**
 * Subconjunto da Anamnese que a paciente consegue responder sozinha, antes
 * de conhecer a nutricionista. Fica de fora o que depende de escuta clínica
 * guiada (história familiar, cirurgias, exames, antibióticos recentes etc.)
 * — isso continua sendo levantado na consulta.
 */
export const PRE_CONSULTA_KEYS: AnamnesisKey[] = [
  "objetivo_consulta",
  "queixa_principal",
  "sintomas",
  "doencas",
  "medicamentos",
  "suplementos",
  "alergias",
  "intolerancias",
  "rotina",
  "sono",
  "exercicio",
  "agua",
  "evacuacao",
  "restricoes_alimentares",
  "preferencias",
  "aversoes",
  "compulsao_desejos",
  "saude_hormonal",
  "ciclo_menstrual_climaterio",
];

export const PRE_CONSULTA_FIELDS = ANAMNESIS_FIELDS.filter((field) =>
  PRE_CONSULTA_KEYS.includes(field.key),
);

export type PreConsultaStatus = "pendente" | "respondido";
export type PreConsultaFormState = "valido" | "respondido" | "expirado" | "invalido";

export interface PreConsultaFormulario {
  id: string;
  patientId: string;
  token: string;
  status: PreConsultaStatus;
  respostas: Partial<Record<AnamnesisKey, string>> | null;
  submittedAt: string | null;
  expiresAt: string;
  createdAt: string;
}

/** Token de 256 bits — o único segredo que protege o formulário público. */
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export function buildFormUrl(origin: string, token: string): string {
  return `${origin}/pre-consulta/${token}`;
}
