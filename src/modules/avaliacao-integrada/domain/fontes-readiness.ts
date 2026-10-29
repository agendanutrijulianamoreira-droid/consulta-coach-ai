/**
 * Etapa 1 — Tela 1 (Fontes). Verifica o que já existe de verdade nesta
 * consulta antes de qualquer síntese: nunca finge que uma fonte está
 * disponível quando o recurso correspondente ainda não existe no sistema
 * (Acompanhamento via WhatsApp continua sendo etapa futura).
 */
export type FonteKey = "anamnese" | "transcricao" | "exames" | "acompanhamento" | "fotos";

export type FonteStatus = {
  key: FonteKey;
  label: string;
  implemented: boolean;
  ready: boolean;
  detail: string;
};

type AnamnesisFieldLike = { value?: string | undefined } | undefined;
type AnamnesisFields = Record<string, AnamnesisFieldLike>;
type TranscriptSegment = { content: string };
type LabResultLike = { analyte_name: string };

export function computeFontesReadiness(input: {
  anamnesisFields: AnamnesisFields;
  segments: TranscriptSegment[];
  labResults: LabResultLike[];
  photoCount: number;
}): FonteStatus[] {
  const anamneseReady = Object.values(input.anamnesisFields).some(
    (field) => typeof field?.value === "string" && field.value.trim().length > 0,
  );
  const transcricaoReady = input.segments.length > 0;
  const examesReady = input.labResults.length > 0;
  const fotosReady = input.photoCount > 0;

  return [
    {
      key: "anamnese",
      label: "Anamnese",
      implemented: true,
      ready: anamneseReady,
      detail: anamneseReady
        ? "Anamnese preenchida."
        : "Anamnese ainda não preenchida nesta consulta.",
    },
    {
      key: "transcricao",
      label: "Transcrição da consulta",
      implemented: true,
      ready: transcricaoReady,
      detail: transcricaoReady
        ? `${input.segments.length} trecho(s) transcrito(s).`
        : "Nenhuma transcrição registrada nesta consulta.",
    },
    {
      key: "exames",
      label: "Exames",
      implemented: true,
      ready: examesReady,
      detail: examesReady
        ? `${input.labResults.length} resultado(s) de exame registrado(s).`
        : "Nenhum exame registrado nesta consulta.",
    },
    {
      key: "acompanhamento",
      label: "Acompanhamento via WhatsApp",
      implemented: false,
      ready: false,
      detail: "Recurso ainda não implementado no sistema.",
    },
    {
      key: "fotos",
      label: "Evolução fotográfica",
      implemented: true,
      ready: fotosReady,
      detail: fotosReady
        ? `${input.photoCount} foto(s) de evolução registrada(s).`
        : "Nenhuma foto de evolução registrada ainda.",
    },
  ];
}

/**
 * Regra fixa e barata: verificada antes de qualquer rascunho de IA.
 * Nunca é a IA quem decide o que é um sinal de alerta.
 */
export function detectAlertTerms(sourcesText: string, terms: string[]): string[] {
  const normalized = sourcesText.toLocaleLowerCase("pt-BR");
  return terms.filter((term) => normalized.includes(term.toLocaleLowerCase("pt-BR").trim()));
}
