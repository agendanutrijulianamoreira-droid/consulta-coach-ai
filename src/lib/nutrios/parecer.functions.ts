/**
 * Redação dos textos do Parecer Nutricional (camada de aplicação, servidor).
 *
 * A IA não calcula nem classifica: recebe os indicadores já calculados pelo
 * domínio e devolve apenas os textos revisáveis (interpretação, prioridades,
 * metas), respeitando o tom e as restrições clínicas da Dra. Juliana Moreira.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const INSTRUCTIONS = [
  "Você redige os textos do parecer nutricional da Dra. Juliana Moreira (CRN-9 22234), especialista em Nutrição Funcional e Saúde da Mulher.",
  "Escreva em português do Brasil, dirigido ao paciente, com tom acolhedor, técnico e orientador — nunca alarmista.",
  "Use APENAS os indicadores fornecidos. Não recalcule, não invente valores, não exiba fórmulas nem valores intermediários.",
  "Termos proibidos: grave, crítico, incompatível, disfunção mitocondrial, risco cardiometabólico (use 'risco elevado').",
  "Nunca inclua doses de suplemento, déficit calórico em kcal/dia nem meta de perda de gordura em kg.",
  "Cada achado de atenção deve vir pareado com um ponto positivo.",
  "interpretacao_1: parágrafo com a leitura geral do caso (IMC, gordura, músculo, idade metabólica quando houver).",
  "interpretacao_2: parágrafo com os achados favoráveis e a distribuição de gordura/circunferências, sempre com perspectiva de evolução.",
  "prioridades: exatamente 5 itens, título curto e texto de 2 a 4 frases com direcionamento prático de alimentação brasileira do dia a dia.",
  "metas: de 3 a 5 linhas comparando o valor atual, a meta de 60-90 dias e a meta final, sempre enquadrada como primeira etapa de uma jornada multiciclo.",
  "nota_metas: uma frase curta lembrando que as metas são reavaliadas a cada ciclo.",
].join(" ");

const SCHEMA = {
  name: "parecer_textos",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["interpretacao_1", "interpretacao_2", "prioridades", "metas", "nota_metas"],
    properties: {
      interpretacao_1: { type: "string" },
      interpretacao_2: { type: "string" },
      prioridades: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["titulo", "texto"],
          properties: { titulo: { type: "string" }, texto: { type: "string" } },
        },
      },
      metas: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["parametro", "atual", "meta_60_90", "meta_final"],
          properties: {
            parametro: { type: "string" },
            atual: { type: "string" },
            meta_60_90: { type: "string" },
            meta_final: { type: "string" },
          },
        },
      },
      nota_metas: { type: "string" },
    },
  },
};

export interface ParecerTextsPayload {
  interpretacao_1: string;
  interpretacao_2: string;
  prioridades: { titulo: string; texto: string }[];
  metas: { parametro: string; atual: string; meta_60_90: string; meta_final: string }[];
  nota_metas: string;
}

/** Gera os textos do parecer a partir dos indicadores já calculados. */
export const generateParecerTexts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ metrics: z.string().min(1), clinical: z.string().default("") }).parse(input),
  )
  .handler(async ({ data }) => {
    const { callAiJson } = await import("@/lib/ai-gateway.server");
    const parsed = await callAiJson<ParecerTextsPayload>({
      instructions: INSTRUCTIONS,
      input: `Indicadores calculados:\n${data.metrics}\n\nContexto clínico da consulta:\n${data.clinical.slice(-8000)}`,
      schema: SCHEMA,
      effort: "medium",
    });
    return {
      texts: parsed
        ? {
            ...parsed,
            prioridades: (parsed.prioridades ?? []).slice(0, 5),
            metas: (parsed.metas ?? []).slice(0, 6),
          }
        : null,
    };
  });
