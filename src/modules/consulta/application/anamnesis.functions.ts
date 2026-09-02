import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ANAMNESIS_FIELDS, type AnamnesisKey } from "@/lib/nutrios/types";

function anamnesisSchema() {
  const properties: Record<string, unknown> = {};
  for (const { key } of ANAMNESIS_FIELDS) properties[key] = { type: ["string", "null"] };

  return {
    name: "anamnese_clinica",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ANAMNESIS_FIELDS.map(({ key }) => key),
      properties,
    },
  };
}

export const extractClinicalAnamnesis = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ transcript: z.string().min(1).max(60000) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { callAiJson } = await import("@/lib/ai-gateway.server");
    const parsed = await callAiJson<Partial<Record<AnamnesisKey, string | null>>>({
      instructions: [
        "Você é um assistente clínico de uma nutricionista no Brasil.",
        "Extraia a anamnese exclusivamente do conteúdo efetivamente dito na transcrição.",
        "Nunca deduza diagnóstico, doença, alergia, intolerância, quantidade, dose, frequência ou comportamento não declarado.",
        "Quando a resposta do paciente for negativa (ex.: não fuma, não usa suplemento, sem alergias), registre essa negativa de forma objetiva em vez de retornar null.",
        "Preserve doses, horários e frequências de medicamentos/suplementos exatamente como foram relatados.",
        "Em objetivo_consulta registre o motivo principal do atendimento; em objetivos, os resultados que o paciente deseja alcançar.",
        "Em doencas registre apenas diagnósticos/patologias explicitamente informados. Sintomas isolados pertencem a sintomas.",
        "Em agua registre quantidade/frequência de hidratação quando disponível.",
        "Em evacuacao registre frequência, consistência e dificuldades quando relatadas.",
        "Em refeicoes_padrao resuma os horários e a organização habitual das refeições, sem substituir o recordatório de 24h.",
        "Em saude_hormonal, ciclo_menstrual_climaterio e gestacao_lactacao preencha somente quando esse contexto existir.",
        "Em dificuldades registre barreiras práticas/comportamentais relatadas; em metas, somente metas explicitamente combinadas.",
        "Se um campo não foi abordado, retorne null. Texto objetivo, clínico e em português do Brasil.",
      ].join(" "),
      input: data.transcript.slice(-50000),
      schema: anamnesisSchema(),
      effort: "medium",
    });

    return { fields: parsed ?? {} };
  });
