import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_patient_dossier",
  title: "Abrir ficha do paciente",
  description:
    "Retorna a ficha completa de um paciente: cadastro, consultas, antropometria, pareceres e planos alimentares.",
  inputSchema: {
    patient_id: z.string().uuid().describe("ID do paciente no NutriOS."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ patient_id }, ctx) => {
    if (!ctx.isAuthenticated()) return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    const supabase = supabaseForUser(ctx);

    const { data: patient, error: patientError } = await supabase
      .from("patients")
      .select("*")
      .eq("id", patient_id)
      .maybeSingle();
    if (patientError) return { content: [{ type: "text", text: patientError.message }], isError: true };
    if (!patient) return { content: [{ type: "text", text: "Paciente não encontrado" }], isError: true };

    const { data: consultations, error: consultationsError } = await supabase
      .from("consultations")
      .select("id, status, current_step, consultation_date, duration_seconds, clinical_summary, created_at")
      .eq("patient_id", patient_id)
      .order("consultation_date", { ascending: false });
    if (consultationsError) return { content: [{ type: "text", text: consultationsError.message }], isError: true };

    const ids = (consultations ?? []).map((c) => c.id);
    const [anthropometry, records, mealPlans] = ids.length
      ? await Promise.all([
          supabase.from("anthropometry").select("consultation_id, data, interpretation").in("consultation_id", ids),
          supabase.from("records").select("consultation_id, report").in("consultation_id", ids),
          supabase.from("meal_plans").select("consultation_id, totals, rationale").in("consultation_id", ids),
        ])
      : [{ data: [] }, { data: [] }, { data: [] }];

    const dossier = {
      patient,
      consultations: consultations ?? [],
      anthropometry: anthropometry.data ?? [],
      records: records.data ?? [],
      meal_plans: mealPlans.data ?? [],
    };
    return { content: [{ type: "text", text: JSON.stringify(dossier) }], structuredContent: dossier };
  },
});
