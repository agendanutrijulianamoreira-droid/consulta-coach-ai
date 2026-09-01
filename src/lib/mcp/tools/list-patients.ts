import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_patients",
  title: "Listar pacientes",
  description: "Lista pacientes cadastrados no NutriOS, com busca opcional por nome, CPF ou tag.",
  inputSchema: {
    search: z.string().trim().optional().describe("Texto para filtrar por nome ou CPF."),
    tag: z.string().trim().optional().describe("Tag exata para filtrar."),
    limit: z.number().int().min(1).max(100).default(20).describe("Máximo de pacientes retornados."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ search, tag, limit }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("patients")
      .select("id, name, birth_date, sex, cpf, phone, email, tags, is_pregnant, created_at")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (search) query = query.or(`name.ilike.%${search}%,cpf.ilike.%${search}%`);
    if (tag) query = query.contains("tags", [tag]);
    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { patients: data ?? [] },
    };
  },
});
