import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractResponseText } from "@/modules/exames/application/lab-extraction-response";
import { detectAlertTerms } from "@/modules/avaliacao-integrada/domain/fontes-readiness";
import { asAvaliacaoClient } from "@/modules/avaliacao-integrada/infrastructure/avaliacao-repository";

const ENDPOINT = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-5.6-sol";

/**
 * Tela 2 — Síntese da paciente: começa pela vida dela e só depois entra na
 * clínica, porque é essa a ordem em que ela se reconhece no texto (conforme
 * a especificação). Os 5 campos são exatamente os pedidos: citação literal,
 * quem é/como vive, queixa principal, diagnósticos/medicamentos informados
 * e objetivo — nunca um resumo genérico.
 */
const sinteseSchema = {
  name: "sintese_paciente",
  schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "em_uma_frase",
      "quem_e_como_vive",
      "queixa_principal",
      "diagnosticos_medicamentos",
      "objetivo",
    ],
    properties: {
      em_uma_frase: { type: "string" },
      quem_e_como_vive: { type: "string" },
      queixa_principal: { type: "string" },
      diagnosticos_medicamentos: { type: "array", items: { type: "string" } },
      objetivo: { type: "string" },
    },
  },
} as const;

const instructions = `Você escreve rascunhos de avaliação clínica para uma nutricionista que atende saúde da mulher.
REGRAS OBRIGATÓRIAS:
1. Use apenas o que está nas fontes fornecidas. Nunca preencha lacuna com suposição.
2. Se não há dado para um campo, escreva "sem dado" nesse campo.
3. Não diagnostique. Use "pode estar ligado a" e "sugere" em vez de afirmações clínicas definitivas.
4. Não sugira suplemento, dose nem mudança de medicamento. Se a paciente usa medicamento, incluindo análogos de GLP-1, apenas registre e sinalize para revisão da nutricionista.
5. "em_uma_frase" é uma citação quase literal da paciente, tirada da transcrição (inclua a marca de tempo entre colchetes se houver uma no texto fornecido).
6. "quem_e_como_vive" e "queixa_principal" vêm da anamnese e da consulta — comece pela experiência da paciente, depois o lado clínico.
7. "diagnosticos_medicamentos" lista só o que a própria paciente informou (anamnese), nunca o que a IA concluiu.
8. "objetivo" vem do que a paciente disse querer na consulta.
9. Tom claro e acolhedor, comida brasileira do dia a dia, sem terrorismo nutricional, sem culpa e sem promessa de resultado.
10. Escreva em português do Brasil.
Este é um rascunho para revisão humana antes de qualquer uso clínico ou envio à paciente.`;

export const generateSintese = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        sourcesText: z.string().min(1).max(60000),
        instrucaoExtra: z.string().max(2000).optional(),
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
      return { blocked: true as const, matchedTerms, sintese: null };
    }

    const userText = data.instrucaoExtra?.trim()
      ? `Instrução adicional da profissional para esta geração: ${data.instrucaoExtra.trim()}\n\n${data.sourcesText}`
      : data.sourcesText;

    const sintese = await callSinteseAi(userText);
    return { blocked: false as const, matchedTerms: [], sintese };
  });

export interface SinteseResult {
  emUmaFrase: string;
  quemEComoVive: string;
  queixaPrincipal: string;
  diagnosticosMedicamentos: string[];
  objetivo: string;
}

async function callSinteseAi(sourcesText: string): Promise<SinteseResult> {
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

  const result = parsed as {
    em_uma_frase?: unknown;
    quem_e_como_vive?: unknown;
    queixa_principal?: unknown;
    diagnosticos_medicamentos?: unknown;
    objetivo?: unknown;
  };
  if (
    typeof result.em_uma_frase !== "string" ||
    typeof result.quem_e_como_vive !== "string" ||
    typeof result.queixa_principal !== "string" ||
    !Array.isArray(result.diagnosticos_medicamentos) ||
    typeof result.objetivo !== "string"
  ) {
    throw new Error("A IA respondeu em um formato inesperado ao gerar a síntese.");
  }

  return {
    emUmaFrase: result.em_uma_frase,
    quemEComoVive: result.quem_e_como_vive,
    queixaPrincipal: result.queixa_principal,
    diagnosticosMedicamentos: result.diagnosticos_medicamentos.filter(
      (item): item is string => typeof item === "string",
    ),
    objetivo: result.objetivo,
  };
}
