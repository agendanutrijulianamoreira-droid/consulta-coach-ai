import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { extractResponseText } from "@/modules/exames/application/lab-extraction-response";

const ENDPOINT = "https://ai.gateway.lovable.dev/v1/responses";
const MODEL = "openai/gpt-5.6-sol";

const resumoSchema = {
  name: "resumo_dia",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["resumo", "pontos"],
    properties: {
      resumo: { type: "string" },
      pontos: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["texto", "origem"],
          properties: {
            texto: { type: "string" },
            origem: { type: "string" },
          },
        },
      },
    },
  },
} as const;

const resumoInstructions = `Você escreve o resumo diário da fila de tarefas de um consultório de nutrição, para a profissional responsável ler no começo do dia.
REGRAS OBRIGATÓRIAS:
- use somente as tarefas fornecidas na lista; nunca invente tarefa, paciente ou situação que não esteja nela;
- no máximo 5 linhas no campo "resumo", tom direto e acolhedor;
- cada item de "pontos" cita a origem exata (nome da paciente e o tipo da tarefa) de onde veio;
- nunca sugira diagnóstico, conduta, suplementação ou prescrição — isso é decisão exclusiva da profissional;
- escreva em português do Brasil, sem terrorismo nutricional e sem alarmismo.`;

const mensagemSchema = {
  name: "rascunho_mensagem",
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["mensagem"],
    properties: {
      mensagem: { type: "string" },
    },
  },
} as const;

const mensagemInstructions = `Você escreve um rascunho de mensagem de WhatsApp da nutricionista para a paciente. A mensagem nunca é enviada automaticamente — a profissional sempre revisa e envia manualmente.
REGRAS OBRIGATÓRIAS:
- tom acolhedor e direto, no estilo de comida brasileira do dia a dia, sem terrorismo nutricional, sem culpa e sem promessa de resultado;
- no máximo 3 frases;
- nunca sugira diagnóstico, suplemento, dose ou mudança de conduta ou medicamento;
- nunca invente informação que não esteja no contexto fornecido;
- se o contexto for uma falta à consulta, convide para remarcar sem cobrança nem julgamento;
- se o contexto for aniversário, escreva uma saudação calorosa e breve;
- escreva em português do Brasil, sem assinar com um nome específico.`;

export const gerarResumoDia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        tarefas: z
          .array(
            z.object({
              titulo: z.string().min(1),
              motivo: z.string().min(1),
              pacienteNome: z.string().min(1),
              tipo: z.string().min(1),
            }),
          )
          .max(7),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    if (!data.tarefas.length) {
      return {
        resumo: "Nenhuma pendência na fila agora — tudo em dia.",
        pontos: [] as { texto: string; origem: string }[],
      };
    }
    const userText = data.tarefas
      .map((t, i) => `${i + 1}. [${t.tipo}] ${t.pacienteNome} — ${t.titulo}: ${t.motivo}`)
      .join("\n");
    const payload = await callLovableAi(
      resumoInstructions,
      userText,
      resumoSchema,
      "o resumo do dia",
    );
    const result = payload as { resumo?: unknown; pontos?: unknown };
    if (typeof result.resumo !== "string" || !Array.isArray(result.pontos)) {
      throw new Error("A IA respondeu em um formato inesperado ao gerar o resumo do dia.");
    }
    const pontos = result.pontos
      .filter(
        (item): item is { texto: string; origem: string } =>
          typeof item === "object" &&
          item !== null &&
          typeof (item as { texto?: unknown }).texto === "string" &&
          typeof (item as { origem?: unknown }).origem === "string",
      )
      .map((item) => ({ texto: item.texto, origem: item.origem }));
    return { resumo: result.resumo, pontos };
  });

export const gerarRascunhoMensagem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        pacienteNome: z.string().min(1),
        titulo: z.string().min(1),
        motivo: z.string().min(1),
        tipo: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const userText = `Paciente: ${data.pacienteNome}\nTipo da situação: ${data.tipo}\nTítulo: ${data.titulo}\nMotivo: ${data.motivo}`;
    const payload = await callLovableAi(
      mensagemInstructions,
      userText,
      mensagemSchema,
      "o rascunho da mensagem",
    );
    const result = payload as { mensagem?: unknown };
    if (typeof result.mensagem !== "string") {
      throw new Error("A IA respondeu em um formato inesperado ao gerar o rascunho da mensagem.");
    }
    return { mensagem: result.mensagem };
  });

async function callLovableAi(
  instructions: string,
  userText: string,
  schema: { name: string; schema: unknown },
  label: string,
): Promise<unknown> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey)
    throw new Error(`A integração de IA para ${label} não está configurada no servidor.`);

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
      input: [{ role: "user", content: [{ type: "input_text", text: userText }] }],
      reasoning: { effort: "low", summary: "auto" },
      text: {
        format: { type: "json_schema", name: schema.name, strict: true, schema: schema.schema },
      },
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    if (response.status === 429)
      throw new Error("Limite de uso da IA atingido. Tente novamente em instantes.");
    if (response.status === 402) throw new Error("Créditos de IA esgotados no workspace.");
    throw new Error(
      `Não foi possível gerar ${label} (${response.status}). ${detail.slice(0, 220)}`.trim(),
    );
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`A IA respondeu em um formato inesperado ao gerar ${label}.`);
  }

  const record = payload as { output_text?: unknown; output?: unknown };
  const text = extractResponseText(record);
  if (!text.trim()) {
    throw new Error(`A geração de ${label} terminou sem retornar conteúdo. Tente novamente.`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`A IA respondeu em um formato inesperado ao gerar ${label}.`);
  }
}
