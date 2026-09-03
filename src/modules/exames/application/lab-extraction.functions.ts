import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractResponseText, parseLabExtraction, type RawLabExtraction } from "./lab-extraction-response";

const ENDPOINT = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-5.6-sol";

const labSchema = {
  name: "laboratory_results",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["collection_date", "laboratory_name", "results"],
    properties: {
      collection_date: { type: ["string", "null"] },
      laboratory_name: { type: ["string", "null"] },
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["analyte_name", "analyte_code", "value", "value_text", "unit", "reference_min", "reference_max", "reference_text"],
          properties: {
            analyte_name: { type: "string" },
            analyte_code: { type: "string" },
            value: { type: ["number", "null"] },
            value_text: { type: ["string", "null"] },
            unit: { type: ["string", "null"] },
            reference_min: { type: ["number", "null"] },
            reference_max: { type: ["number", "null"] },
            reference_text: { type: ["string", "null"] },
          },
        },
      },
    },
  },
} as const;

const instructions = `Você extrai resultados de exames laboratoriais para revisão por uma nutricionista.
REGRAS OBRIGATÓRIAS:
- transcreva somente resultados realmente visíveis ou ditos;
- nunca calcule HOMA, clearance, TFGe, testosterona livre, relações ou qualquer outro índice derivado;
- nunca complete um resultado ausente por conhecimento médico;
- preserve a unidade exatamente como aparece, quando houver;
- preserve o intervalo de referência do laboratório, quando houver;
- value deve conter somente um número quando o resultado for numérico; resultados como "negativo", "reagente", "< 5" ou texto ficam em value_text;
- analyte_code deve ser uma chave curta e estável em snake_case, preferindo: glucose, insulin, creatinine, testosterone_total, shbg, albumin, triglycerides, hdl, ldl, total_cholesterol, ast, alt, neutrophils, lymphocytes quando aplicável;
- datas devem ser YYYY-MM-DD apenas quando estiverem claras no documento; caso contrário null.
O conteúdo será revisado antes de ser considerado confirmado.`;

export const extractLabsFromText = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ text: z.string().min(1).max(30000) }).parse(input))
  .handler(async ({ data }) => callLabExtraction([{ type: "input_text", text: data.text }]));

export const extractLabsFromFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({
    fileBase64: z.string().min(1).max(20_000_000),
    mimeType: z.enum(["application/pdf", "image/jpeg", "image/png", "image/webp"]),
    filename: z.string().min(1).max(160),
  }).parse(input))
  .handler(async ({ data }) => {
    const dataUrl = `data:${data.mimeType};base64,${data.fileBase64}`;
    const content = data.mimeType === "application/pdf"
      ? [
          { type: "input_text", text: "Leia o PDF inteiro e extraia todos os resultados laboratoriais visíveis, inclusive em múltiplas páginas." },
          { type: "input_file", filename: data.filename, file_data: dataUrl },
        ]
      : [
          { type: "input_text", text: "Extraia todos os resultados laboratoriais visíveis desta imagem." },
          { type: "input_image", image_url: dataUrl, detail: "high" },
        ];
    return callLabExtraction(content);
  });

async function callLabExtraction(content: Record<string, unknown>[]): Promise<RawLabExtraction> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("A integração de IA para leitura de exames não está configurada no servidor.");

  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
      "X-Lovable-AIG-SDK": "fetch",
    },
    body: JSON.stringify({
      model: MODEL,
      instructions,
      input: [{ role: "user", content }],
      reasoning: { effort: "low", summary: "auto" },
      text: { format: { type: "json_schema", name: labSchema.name, strict: true, schema: labSchema.schema } },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (response.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    if (response.status === 413) throw new Error("O arquivo é grande demais para ser processado. Divida o PDF ou envie as páginas como imagens.");
    throw new Error(`Não foi possível processar o exame (${response.status}). ${detail.slice(0, 220)}`.trim());
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("A IA respondeu em um formato inesperado ao ler o exame.");
  }

  const text = extractResponseText((payload ?? {}) as { output_text?: unknown; output?: unknown });
  if (!text.trim()) {
    throw new Error("A leitura do arquivo terminou sem retornar resultados. Tente novamente ou envie imagens das páginas do laudo.");
  }

  return parseLabExtraction(text);
}
