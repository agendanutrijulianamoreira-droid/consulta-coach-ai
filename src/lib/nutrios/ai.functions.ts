/**
 * Casos de uso de IA do NutriOS (camada de aplicação, executada no servidor).
 *
 * Regra do produto: a IA nunca decide alimentos, quantidades ou diagnósticos.
 * Ela apenas transcreve, extrai dados da conversa e redige textos revisáveis.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const ANAMNESIS_KEYS = [
  "queixa_principal",
  "historia_doenca",
  "sintomas",
  "medicamentos",
  "suplementos",
  "exames",
  "doencas",
  "alergias",
  "intolerancias",
  "rotina",
  "sono",
  "estresse",
  "exercicio",
  "agua",
  "evacuacao",
  "objetivos",
  "motivacao",
  "preferencias",
  "restricoes_alimentares",
] as const;

async function transcribeWav(audioBase64: string) {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("A integração de IA não está configurada no servidor.");
  const binary = Uint8Array.from(atob(audioBase64), (c) => c.charCodeAt(0));
  const form = new FormData();
  form.append("model", "openai/gpt-4o-transcribe");
  form.append("file", new Blob([binary], { type: "audio/wav" }), "trecho.wav");
  form.append("language", "pt");
  const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Falha na transcrição (${response.status}): ${detail.slice(0, 200)}`);
  }
  const result = (await response.json()) as { text?: string };
  return (result.text ?? "").trim();
}

/** Ditado simples: devolve o texto falado, sem separar interlocutores. */
export const dictate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ audioBase64: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => ({ text: await transcribeWav(data.audioBase64) }));

/** Converte a fala do recordatório em linhas estruturadas por refeição. */
export const structureRecall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ transcript: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { callAiJson } = await import("@/lib/ai-gateway.server");
    const parsed = await callAiJson<{
      items: { time_label: string; foods: string; amount: string; preparation: string }[];
    }>({
      instructions:
        "Você organiza recordatórios alimentares de 24 horas em português do Brasil. A partir do relato, " +
        "monte uma linha por refeição com horário, alimentos, quantidade relatada e modo de preparo. " +
        "Use apenas o que foi dito; deixe o campo vazio quando não houver informação. Não invente alimentos.",
      input: data.transcript.slice(-12000),
      schema: {
        name: "recordatorio",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["items"],
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["time_label", "foods", "amount", "preparation"],
                properties: {
                  time_label: { type: "string" },
                  foods: { type: "string" },
                  amount: { type: "string" },
                  preparation: { type: "string" },
                },
              },
            },
          },
        },
      },
    });
    return { items: parsed?.items ?? [] };
  });

/** Parecer nutricional completo para entregar ao paciente. */
export const generateReport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        patient: z.string(),
        anamnesis: z.string(),
        anthropometry: z.string(),
        energy: z.string(),
        diagnosis: z.string(),
        plan: z.string(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { callAi } = await import("@/lib/ai-gateway.server");
    const text = await callAi({
      instructions:
        "Redija um PARECER NUTRICIONAL completo em português do Brasil, dirigido ao paciente, em markdown, com estes " +
        "títulos em '## ': Identificação, Avaliação antropométrica, Composição corporal, Necessidades energéticas, " +
        "Interpretação clínica, Prioridades do acompanhamento, Orientações práticas, Observações finais. " +
        "Use apenas os números fornecidos, sem inventar medidas nem alimentos. Linguagem acolhedora, clara e técnica " +
        "quando necessário. Finalize com a observação de que o documento não substitui consulta médica.",
      input: `Paciente:\n${data.patient}\n\nAnamnese:\n${data.anamnesis}\n\nAntropometria e análises:\n${data.anthropometry}\n\nCálculos energéticos:\n${data.energy}\n\nDiagnóstico e sinalizações:\n${data.diagnosis}\n\nPlano alimentar:\n${data.plan}`,
      effort: "medium",
    });
    return { report: text };
  });

function anamnesisSchema() {
  const properties: Record<string, unknown> = {};
  for (const key of ANAMNESIS_KEYS) {
    properties[key] = { type: ["string", "null"] };
  }
  return {
    name: "anamnese",
    schema: {
      type: "object",
      additionalProperties: false,
      required: [...ANAMNESIS_KEYS],
      properties,
    },
  };
}

/** Transcreve um trecho de áudio e separa as falas entre nutricionista e paciente. */
export const transcribeChunk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ audioBase64: z.string().min(1), context: z.string().default("") }).parse(input),
  )
  .handler(async ({ data }) => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("A integração de IA não está configurada no servidor.");

    const binary = Uint8Array.from(atob(data.audioBase64), (c) => c.charCodeAt(0));
    const form = new FormData();
    form.append("model", "openai/gpt-4o-transcribe");
    form.append("file", new Blob([binary], { type: "audio/wav" }), "trecho.wav");
    form.append("language", "pt");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`Falha na transcrição (${response.status}): ${detail.slice(0, 200)}`);
    }

    const result = (await response.json()) as { text?: string };
    const text = (result.text ?? "").trim();
    if (!text) return { segments: [] as { speaker: string; content: string }[] };

    const { callAiJson } = await import("@/lib/ai-gateway.server");
    const parsed = await callAiJson<{ segments: { speaker: string; content: string }[] }>({
      instructions:
        "Você organiza transcrições de consultas nutricionais em português do Brasil. " +
        "Divida o texto em falas e classifique cada uma como 'nutricionista' (quem pergunta, orienta, conduz) " +
        "ou 'paciente' (quem relata sintomas, rotina, hábitos). Não invente conteúdo, não resuma, " +
        "mantenha as palavras originais e apenas corrija pontuação.",
      input: `Contexto anterior da consulta:\n${data.context.slice(-1500)}\n\nTrecho novo:\n${text}`,
      schema: {
        name: "falas",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["segments"],
          properties: {
            segments: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                required: ["speaker", "content"],
                properties: {
                  speaker: { type: "string", enum: ["nutricionista", "paciente"] },
                  content: { type: "string" },
                },
              },
            },
          },
        },
      },
    });

    if (!parsed?.segments?.length) {
      return { segments: [{ speaker: "paciente", content: text }] };
    }
    return { segments: parsed.segments.filter((s) => s.content.trim()) };
  });

/** Extrai os campos da anamnese a partir da transcrição acumulada. */
export const extractAnamnesis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ transcript: z.string().min(1) }).parse(input))
  .handler(async ({ data }) => {
    const { callAiJson } = await import("@/lib/ai-gateway.server");
    const parsed = await callAiJson<Record<string, string | null>>({
      instructions:
        "Você é assistente de uma nutricionista. Leia a transcrição da consulta e preencha os campos da anamnese " +
        "APENAS com informações realmente ditas. Se algo não foi mencionado, devolva null naquele campo. " +
        "Nunca deduza diagnósticos nem invente dados. Responda em português do Brasil, de forma objetiva.",
      input: data.transcript.slice(-20000),
      schema: anamnesisSchema(),
    });
    return { fields: parsed ?? {} };
  });

/** Resumo clínico estruturado ao concluir a anamnese. */
export const generateClinicalSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ transcript: z.string(), anamnesis: z.string() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { callAi } = await import("@/lib/ai-gateway.server");
    const text = await callAi({
      instructions:
        "Redija um resumo clínico nutricional estruturado em português do Brasil, em markdown curto, com os tópicos: " +
        "Identificação, Queixa principal, História, Hábitos, Sinais de atenção. Use apenas o que está nos dados. " +
        "Não faça diagnóstico. Máximo de 250 palavras.",
      input: `Anamnese revisada:\n${data.anamnesis}\n\nTranscrição:\n${data.transcript.slice(-12000)}`,
    });
    return { summary: text };
  });

/** Leitura automática da antropometria (evolução e risco). */
export const interpretAnthropometry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ data: z.string() }).parse(input))
  .handler(async ({ data }) => {
    const { callAi } = await import("@/lib/ai-gateway.server");
    const text = await callAi({
      instructions:
        "Interprete dados antropométricos em português do Brasil: classifique IMC, comente composição corporal e " +
        "aponte riscos observáveis. Máximo de 120 palavras. Termine sempre com: 'Sugestão para revisão profissional.'",
      input: data.data,
    });
    return { interpretation: text };
  });

/** Sinalizações do recordatório e hipóteses nutricionais (sempre como sugestão). */
export const analyzeConsultation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ anamnesis: z.string(), anthropometry: z.string(), recall: z.string() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { callAiJson } = await import("@/lib/ai-gateway.server");
    const parsed = await callAiJson<{ flags: string[]; hypotheses: string[] }>({
      instructions:
        "Analise o recordatório alimentar e os dados clínicos. Em 'flags', liste sinalizações objetivas do padrão " +
        "alimentar (excesso de açúcar, baixa proteína, baixo consumo de fibras, baixa ingestão hídrica, " +
        "ultraprocessados, poucos vegetais, padrões de horário). Em 'hypotheses', liste hipóteses nutricionais " +
        "como SUGESTÕES para revisão profissional — nunca como diagnóstico fechado. " +
        "Português do Brasil, frases curtas, no máximo 6 itens em cada lista.",
      input: `Anamnese:\n${data.anamnesis}\n\nAntropometria:\n${data.anthropometry}\n\nRecordatório:\n${data.recall}`,
      schema: {
        name: "analise",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["flags", "hypotheses"],
          properties: {
            flags: { type: "array", items: { type: "string" } },
            hypotheses: { type: "array", items: { type: "string" } },
          },
        },
      },
    });
    return { flags: parsed?.flags ?? [], hypotheses: parsed?.hypotheses ?? [] };
  });

/**
 * Justificativa do plano alimentar. O plano JÁ vem pronto do motor de regras:
 * a IA apenas explica as escolhas e escreve as orientações, sem alterar itens.
 */
export const describeMealPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ plan: z.string(), context: z.string() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { callAi } = await import("@/lib/ai-gateway.server");
    const text = await callAi({
      instructions:
        "Você recebe um plano alimentar JÁ MONTADO por um motor de regras a partir de uma base de alimentos própria. " +
        "NÃO altere, não acrescente e não remova alimentos ou quantidades. Escreva em português do Brasil, em markdown " +
        "curto: (1) por que a distribuição faz sentido para o objetivo e a fase, (2) orientações práticas de preparo e " +
        "horários, (3) pontos de atenção. Máximo de 220 palavras.",
      input: `Contexto clínico:\n${data.context}\n\nPlano gerado:\n${data.plan}`,
    });
    return { rationale: text };
  });
