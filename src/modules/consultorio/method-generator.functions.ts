import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const catalogItemSchema = z.object({
  key: z.string().min(1).max(180),
  type: z.enum(["recipe", "material"]),
  label: z.string().min(1).max(240),
});

const inputSchema = z.object({
  name: z.string().max(120).optional().default(""),
  audience: z.string().min(2).max(500),
  objective: z.string().min(2).max(1000),
  duration: z.string().max(120).optional().default(""),
  phaseCount: z.number().int().min(1).max(6),
  priorities: z.string().max(2500).optional().default(""),
  notes: z.string().max(4000).optional().default(""),
  catalog: z.array(catalogItemSchema).max(300).default([]),
});

export type GeneratedMethodDraft = {
  name: string;
  description: string;
  phases: Array<{
    title: string;
    objective: string;
    goals: string[];
    materialKeys: string[];
  }>;
};

function methodSchema(phaseCount: number) {
  return {
    name: "metodo_clinico",
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["name", "description", "phases"],
      properties: {
        name: { type: "string" },
        description: { type: "string" },
        phases: {
          type: "array",
          minItems: phaseCount,
          maxItems: phaseCount,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["title", "objective", "goals", "materialKeys"],
            properties: {
              title: { type: "string" },
              objective: { type: "string" },
              goals: {
                type: "array",
                minItems: 2,
                maxItems: 6,
                items: { type: "string" },
              },
              materialKeys: {
                type: "array",
                maxItems: 5,
                items: { type: "string" },
              },
            },
          },
        },
      },
    },
  };
}

export const generateClinicMethod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => inputSchema.parse(input))
  .handler(async ({ data }) => {
    const { callAiJson } = await import("@/lib/ai-gateway.server");
    const allowedKeys = new Set(data.catalog.map((item) => item.key));
    const catalogText = data.catalog.length
      ? data.catalog.map((item) => `${item.key} | ${item.type === "recipe" ? "receita" : "material"} | ${item.label}`).join("\n")
      : "Nenhum item cadastrado na biblioteca.";

    const input = [
      `Nome/tema informado: ${data.name || "não definido"}`,
      `Público: ${data.audience}`,
      `Objetivo principal: ${data.objective}`,
      `Duração aproximada: ${data.duration || "não definida"}`,
      `Número de fases: ${data.phaseCount}`,
      `Prioridades: ${data.priorities || "não informadas"}`,
      `Observações da nutricionista: ${data.notes || "não informadas"}`,
      "",
      "CATÁLOGO DISPONÍVEL (use exclusivamente estas chaves em materialKeys):",
      catalogText,
    ].join("\n");

    const parsed = await callAiJson<GeneratedMethodDraft>({
      instructions: [
        "Você é um arquiteto de métodos de acompanhamento nutricional para uma nutricionista brasileira.",
        "Crie um método prático, progressivo, clinicamente coerente e fácil de aplicar em consultas reais.",
        `Gere exatamente ${data.phaseCount} fases, em sequência lógica, sem repetir objetivos entre elas.`,
        "Cada fase deve ter um título curto, um objetivo clínico/operacional claro e de 2 a 6 metas observáveis.",
        "Metas devem ser ações ou critérios acompanháveis; evite promessas de cura, resultados garantidos e linguagem diagnóstica inventada.",
        "Não prescreva doses de suplementos, medicamentos ou condutas médicas.",
        "Em materialKeys, selecione somente chaves que existam no CATÁLOGO DISPONÍVEL. Nunca invente receitas, materiais, IDs ou chaves.",
        "Se nenhum item do catálogo for claramente pertinente à fase, retorne materialKeys vazio.",
        "Selecione poucos materiais realmente úteis; não tente usar todo o catálogo.",
        "A descrição do método deve explicar a transformação, a lógica das fases e para quem ele foi pensado em português do Brasil.",
        "O resultado é um rascunho profissional para revisão da nutricionista, nunca uma decisão clínica automática.",
      ].join(" "),
      input,
      schema: methodSchema(data.phaseCount),
      effort: "medium",
    });

    const safeParsed: GeneratedMethodDraft = parsed ?? { name: "", description: "", phases: [] };
    const phases = safeParsed.phases.slice(0, data.phaseCount).map((phase, index) => ({
      title: phase.title?.trim() || `Fase ${index + 1}`,
      objective: phase.objective?.trim() || "",
      goals: (phase.goals ?? []).map((goal) => goal.trim()).filter(Boolean).slice(0, 6),
      materialKeys: [...new Set((phase.materialKeys ?? []).filter((key) => allowedKeys.has(key)))].slice(0, 5),
    }));

    return {
      draft: {
        name: safeParsed.name?.trim() || data.name.trim() || "Novo método",
        description: safeParsed.description?.trim() || "",
        phases,
      } satisfies GeneratedMethodDraft,
    };
  });
