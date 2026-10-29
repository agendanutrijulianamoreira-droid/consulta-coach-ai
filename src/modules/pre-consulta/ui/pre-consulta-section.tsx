import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Link2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import * as db from "@/lib/nutrios/repository";
import { mergeAnamnesisSuggestions } from "@/modules/consulta/domain/anamnesis";
import { PRE_CONSULTA_FIELDS, buildFormUrl } from "@/modules/pre-consulta/domain/pre-consulta";
import * as preConsultaDb from "@/modules/pre-consulta/infrastructure/pre-consulta-repository";

type Props = {
  patientId: string;
  rows: db.Consultation[];
};

export function PreConsultaSection({ patientId, rows }: Props) {
  const queryClient = useQueryClient();
  const formularioQuery = useQuery({
    queryKey: ["pre-consulta-latest", patientId],
    queryFn: () => preConsultaDb.getLatestFormulario(patientId),
  });
  const [applied, setApplied] = useState(false);

  const criar = useMutation({
    mutationFn: () => preConsultaDb.criarFormulario(patientId),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["pre-consulta-latest", patientId] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const aplicar = useMutation({
    mutationFn: async () => {
      const formulario = formularioQuery.data;
      if (!formulario?.respostas) return;
      const attendance = rows.find((row) => row.record_kind === "attendance") ?? rows[0];
      const consultation =
        attendance ??
        (await db.createConsultation(
          patientId,
          new Date().toISOString().slice(0, 10),
          undefined,
          "module",
        ));
      const current = await db.getAnamnesis(consultation.id);
      const merged = mergeAnamnesisSuggestions(current, formulario.respostas, "pré-consulta");
      await db.saveAnamnesis(consultation.id, merged);
    },
    onSuccess: () => {
      setApplied(true);
      toast.success("Respostas aplicadas como sugestão na Anamnese — revise lá campo a campo.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const formulario = formularioQuery.data;

  async function copiarLink() {
    if (!formulario) return;
    try {
      await navigator.clipboard.writeText(buildFormUrl(window.location.origin, formulario.token));
      toast.success("Link copiado — envie por WhatsApp para a paciente.");
    } catch {
      toast.error("Não foi possível copiar o link.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      <div>
        <h2 className="text-lg font-semibold">Pré-consulta</h2>
        <p className="text-sm text-muted-foreground">
          Gere um link que a paciente preenche sozinha antes da consulta — sem login. Isso cobre
          parte da Anamnese e chega como sugestão para você revisar, nunca como decisão automática.
        </p>
      </div>

      {formularioQuery.isLoading ? (
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      ) : !formulario ? (
        <Button type="button" onClick={() => criar.mutate()} disabled={criar.isPending}>
          {criar.isPending ? <Loader2 className="animate-spin" /> : <Link2 />} Gerar link de
          pré-consulta
        </Button>
      ) : (
        <div className="cach-panel space-y-3 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {formulario.status === "respondido" ? "Respondido" : "Aguardando resposta"}
            </span>
            {formulario.status === "pendente" ? (
              <Button type="button" variant="outline" size="sm" onClick={() => void copiarLink()}>
                <Copy /> Copiar link
              </Button>
            ) : null}
          </div>

          {formulario.status === "pendente" ? (
            <p className="text-xs text-muted-foreground">
              Enviado em {new Date(formulario.createdAt).toLocaleDateString("pt-BR")}. Expira em{" "}
              {new Date(formulario.expiresAt).toLocaleDateString("pt-BR")}.
            </p>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">
                Respondido em{" "}
                {formulario.submittedAt
                  ? new Date(formulario.submittedAt).toLocaleDateString("pt-BR")
                  : "—"}
                .
              </p>
              <dl className="space-y-2">
                {PRE_CONSULTA_FIELDS.map((field) => {
                  const value = formulario.respostas?.[field.key];
                  if (!value) return null;
                  return (
                    <div key={field.key}>
                      <dt className="text-xs font-semibold text-muted-foreground">{field.label}</dt>
                      <dd className="text-sm">{value}</dd>
                    </div>
                  );
                })}
              </dl>
              <Button
                type="button"
                size="sm"
                disabled={aplicar.isPending || applied}
                onClick={() => aplicar.mutate()}
              >
                {aplicar.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : applied ? (
                  <Check />
                ) : null}
                {applied ? "Aplicado à anamnese" : "Aplicar à anamnese"}
              </Button>
            </>
          )}

          {formulario.status === "respondido" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={criar.isPending}
              onClick={() => criar.mutate()}
            >
              <Link2 /> Gerar novo link
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
