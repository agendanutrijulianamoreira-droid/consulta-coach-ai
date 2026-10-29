import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { asPreConsultaClient } from "@/modules/pre-consulta/infrastructure/pre-consulta-repository";
import { PRE_CONSULTA_KEYS } from "@/modules/pre-consulta/domain/pre-consulta";
import type { Json } from "@/integrations/supabase/types";

/**
 * Único ponto de acesso público (sem login) deste app. Usa a service role
 * apenas aqui, só para validar o token manualmente — nunca expõe a tabela
 * via policy de RLS para o papel anon. Ver o comentário na migration.
 */

const json = (value: unknown) => value as Json;

const respostasSchema = z
  .record(z.string(), z.string().max(4000))
  .refine(
    (value) => Object.keys(value).every((key) => (PRE_CONSULTA_KEYS as string[]).includes(key)),
    { message: "Campo não reconhecido no formulário de pré-consulta." },
  );

export const getPreConsultaForm = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ token: z.string().min(10).max(128) }).parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = asPreConsultaClient(supabaseAdmin);

    const { data: row, error } = await admin
      .from("preconsulta_formularios")
      .select("id, patient_id, status, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) return { state: "invalido" as const };

    const record = row as unknown as { patient_id: string; status: string; expires_at: string };
    if (record.status === "respondido") return { state: "respondido" as const };
    if (new Date(record.expires_at) < new Date()) return { state: "expirado" as const };

    const { data: patient } = await supabaseAdmin
      .from("patients")
      .select("name")
      .eq("id", record.patient_id)
      .maybeSingle();
    const patientFirstName = (patient?.name ?? "").split(" ")[0] ?? "";

    return { state: "valido" as const, patientFirstName };
  });

export const submitPreConsultaForm = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        token: z.string().min(10).max(128),
        respostas: respostasSchema,
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = asPreConsultaClient(supabaseAdmin);

    const { data: row, error } = await admin
      .from("preconsulta_formularios")
      .select("id, status, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row) throw new Error("Formulário não encontrado.");

    const record = row as unknown as { id: string; status: string; expires_at: string };
    if (record.status === "respondido") throw new Error("Este formulário já foi respondido.");
    if (new Date(record.expires_at) < new Date()) throw new Error("Este link expirou.");

    const { error: updateError } = await admin
      .from("preconsulta_formularios")
      .update({
        status: "respondido",
        respostas: json(data.respostas),
        submitted_at: new Date().toISOString(),
      })
      .eq("id", record.id);
    if (updateError) throw new Error(updateError.message);

    return { ok: true as const };
  });
