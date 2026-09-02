import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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

type Extraction = {
  collection_date: string | null;
  laboratory_name: string | null;
  results: {
    analyte_name: string;
    analyte_code: string;
    value: number | null;
    value_text: string | null;
    unit: string | null;
    reference_min: number | null;
    reference_max: number | null;
    reference_text: string | null;
  }[];
};

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
      ? [{ type: "input_text", text: "Extraia todos os resultados laboratoriais deste PDF." }, { type: "input_file", filename: data.filename, file_data: dataUrl }]
      : [{ type: "input_text", text: "Extraia todos os resultados laboratoriais desta imagem." }, { type: "input_image", image_url: dataUrl, detail: "high" }];
    return callLabExtraction(content);
  });

async function callLabExtraction(content: Record<string, unknown>[]): Promise<Extraction> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("LOVABLE_API_KEY ausente");
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
      stream: true,
      reasoning: { effort: "low", summary: "auto" },
      text: { format: { type: "json_schema", name: labSchema.name, strict: true, schema: labSchema.schema } },
    }),
  });
  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => "");
    if (response.status === 429) throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (response.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    throw new Error(`Não foi possível ler o exame (${response.status}): ${detail.slice(0, 250)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let text = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      try {
        const event = JSON.parse(payload) as { type?: string; delta?: string; response?: { output_text?: string } };
        if (event.type === "response.output_text.delta" && typeof event.delta === "string") text += event.delta;
        else if (event.type === "response.completed" && !text && event.response?.output_text) text = event.response.output_text;
      } catch {
        // Evento SSE incompleto: a próxima iteração continua a leitura.
      }
    }
  }

  try {
    const parsed = JSON.parse(text) as Extraction;
    return { ...parsed, results: parsed.results.filter((result) => result.analyte_name.trim()) };
  } catch {
    throw new Error("A leitura do exame não retornou uma estrutura válida. Tente uma imagem mais nítida ou digite os valores.");
  }
}
