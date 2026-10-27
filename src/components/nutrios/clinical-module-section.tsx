import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Copy, FileText, List, Plus, Star, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ConsultationWorkspace } from "@/components/nutrios/consultation-workspace";
import * as historyDb from "@/lib/nutrios/module-history-repository";

export type ClinicalSection = historyDb.ClinicalModuleKey;

const LABELS: Record<ClinicalSection, { singular: string; plural: string; step?: number }> = {
  consulta: { singular: "consulta", plural: "Consultas", step: 0 },
  anamnese: { singular: "anamnese", plural: "Anamneses", step: 1 },
  antropometria: { singular: "antropometria", plural: "Antropometrias", step: 2 },
  calculos: { singular: "cálculo", plural: "Cálculos", step: 3 },
  recordatorio: { singular: "recordatório", plural: "Recordatórios", step: 4 },
  diagnostico: { singular: "diagnóstico", plural: "Diagnósticos", step: 6 },
  plano: { singular: "plano alimentar", plural: "Planos alimentares", step: 7 },
  parecer: { singular: "parecer", plural: "Pareceres" },
};

type Props = {
  patientId: string;
  section: ClinicalSection;
  initialConsultationId?: string | null | undefined;
  onReportGenerated?: (() => void) | undefined;
  onOpenConsultation?: ((consultationId: string) => void) | undefined;
};

export function ClinicalModuleSection({ patientId, section, initialConsultationId = null, onReportGenerated, onOpenConsultation }: Props) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"list" | "evolution" | "editor">(initialConsultationId ? "editor" : "list");
  const [selectedId, setSelectedId] = useState<string | null>(initialConsultationId);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [removing, setRemoving] = useState<historyDb.ClinicalModuleHistory["consultations"][number] | null>(null);

  const history = useQuery({
    queryKey: ["clinical-module-history", patientId],
    queryFn: () => historyDb.getClinicalModuleHistory(patientId),
  });

  useEffect(() => {
    setSelectedId(initialConsultationId ?? null);
    setMode(initialConsultationId ? "editor" : "list");
  }, [patientId, section, initialConsultationId]);

  const entries = useMemo(() => {
    const data = history.data;
    if (!data) return [];
    return data.consultations.filter((consultation) => hasData(data, consultation.id, section));
  }, [history.data, section]);

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["clinical-module-history", patientId] }),
      queryClient.invalidateQueries({ queryKey: ["patient-dossier", patientId] }),
      queryClient.invalidateQueries({ queryKey: ["consultations"] }),
      queryClient.invalidateQueries({ queryKey: ["consultation-dates"] }),
    ]);
  };

  const createRecord = useMutation({
    mutationFn: () => historyDb.createModuleRecord(patientId, date),
    onSuccess: async (consultation) => {
      if (section === "parecer") { window.location.href = `/parecer/${consultation.id}`; return; }
      if (onOpenConsultation) { onOpenConsultation(consultation.id); await refresh(); return; }
      setSelectedId(consultation.id);
      setMode("editor");
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const duplicate = useMutation({
    mutationFn: (sourceId: string) => historyDb.duplicateClinicalModule(patientId, sourceId, section, date),
    onSuccess: async (consultation) => {
      toast.success(`${capitalize(LABELS[section].singular)} duplicado.`);
      if (section === "parecer") { window.location.href = `/parecer/${consultation.id}`; return; }
      if (onOpenConsultation) { onOpenConsultation(consultation.id); await refresh(); return; }
      setSelectedId(consultation.id);
      setMode("editor");
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const favorite = useMutation({
    mutationFn: ({ consultationId, value }: { consultationId: string; value: boolean }) => historyDb.toggleMealPlanFavorite(consultationId, value),
    onSuccess: async () => {
      await refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const label = LABELS[section];
  const remove = useMutation({
    mutationFn: (consultationId: string) => historyDb.deleteClinicalModuleRecord(consultationId, section),
    onSuccess: async () => { setRemoving(null); toast.success(`${capitalize(label.singular)} excluído somente desta aba.`); await refresh(); },
    onError: (error: Error) => toast.error(error.message),
  });
  const selectedReport = selectedId ? history.data?.reports[selectedId] : undefined;

  if (mode === "editor" && selectedId) {
    if (section === "parecer" && selectedReport) {
      return (
        <div className="mx-auto max-w-5xl px-6 py-7 lg:px-10 lg:py-9">
          <EditorBack label="Pareceres" onClick={() => setMode("list")} />
          <div className="mt-6 flex items-start justify-between gap-4 border-b border-border pb-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Parecer</p>
              <h2 className="mt-1 text-xl font-semibold tracking-tight">Parecer nutricional</h2>
            </div>
            <Button asChild variant="secondary" size="sm">
              <a href={`/prontuario/${selectedId}`}><FileText /> Abrir versão completa</a>
            </Button>
          </div>
          <div className="mt-6 whitespace-pre-wrap text-sm leading-7">{selectedReport}</div>
        </div>
      );
    }

    const step = section === "parecer" ? 7 : label.step;
    return (
      <div>
        <div className="border-b border-border px-6 py-3">
          <EditorBack label={label.plural} onClick={() => { setMode("list"); void refresh(); }} />
        </div>
        <ConsultationWorkspace
          key={`${section}-${selectedId}`}
          consultationId={selectedId}
          activeStep={step}
          embedded
          onOpenReport={() => {
            void refresh();
            if (section === "parecer") setMode("editor");
            onReportGenerated?.();
          }}
        />
      </div>
    );
  }

  const ordered = mode === "evolution" ? [...entries].reverse() : entries;
  const favoritesFirst = section === "plano" && mode === "list"
    ? [...ordered].sort((a, b) => Number(Boolean(history.data?.plans[b.id]?.isFavorite)) - Number(Boolean(history.data?.plans[a.id]?.isFavorite)))
    : ordered;

  return (
    <div className="mx-auto max-w-5xl px-6 py-7 lg:px-10 lg:py-9">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">{mode === "evolution" ? "Evolução" : "Registros"}</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{label.plural}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{mode === "evolution" ? "Acompanhe a sequência dos registros ao longo do tempo." : `Cadastre, abra e duplique ${label.plural.toLowerCase()} sem perder versões anteriores.`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-border p-0.5">
            <Button type="button" size="sm" variant={mode === "list" ? "secondary" : "ghost"} className="h-7" onClick={() => setMode("list")}><List /> Registros</Button>
            <Button type="button" size="sm" variant={mode === "evolution" ? "secondary" : "ghost"} className="h-7" onClick={() => setMode("evolution")}><TrendingUp /> Evolução</Button>
          </div>
          <Input aria-label="Data do novo registro" type="date" value={date} onChange={(event) => setDate(event.target.value)} className="h-8 w-[145px] text-xs" />
          <Button size="sm" disabled={createRecord.isPending} onClick={() => createRecord.mutate()}><Plus />{createRecord.isPending ? "Abrindo…" : `Novo ${label.singular}`}</Button>
        </div>
      </div>

      {history.isLoading ? <p className="py-12 text-sm text-muted-foreground">Carregando registros…</p> : null}
      {history.isError ? <p className="py-12 text-sm text-destructive">Não foi possível carregar os registros.</p> : null}

      {!history.isLoading && !entries.length ? (
        <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
          <div className="rounded-full border border-border p-4"><FileText className="size-7 text-muted-foreground" /></div>
          <h3 className="mt-4 text-lg font-semibold">Nenhum {label.singular}</h3>
          <p className="mt-1 text-sm text-muted-foreground">Crie agora o primeiro registro para este paciente.</p>
          <Button className="mt-5" disabled={createRecord.isPending} onClick={() => createRecord.mutate()}><Plus /> Novo {label.singular}</Button>
        </div>
      ) : null}

      {entries.length ? (
        <div className={mode === "evolution" ? "mt-7 border-l border-border pl-5" : "mt-6 divide-y divide-border border-y border-border"}>
          {favoritesFirst.map((consultation) => {
            const plan = history.data?.plans[consultation.id];
            const summary = history.data ? summarize(history.data, consultation.id, section) : "";
            return (
              <div key={consultation.id} className={mode === "evolution" ? "relative py-4" : "grid gap-3 py-4 sm:grid-cols-[150px_1fr_auto] sm:items-center"}>
                {mode === "evolution" ? <span className="absolute -left-[25px] top-6 size-2 rounded-full bg-foreground" /> : null}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{formatDate(consultation.consultation_date ?? consultation.created_at)}</span>
                    {section === "plano" && plan?.isFavorite ? <Badge variant="secondary"><Star className="fill-current" /> Favorito</Badge> : null}
                  </div>
                  {mode === "evolution" ? <p className="mt-1 text-xs text-muted-foreground">{summary}</p> : null}
                </div>
                {mode === "list" ? <p className="text-xs text-muted-foreground">{summary}</p> : null}
                {mode === "list" ? (
                  <div className="flex flex-wrap items-center justify-end gap-1">
                    {section === "parecer" ? (
                      <Button asChild size="sm" variant="ghost"><a href={`/parecer/${consultation.id}`}>Abrir</a></Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => { if (onOpenConsultation) onOpenConsultation(consultation.id); else { setSelectedId(consultation.id); setMode("editor"); } }}>Abrir</Button>
                    )}
                    <Button size="sm" variant="ghost" disabled={duplicate.isPending} onClick={() => duplicate.mutate(consultation.id)}><Copy /> Duplicar</Button>
                    {section === "plano" && plan ? (
                      <Button size="sm" variant="ghost" disabled={favorite.isPending} onClick={() => favorite.mutate({ consultationId: consultation.id, value: !plan.isFavorite })}>
                        <Star className={plan.isFavorite ? "fill-current" : ""} />{plan.isFavorite ? "Desfavoritar" : "Favoritar"}
                      </Button>
                    ) : null}
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" disabled={remove.isPending} onClick={() => setRemoving(consultation)}><Trash2 /> Excluir</Button>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}
      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir {label.singular}?</AlertDialogTitle><AlertDialogDescription>Somente os dados desta aba serão excluídos. Os demais registros clínicos da consulta e o prontuário permanecerão intactos.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={remove.isPending} onClick={(event) => { event.preventDefault(); if (removing) remove.mutate(removing.id); }}>{remove.isPending ? "Excluindo…" : `Excluir ${label.singular}`}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EditorBack({ label, onClick }: { label: string; onClick: () => void }) {
  return <Button type="button" variant="ghost" size="sm" onClick={onClick}><ArrowLeft /> Voltar para {label.toLowerCase()}</Button>;
}

function hasData(history: historyDb.ClinicalModuleHistory, consultationId: string, section: ClinicalSection) {
  if (section === "consulta") return true;
  if (section === "anamnese") return (history.anamnesisCount[consultationId] ?? 0) > 0;
  if (section === "antropometria") return Object.keys(history.anthro[consultationId] ?? {}).some((key) => Boolean(history.anthro[consultationId]?.[key]));
  if (section === "calculos") return Boolean(history.calculations[consultationId]);
  if (section === "recordatorio") return (history.recallCount[consultationId] ?? 0) > 0;
  if (section === "diagnostico") {
    const diagnosis = history.diagnoses[consultationId];
    return Boolean(diagnosis && (diagnosis.hypotheses > 0 || diagnosis.priorities > 0));
  }
  if (section === "plano") return Boolean(history.plans[consultationId]);
  return Boolean(history.reports[consultationId]);
}

function summarize(history: historyDb.ClinicalModuleHistory, consultationId: string, section: ClinicalSection) {
  if (section === "consulta") {
    const consultation = history.consultations.find((item) => item.id === consultationId);
    const minutes = consultation?.duration_seconds ? Math.round(consultation.duration_seconds / 60) : 0;
    const segments = history.transcriptCount[consultationId] ?? 0;
    return `${consultation?.status === "finalizada" ? "Finalizada" : "Em aberto"}${minutes ? ` · ${minutes} min` : ""}${segments ? ` · ${segments} falas` : ""}`;
  }
  if (section === "anamnese") return `${history.anamnesisCount[consultationId] ?? 0} campos clínicos preenchidos`;
  if (section === "antropometria") {
    const anthro = history.anthro[consultationId] ?? {};
    return [anthro["peso"] ? `Peso ${anthro["peso"]} kg` : "", anthro["imc"] ? `IMC ${anthro["imc"]}` : ""].filter(Boolean).join(" · ") || "Avaliação antropométrica registrada";
  }
  if (section === "calculos") {
    const calculation = history.calculations[consultationId];
    const energy = calculation?.energy ?? {};
    const target = numberValue(energy["targetKcal"]) ?? calculation?.kcal;
    const formulaValue = energy["formula"];
    const formula = typeof formulaValue === "string" ? formulaValue : null;
    return [target ? `${Math.round(target)} kcal/dia` : "Cálculo energético registrado", formula ? `Fórmula ${formula}` : ""].filter(Boolean).join(" · ");
  }
  if (section === "recordatorio") return `${history.recallCount[consultationId] ?? 0} refeições/horários registrados`;
  if (section === "diagnostico") {
    const diagnosis = history.diagnoses[consultationId];
    return `${diagnosis?.hypotheses ?? 0} hipóteses · ${diagnosis?.priorities ?? 0} prioridades`;
  }
  if (section === "plano") {
    const plan = history.plans[consultationId];
    return [plan?.kcal ? `${Math.round(plan.kcal)} kcal` : "Plano registrado", plan?.protein_g ? `P ${Math.round(plan.protein_g)} g` : "", plan?.carb_g ? `C ${Math.round(plan.carb_g)} g` : "", plan?.fat_g ? `G ${Math.round(plan.fat_g)} g` : ""].filter(Boolean).join(" · ");
  }
  return "Parecer nutricional disponível";
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatDate(value: string) {
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function capitalize(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
