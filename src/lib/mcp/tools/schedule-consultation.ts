import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "schedule_consultation",
  title: "Registrar consulta",
  description: "Registra uma nova consulta para um paciente em uma data específica.",
  inputSchema: {
    patient_id: z.string().uuid().describe("ID do paciente."),
    consultation_date: z.string().trim().describe("Data da consulta no formato AAAA-MM-DD."),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async ({ patient_id, consultation_date }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("consultations")
      .insert({ patient_id, consultation_date })
      .select("id, patient_id, consultation_date, status, current_step")
      .maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: { consultation: data } };
  },
});
