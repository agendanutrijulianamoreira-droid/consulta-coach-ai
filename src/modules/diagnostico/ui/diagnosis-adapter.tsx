import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useMemo } from "react";
import * as db from "@/lib/nutrios/repository";
import * as labDb from "@/modules/exames/infrastructure/labs-repository";
import { acceptedClinicalContext, type ClinicalReasoning } from "../domain/clinical-reasoning";
import { ClinicalReasoningPanel } from "./clinical-reasoning-panel";

export function DiagnosisPanel({ hypotheses, flags, onChange }: { hypotheses: string[]; flags: string[]; onChange: (hypotheses: string[]) => void }) {
  const { id } = useParams({ from: "/consulta/$id" });
  const consultation = useQuery({ queryKey: ["consultation", id], queryFn: () => db.getConsultation(id) });
  const anamnesis = useQuery({ queryKey: ["anamnesis", id], queryFn: () => db.getAnamnesis(id) });
  const anthropometry = useQuery({ queryKey: ["anthropometry", id], queryFn: () => db.getAnthropometry(id) });
  const recall = useQuery({ queryKey: ["recall", id], queryFn: () => db.listRecall(id) });
  const conduct = useQuery({ queryKey: ["conduct", id], queryFn: () => db.getConduct(id) });
  const segments = useQuery({ queryKey: ["segments", id], queryFn: () => db.listSegments(id) });
  const labs = useQuery({ queryKey: ["lab-results", id], queryFn: () => labDb.listLabResults(id) });

  const anamnesisText = useMemo(() => Object.entries(anamnesis.data ?? {})
    .filter(([, field]) => field?.value && field.status !== "recusado")
    .map(([key, field]) => `${key}: ${field?.value}`).join("\n"), [anamnesis.data]);
  const transcriptText = useMemo(() => (segments.data ?? []).map((segment) => `${segment.speaker}: ${segment.content}`).join("\n"), [segments.data]);
  const anthroText = useMemo(() => anthropometry.data ? `${JSON.stringify(anthropometry.data.data)}\nInterpretação revisada: ${anthropometry.data.interpretation || "—"}` : "", [anthropometry.data]);
  const energyText = useMemo(() => conduct.data?.energy ? JSON.stringify(conduct.data.energy) : "", [conduct.data?.energy]);
  const recallText = useMemo(() => JSON.stringify(recall.data ?? []), [recall.data]);
  const labText = useMemo(() => (labs.data ?? []).filter((item) => item.review_status === "confirmed" && item.value !== null).map((item) => `${item.analyte_name}: ${item.value} ${item.unit ?? ""}${item.is_derived ? ` [calculado: ${item.calculation_version ?? item.calculation_key ?? "índice derivado"}]` : " [medido]"}`).join("\n"), [labs.data]);

  const handleReasoningChange = (reasoning: ClinicalReasoning) => {
    const accepted = acceptedClinicalContext(reasoning).hypotheses.map((item) => item.title).filter(Boolean);
    if (accepted.length === hypotheses.length && accepted.every((item, index) => item === hypotheses[index])) return;
    onChange(accepted);
  };

  if (consultation.isLoading || anamnesis.isLoading || anthropometry.isLoading || recall.isLoading || conduct.isLoading || segments.isLoading || labs.isLoading) {
    return <div className="rounded-md border border-border p-6 text-sm text-muted-foreground">Reunindo os dados das etapas anteriores…</div>;
  }

  return <div className="space-y-3">
    {(hypotheses.length || flags.length) ? <div className="rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">A análise rápida acima foi registrada. A área abaixo transforma essas sugestões em raciocínio rastreável, com evidências, prioridades e validação profissional.</div> : null}
    <ClinicalReasoningPanel
      consultationId={id}
      anamnesis={`${anamnesisText}\n\nTranscrição relevante:\n${transcriptText.slice(-12000)}`}
      anthropometry={anthroText}
      energy={energyText}
      recall={recallText}
      labs={labText}
      onChange={handleReasoningChange}
    />
  </div>;
}
