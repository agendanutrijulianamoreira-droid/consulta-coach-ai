import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { clinicalId, type ClinicalReasoning, type ClinicalSource } from "../domain/clinical-reasoning";

const inputSchema = z.object({
  anamnesis: z.string().max(60000),
  anthropometry: z.string().max(30000),
  energy: z.string().max(12000),
  recall: z.string().max(30000),
  labs: z.string().max(30000),
});

const sourceEnum = ["anamnese", "antropometria", "calculos", "recordatorio", "exames", "transcricao"];

export const generateClinicalReasoning = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const { callAiJson } = await import("@/lib/ai-gateway.server");
    type Raw = {
      findings: { label: string; source: ClinicalSource; detail: string }[];
      flags: string[];
      hypotheses: { title: string; rationale: string; evidence: string[] }[];
      priorities: { rank: number; title: string; rationale: string }[];
      directions: { title: string; rationale: string }[];
    };
    const parsed = await callAiJson<Raw>({
      instructions: [
        "Você atua como apoio ao raciocínio clínico de uma nutricionista brasileira.",
        "Use somente os dados fornecidos e separe rigorosamente fato, sinalização, hipótese e direcionamento nutricional.",
        "ACHADOS devem ser fatos objetivos presentes nos dados, sem inferência.",
        "FLAGS são padrões ou incompatibilidades que merecem revisão, sem linguagem alarmista.",
        "HIPÓTESES são hipóteses NUTRICIONAIS ou mecanismos plausíveis para revisão profissional; nunca declare diagnóstico médico novo como confirmado.",
        "Cada hipótese deve citar de 1 a 4 evidências concretas presentes nos dados. Não invente exame, sintoma, valor, medicamento, diagnóstico ou relação causal.",
        "Se os dados não sustentarem uma hipótese, não a inclua.",
        "PRIORIDADES devem ordenar no máximo 4 problemas nutricionais modificáveis considerando risco, impacto e possibilidade de intervenção.",
        "DIRECIONAMENTOS descrevem objetivos clínico-nutricionais, não cardápios, suplementos, medicamentos, doses ou prescrições.",
        "Exames calculados devem ser tratados como índices derivados, respeitando a identificação apresentada no texto.",
        "Não use faixas ótimas universais que não estejam fornecidas. Não contradiga referência laboratorial ou avaliação profissional.",
        "Português do Brasil, linguagem clínica objetiva e humana.",
      ].join(" "),
      input: `ANAMNESE\n${data.anamnesis || "Sem dados"}\n\nANTROPOMETRIA\n${data.anthropometry || "Sem dados"}\n\nCÁLCULOS ENERGÉTICOS\n${data.energy || "Sem dados"}\n\nRECORDATÓRIO\n${data.recall || "Sem dados"}\n\nEXAMES CONFIRMADOS\n${data.labs || "Sem exames confirmados"}`,
      schema: {
        name: "raciocinio_clinico_nutricional",
        schema: {
          type: "object",
          additionalProperties: false,
          required: ["findings", "flags", "hypotheses", "priorities", "directions"],
          properties: {
            findings: { type: "array", maxItems: 12, items: { type: "object", additionalProperties: false, required: ["label", "source", "detail"], properties: { label: { type: "string" }, source: { type: "string", enum: sourceEnum }, detail: { type: "string" } } } },
            flags: { type: "array", maxItems: 8, items: { type: "string" } },
            hypotheses: { type: "array", maxItems: 6, items: { type: "object", additionalProperties: false, required: ["title", "rationale", "evidence"], properties: { title: { type: "string" }, rationale: { type: "string" }, evidence: { type: "array", minItems: 1, maxItems: 4, items: { type: "string" } } } } },
            priorities: { type: "array", maxItems: 4, items: { type: "object", additionalProperties: false, required: ["rank", "title", "rationale"], properties: { rank: { type: "integer", minimum: 1, maximum: 4 }, title: { type: "string" }, rationale: { type: "string" } } } },
            directions: { type: "array", maxItems: 6, items: { type: "object", additionalProperties: false, required: ["title", "rationale"], properties: { title: { type: "string" }, rationale: { type: "string" } } } },
          },
        },
      },
      effort: "medium",
    });

    const raw = parsed ?? { findings: [], flags: [], hypotheses: [], priorities: [], directions: [] };
    const reasoning: ClinicalReasoning = {
      findings: raw.findings.map((item) => ({ ...item, id: clinicalId("finding", `${item.source}-${item.label}`) })),
      flags: raw.flags,
      hypotheses: raw.hypotheses.map((item) => ({ ...item, id: clinicalId("hyp", item.title), status: "suggested" as const })),
      priorities: raw.priorities.map((item) => ({ ...item, id: clinicalId("priority", item.title), status: "suggested" as const })).sort((a, b) => a.rank - b.rank),
      directions: raw.directions.map((item) => ({ ...item, id: clinicalId("direction", item.title), status: "suggested" as const })),
      version: "clinical-reasoning-v1",
    };
    return reasoning;
  });
