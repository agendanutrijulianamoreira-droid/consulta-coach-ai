/** Página do parecer nutricional visual entregue ao paciente (tela + impressão). */
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Printer, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/nutrios/app-shell";
import { Button } from "@/components/ui/button";
import * as db from "@/lib/nutrios/repository";
import { generateParecerTexts } from "@/lib/nutrios/parecer.functions";
import { ParecerDocument as ParecerView } from "@/components/nutrios/parecer-document";
import { ageFromBirthDate, type AnthroData } from "@/modules/avaliacao/domain/anthropometry";
import {
  buildParecerMetrics,
  metricsToPrompt,
  type ParecerDocument,
} from "@/modules/parecer/domain/parecer";

export const Route = createFileRoute("/parecer/$id")({
  head: () => ({
    meta: [
      { title: "Parecer nutricional do paciente — NutriOS" },
      {
        name: "description",
        content:
          "Parecer nutricional ilustrado, com composição corporal, score e prioridades clínicas, pronto para imprimir e entregar.",
      },
      { property: "og:title", content: "Parecer nutricional do paciente — NutriOS" },
      {
        property: "og:description",
        content:
          "Documento premium com bioimpedância, mapa corporal, metas e direcionamento nutricional.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ParecerPage,
});

function ParecerPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const consultation = useQuery({
    queryKey: ["consultation", id],
    queryFn: () => db.getConsultation(id),
  });
  const anthropometry = useQuery({
    queryKey: ["anthro", id],
    queryFn: () => db.getAnthropometry(id),
  });
  const diagnosis = useQuery({ queryKey: ["diagnosis", id], queryFn: () => db.getDiagnoses(id) });
  const saved = useQuery({
    queryKey: ["parecer", id],
    queryFn: () => db.getParecer<ParecerDocument>(id),
  });
  const history = useQuery({
    queryKey: ["patient-consultations", consultation.data?.patient_id],
    queryFn: () => db.listPatientConsultations(consultation.data!.patient_id),
    enabled: !!consultation.data?.patient_id,
  });

  const patientRow = consultation.data?.patients;
  const patient = {
    name: patientRow?.name ?? "Paciente",
    age: ageFromBirthDate(patientRow?.birth_date),
    sex: patientRow?.sex ?? null,
    evaluationDate: formatDate(consultation.data?.consultation_date),
    phase: describePhase(history.data, id),
  };

  const generate = async () => {
    setLoading(true);
    try {
      const metrics = buildParecerMetrics((anthropometry.data?.data ?? {}) as AnthroData, patient);
      const clinical = [
        consultation.data?.clinical_summary ?? "",
        (diagnosis.data?.hypotheses ?? []).join("; "),
        (diagnosis.data?.recall_flags ?? []).join("; "),
        anthropometry.data?.interpretation ?? "",
      ]
        .filter(Boolean)
        .join("\n");
      const result = await generateParecerTexts({
        data: { metrics: metricsToPrompt(metrics, patient), clinical },
      });
      if (!result.texts) throw new Error("A IA não conseguiu redigir o parecer. Tente novamente.");
      const doc: ParecerDocument = {
        patient,
        metrics,
        texts: result.texts,
        generatedAt: formatDate(new Date().toISOString()),
      };
      await db.saveParecer(id, doc);
      await queryClient.invalidateQueries({ queryKey: ["parecer", id] });
      toast.success("Parecer gerado.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppShell title="Parecer do paciente">
      <div className="mx-auto max-w-[900px] px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between print:hidden">
          <div>
            <Link
              to="/prontuario/$id"
              params={{ id }}
              className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-3.5" /> Voltar ao prontuário
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight">Parecer para o paciente</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {patient.name} · {patient.evaluationDate}
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => void generate()} disabled={loading}>
              <Sparkles /> {loading ? "Gerando…" : saved.data ? "Regerar parecer" : "Gerar parecer"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.print()}
              disabled={!saved.data}
            >
              <Printer /> Imprimir / PDF
            </Button>
          </div>
        </div>

        {saved.data ? (
          <ParecerView doc={saved.data} />
        ) : (
          <p className="rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground print:hidden">
            Preencha a antropometria e a bioimpedância na consulta e clique em “Gerar parecer” para
            montar o documento ilustrado do paciente.
          </p>
        )}
      </div>
    </AppShell>
  );
}

/** Ordinal da consulta na linha do tempo do paciente (1ª avaliação, 2ª reavaliação, ...). */
function describePhase(history: db.Consultation[] | undefined, consultationId: string): string {
  if (!history?.length) return "1ª avaliação";
  const ordered = [...history].sort(
    (a, b) =>
      a.consultation_date.localeCompare(b.consultation_date) ||
      a.created_at.localeCompare(b.created_at),
  );
  const index = ordered.findIndex((row) => row.id === consultationId);
  const position = index === -1 ? ordered.length : index + 1;
  return position <= 1 ? "1ª avaliação" : `${position}ª reavaliação`;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }).format(date);
}
