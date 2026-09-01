import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "create_patient",
  title: "Cadastrar paciente",
  description: "Cria um novo paciente no NutriOS com os dados básicos de cadastro.",
  inputSchema: {
    name: z.string().trim().min(2).describe("Nome completo do paciente."),
    birth_date: z.string().trim().optional().describe("Data de nascimento no formato AAAA-MM-DD."),
    sex: z.enum(["feminino", "masculino"]).optional().describe("Sexo biológico."),
    cpf: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    email: z.string().trim().email().optional(),
    tags: z.array(z.string().trim()).optional().describe("Tags para filtro (ex.: gestante, emagrecimento)."),
    notes: z.string().trim().optional().describe("Observações clínicas iniciais."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("patients")
      .insert({
        name: input.name,
        birth_date: input.birth_date ?? null,
        sex: input.sex ?? null,
        cpf: input.cpf ?? null,
        phone: input.phone ?? null,
        email: input.email ?? null,
        notes: input.notes ?? null,
        tags: input.tags ?? [],
      })
      .select()
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { patient: data } };
  },
});
