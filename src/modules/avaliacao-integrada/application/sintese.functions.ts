import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractResponseText } from "@/modules/exames/application/lab-extraction-response";
import { detectAlertTerms } from "@/modules/avaliacao-integrada/domain/fontes-readiness";
import { asAvaliacaoClient } from "@/modules/avaliacao-integrada/infrastructure/avaliacao-repository";

const ENDPOINT = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-5.6-sol";

const sinteseSchema = {
  name: "integrated_synthesis",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "key_points"],
    properties: {
      summary: { type: "string" },
      key_points: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["text", "source"],
          properties: {
            text: { type: "string" },
            source: { type: "string" },
          },
        },
      },
    },
  },
} as const;

const instructions = `Você redige uma síntese clínica preliminar para revisão de uma nutricionista especializada em saúde da mulher.
REGRAS OBRIGATÓRIAS:
- use somente as informações presentes no texto fornecido; nunca invente dados, diagnósticos ou condutas;
- cada ponto de "key_points" precisa citar exatamente de qual fonte ele vem (ex.: "anamnese", "transcrição da consulta", "exames");
- nunca sugira diagnóstico, conduta, suplementação ou prescrição — isso é decisão exclusiva da profissional;
- se os dados forem insuficientes para algum ponto, diga isso explicitamente em vez de completar com suposições;
- escreva em português do Brasil, linguagem clara e objetiva, sem terrorismo nutricional.
Este é um rascunho para revisão humana antes de qualquer uso clínico ou envio à paciente.`;

export const generateSintese = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sourcesText: z.string().min(1).max(60000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const avaliacaoSupabase = asAvaliacaoClient(context.supabase);
    const { data: terms, error: termsError } = await avaliacaoSupabase
      .from("avaliacao_alert_terms")
      .select("term")
      .eq("active", true);
    if (termsError) throw new Error(termsError.message);

    const matchedTerms = detectAlertTerms(
      data.sourcesText,
      (terms ?? []).map((row) => row.term),
    );
    if (matchedTerms.length > 0) {
      return { blocked: true as const, matchedTerms, summary: null, keyPoints: [] };
    }

    const synthesis = await callSinteseAi(data.sourcesText);
    return { blocked: false as const, matchedTerms: [], ...synthesis };
  });

async function callSinteseAi(
  sourcesText: string,
): Promise<{ summary: string; keyPoints: { text: string; source: string }[] }> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("A integração de IA para síntese não está configurada no servidor.");

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
      input: [{ role: "user", content: [{ type: "input_text", text: sourcesText }] }],
      reasoning: { effort: "low", summary: "auto" },
      text: {
        format: {
          type: "json_schema",
          name: sinteseSchema.name,
          strict: true,
          schema: sinteseSchema.schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 429)
      throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (response.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    throw new Error(
      `Não foi possível gerar a síntese (${response.status}). ${detail.slice(0, 220)}`.trim(),
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error("A IA respondeu em um formato inesperado ao gerar a síntese.");
  }

  const record = payload as { output_text?: unknown; output?: unknown };
  const text = extractResponseText(record);
  if (!text.trim()) {
    throw new Error("A geração da síntese terminou sem retornar conteúdo. Tente novamente.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("A IA respondeu em um formato inesperado ao gerar a síntese.");
  }

  const result = parsed as { summary?: unknown; key_points?: unknown };
  if (typeof result.summary !== "string" || !Array.isArray(result.key_points)) {
    throw new Error("A IA respondeu em um formato inesperado ao gerar a síntese.");
  }

  const keyPoints = result.key_points
    .filter(
      (item): item is { text: string; source: string } =>
        typeof item === "object" &&
        item !== null &&
        typeof (item as { text?: unknown }).text === "string" &&
        typeof (item as { source?: unknown }).source === "string",
    )
    .map((item) => ({ text: item.text, source: item.source }));

  return { summary: result.summary, keyPoints };
}
