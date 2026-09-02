import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Estrutura exclusivamente ingestão realmente relatada pelo paciente.
 * Não transforma perguntas, recomendações ou plano futuro em consumo alimentar.
 */
export const extractFoodRecall = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ transcript: z.string().min(1).max(30000) }).parse(input))
  .handler(async ({ data }) => {
    const { callAiJson } = await import("@/lib/ai-gateway.server");
    const parsed = await callAiJson<{
      items: { time_label: string; foods: string; amount: string; preparation: string }[];
    }>({
      instructions:
        "Você estrutura recordatório alimentar de 24 horas em português do Brasil. Extraia SOMENTE alimentos e bebidas que o PACIENTE afirma ter consumido no período relatado. " +
        "Ignore perguntas da nutricionista, exemplos, orientações, alimentos sugeridos, metas, plano futuro e frases hipotéticas. " +
        "Crie uma linha por episódio de ingestão. Preserve horário exatamente como relatado; se não houver horário objetivo, deixe time_label vazio. " +
        "Preserve alimentos, bebidas, marcas, acompanhamentos e açúcar/adoçante quando realmente mencionados. " +
        "Em amount, mantenha medidas caseiras e quantidades exatamente como faladas; se não houver quantidade, deixe vazio. " +
        "Em preparation, registre apenas preparo realmente informado; se ausente, deixe vazio. " +
        "Nunca estime gramas, calorias, porções ou composição. Nunca invente uma refeição ausente. " +
        "Se o trecho não contiver consumo alimentar do paciente, devolva items vazio.",
      input: data.transcript.slice(-24000),
      schema: {
        name: "recordatorio_alimentar_24h",
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
      effort: "medium",
    });

    return {
      items: (parsed?.items ?? []).filter((item) => item.foods.trim()),
    };
  });
