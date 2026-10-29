import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PRE_CONSULTA_FIELDS } from "@/modules/pre-consulta/domain/pre-consulta";
import {
  getPreConsultaForm,
  submitPreConsultaForm,
} from "@/modules/pre-consulta/application/pre-consulta-public.functions";

export const Route = createFileRoute("/pre-consulta/$token")({
  head: () => ({ meta: [{ title: "Pré-consulta — Cach AI" }] }),
  component: PreConsultaPublicPage,
});

type LoadState =
  | { phase: "carregando" }
  | { phase: "pronto"; patientFirstName: string }
  | { phase: "enviado" }
  | { phase: "erro"; message: string };

function PreConsultaPublicPage() {
  const { token } = Route.useParams();
  const getForm = useServerFn(getPreConsultaForm);
  const submitForm = useServerFn(submitPreConsultaForm);
  const [state, setState] = useState<LoadState>({ phase: "carregando" });
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void getForm({ data: { token } })
      .then((result) => {
        if (result.state === "valido") {
          setState({ phase: "pronto", patientFirstName: result.patientFirstName });
        } else if (result.state === "respondido") {
          setState({ phase: "enviado" });
        } else if (result.state === "expirado") {
          setState({
            phase: "erro",
            message: "Este link expirou. Peça um novo à sua nutricionista.",
          });
        } else {
          setState({ phase: "erro", message: "Este link não é válido." });
        }
      })
      .catch(() => setState({ phase: "erro", message: "Não foi possível carregar o formulário." }));
  }, [getForm, token]);

  async function handleSubmit() {
    setSubmitting(true);
    try {
      await submitForm({ data: { token, respostas: answers } });
      setState({ phase: "enviado" });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível enviar suas respostas.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen justify-center bg-muted/20 px-4 py-10">
      <div className="w-full max-w-xl space-y-5">
        <header className="space-y-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Pré-consulta</h1>
          <p className="text-sm text-muted-foreground">
            Isso ajuda sua nutricionista a aproveitar melhor sua consulta. Não existe resposta certa
            ou errada, e tudo aqui é privado — só ela vê suas respostas.
          </p>
        </header>

        {state.phase === "carregando" ? (
          <div className="flex justify-center py-10">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : state.phase === "erro" ? (
          <div className="rounded-lg border border-border bg-background p-6 text-center text-sm text-muted-foreground">
            {state.message}
          </div>
        ) : state.phase === "enviado" ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-background p-8 text-center">
            <ShieldCheck className="size-8 text-success" />
            <p className="font-medium">Respostas enviadas, obrigada!</p>
            <p className="text-sm text-muted-foreground">
              Sua nutricionista vai revisar tudo antes da consulta.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm">
              Oi{state.patientFirstName ? `, ${state.patientFirstName}` : ""}! Pode responder com
              suas palavras, sem pressa.
            </p>
            {PRE_CONSULTA_FIELDS.map((field) => (
              <div
                key={field.key}
                className="space-y-1.5 rounded-lg border border-border bg-background p-4"
              >
                <label htmlFor={field.key} className="text-sm font-medium">
                  {field.label}
                </label>
                <Textarea
                  id={field.key}
                  rows={2}
                  value={answers[field.key] ?? ""}
                  onChange={(e) => setAnswers((a) => ({ ...a, [field.key]: e.target.value }))}
                />
              </div>
            ))}
            <Button
              type="button"
              className="w-full"
              disabled={submitting}
              onClick={() => void handleSubmit()}
            >
              {submitting ? <Loader2 className="animate-spin" /> : null} Enviar respostas
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
