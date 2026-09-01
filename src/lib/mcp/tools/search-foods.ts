import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "search_foods",
  title: "Buscar alimentos",
  description: "Consulta a base de alimentos do NutriOS com nome, porção e macronutrientes.",
  inputSchema: {
    search: z.string().trim().optional().describe("Nome ou parte do nome do alimento."),
    meal_slot: z
      .enum(["cafe", "lanche", "almoco", "jantar", "ceia"])
      .optional()
      .describe("Refeição em que o alimento pode ser usado."),
    limit: z.number().int().min(1).max(100).default(25),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, meal_slot, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("foods")
      .select("id, name, group_name, category, portion_grams, household_measure, kcal, protein_g, carb_g, fat_g, fiber_g, tags, meal_slots")
      .order("name")
      .limit(limit ?? 25);
    if (search) query = query.ilike("name", `%${search}%`);
    if (meal_slot) query = query.contains("meal_slots", [meal_slot]);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data ?? []) }], structuredContent: { foods: data ?? [] } };
  },
});
