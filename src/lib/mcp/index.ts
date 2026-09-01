import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listPatients from "./tools/list-patients";
import getPatientDossier from "./tools/get-patient-dossier";
import createPatient from "./tools/create-patient";
import scheduleConsultation from "./tools/schedule-consultation";
import searchFoods from "./tools/search-foods";

// O issuer OAuth precisa ser o host direto do Supabase (o proxy publicado quebra a validação).
const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "nutri-flow-ai",
  title: "Nutri Flow AI",
  version: "0.1.0",
  instructions:
    "Ferramentas clínicas do NutriOS (Dra. Juliana Moreira). Use `list_patients` para localizar pacientes, " +
    "`get_patient_dossier` para ler a ficha completa, `create_patient` e `schedule_consultation` para registrar " +
    "novos atendimentos e `search_foods` para consultar a base de alimentos.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  // Cast necessário: defineTool infere outputSchema como `undefined`, incompatível com
  // exactOptionalPropertyTypes no tipo AnyToolDefinition esperado por defineMcp.
  tools: [listPatients, getPatientDossier, createPatient, scheduleConsultation, searchFoods] as unknown as Parameters<typeof defineMcp>[0]["tools"],
});
