import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Circle, ClipboardList, Copy, Play, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { PatientWorkspaceDialog, type WorkspaceSection } from "@/components/nutrios/patient-workspace-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as historyDb from "@/lib/nutrios/module-history-repository";
import * as db from "@/lib/nutrios/repository";

const FLOW: Array<{ section: WorkspaceSection; label: string }> = [
  { section: "consulta", label: "Consulta" },
  { section: "anamnese", label: "Anamnese" },
  { section: "antropometria", label: "Antropometria" },
  { section: "calculos", label: "Cálculos" },
  { section: "recordatorio", label: "Recordatório" },
  { section: "diagnostico", label: "Diagnóstico" },
  { section: "plano", label: "Plano alimentar" },
  { section: "parecer", label: "Parecer" },
];

type WorkspaceState = {
  patientId: string;
  consultationId?: string | undefined;
  section?: WorkspaceSection | undefined;
} | null;

export function ConsultationHome() {
  const queryClient = useQueryClient();
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceState>(null);

  const patients = useQuery({ queryKey: ["patients"], queryFn: db.listPatients });
  const recentConsultations = useQuery({ queryKey: ["consultations"], queryFn: db.listConsultations });
  const patientConsultations = useQuery({
    queryKey: ["patient-consultations", selectedPatientId],
    queryFn: () => db.listPatientConsultations(selectedPatientId!),
    enabled: !!selectedPatientId,
  });
  const history = useQuery({
    queryKey: ["clinical-module-history", selectedPatientId],
    queryFn: () => historyDb.getClinicalModuleHistory(selectedPatientId!),
    enabled: !!selectedPatientId,
  });

  useEffect(() => {
    if (selectedPatientId || patients.isLoading) return;
    const latestPatientId = recentConsultations.data?.[0]?.patient_id;
    if (latestPatientId && patients.data?.some((patient) => patient.id === latestPatientId)) {
      setSelectedPatientId(latestPatientId);
      return;
    }
    if (patients.data?.[0]) setSelectedPatientId(patients.data[0].id);
  }, [selectedPatientId, patients.isLoading, patients.data, recentConsultations.data]);

  const selectedPatient = patients.data?.find((patient) => patient.id === selectedPatientId) ?? null;
  const latestConsultation = patientConsultations.data?.[0] ?? null;
  const progress = useMemo(() => buildProgress(history.data, latestConsultation?.id ?? null), [history.data, latestConsultation?.id]);
  const nextStep = FLOW.find((item) => !progress[item.section]) ?? FLOW[0]!;
  const completedCount = FLOW.filter((item) => progress[item.section]).length;

  const matches = useMemo(() => {
    const term = normalize(patientSearch);
    if (!term) return (patients.data ?? []).slice(0, 6);
    return (patients.data ?? [])
      .filter((patient) => {
        const values = [patient.name, patient.cpf ?? "", patient.phone ?? "", patient.email ?? "", ...(patient.tags ?? [])];
        return values.some((value) => normalize(value).includes(term));
      })
      .slice(0, 8);
  }, [patientSearch, patients.data]);

  const refresh = async (patientId: string) => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["consultations"] }),
      queryClient.invalidateQueries({ queryKey: ["consultation-dates"] }),
      queryClient.invalidateQueries({ queryKey: ["patient-consultations", patientId] }),
      queryClient.invalidateQueries({ queryKey: ["clinical-module-history", patientId] }),
    ]);
  };

  const newConsultation = useMutation({
    mutationFn: (patientId: string) => db.createConsultation(patientId),
    onSuccess: async (consultation) => {
      await refresh(consultation.patient_id);
      setWorkspace({ patientId: consultation.patient_id, consultationId: consultation.id, section: "consulta" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const duplicateLast = useMutation({
    mutationFn: ({ patientId, consultationId }: { patientId: string; consultationId: string }) =>
      historyDb.duplicateClinicalModule(patientId, consultationId, "consulta", new Date().toISOString().slice(0, 10)),
    onSuccess: async (consultation) => {
      toast.success("Última consulta duplicada como base.");
      await refresh(consultation.patient_id);
      setWorkspace({ patientId: consultation.patient_id, consultationId: consultation.id, section: "consulta" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openStep = (section: WorkspaceSection) => {
    if (!selectedPatientId) return;
    setWorkspace({
      patientId: selectedPatientId,
      consultationId: latestConsultation?.id,
      section,
    });
  };

  return (
    <section className="border-b border-border bg-muted/15 print:hidden">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Início</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Consulta guiada</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              Escolha o paciente, veja o que já foi concluído e continue exatamente do ponto que precisa de atenção.
            </p>
          </div>
          <Button variant="outline" onClick={() => document.getElementById("patients-heading")?.scrollIntoView({ behavior: "smooth" })}>
            <UserRound /> Ver pacientes
          </Button>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_280px]">
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Search className="size-4" /> Escolher paciente</div>
            <Input
              className="mt-3"
              value={patientSearch}
              onChange={(event) => setPatientSearch(event.target.value)}
              placeholder="Nome, CPF, telefone ou tag"
              aria-label="Buscar paciente para consulta guiada"
            />
            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
              {matches.map((patient) => (
                <button
                  key={patient.id}
                  type="button"
                  onClick={() => { setSelectedPatientId(patient.id); setPatientSearch(""); }}
                  className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${selectedPatientId === patient.id ? "bg-accent text-foreground" : "hover:bg-muted"}`}
                >
                  <span className="block truncate font-medium">{patient.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{describePatient(patient)}</span>
                </button>
              ))}
              {!matches.length ? <p className="px-3 py-5 text-center text-xs text-muted-foreground">Nenhum paciente encontrado.</p> : null}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background p-4 sm:p-5">
            {!selectedPatient ? (
              <div className="flex min-h-64 flex-col items-center justify-center text-center">
                <ClipboardList className="size-8 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">Selecione um paciente para preparar a consulta.</p>
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold">{selectedPatient.name}</h2>
                      {selectedPatient.tags?.slice(0, 3).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {latestConsultation ? `Última consulta: ${formatDate(latestConsultation.consultation_date ?? latestConsultation.created_at)}` : "Paciente sem consulta registrada"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-semibold tabular-nums">{completedCount}/{FLOW.length}</div>
                    <div className="text-[11px] text-muted-foreground">etapas concluídas</div>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {FLOW.map((item) => {
                    const done = progress[item.section];
                    const current = latestConsultation && nextStep.section === item.section && !done;
                    return (
                      <button
                        key={item.section}
                        type="button"
                        onClick={() => openStep(item.section)}
                        className={`flex min-h-16 items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${current ? "border-foreground/30 bg-accent" : "border-border hover:bg-muted/60"}`}
                      >
                        {done ? <Check className="size-4 shrink-0" /> : <Circle className="size-4 shrink-0 text-muted-foreground" />}
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{item.label}</span>
                          <span className="block text-[11px] text-muted-foreground">{done ? "Concluído" : current ? "Próxima etapa" : "Pendente"}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-4 rounded-md bg-muted/45 px-4 py-3">
                  <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Próxima ação</p>
                  <p className="mt-1 text-sm font-medium">
                    {latestConsultation ? `Continuar em ${nextStep.label}` : "Iniciar a primeira consulta deste paciente"}
                  </p>
                </div>
              </>
            )}
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">Ações rápidas</h2>
            <div className="mt-3 grid gap-2">
              <Button
                className="justify-between"
                disabled={!selectedPatientId || newConsultation.isPending}
                onClick={() => selectedPatientId && newConsultation.mutate(selectedPatientId)}
              >
                <span className="flex items-center gap-2"><Play /> Nova consulta guiada</span><ArrowRight />
              </Button>
              <Button
                variant="secondary"
                className="justify-start"
                disabled={!selectedPatientId || !latestConsultation}
                onClick={() => latestConsultation && openStep(nextStep.section)}
              >
                <ArrowRight /> Continuar de onde parei
              </Button>
              <Button
                variant="outline"
                className="justify-start"
                disabled={!selectedPatientId || !latestConsultation || duplicateLast.isPending}
                onClick={() => selectedPatientId && latestConsultation && duplicateLast.mutate({ patientId: selectedPatientId, consultationId: latestConsultation.id })}
              >
                <Copy /> Usar última consulta como base
              </Button>
              <Button variant="ghost" className="justify-start" disabled={!selectedPatientId} onClick={() => selectedPatientId && setWorkspace({ patientId: selectedPatientId, section: "perfil" })}>
                <UserRound /> Abrir prontuário completo
              </Button>
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              O modo guiado orienta a sequência, mas não bloqueia etapas. Você continua livre para entrar em qualquer módulo do prontuário.
            </p>
          </div>
        </div>
      </div>

      <PatientWorkspaceDialog
        open={!!workspace}
        patientId={workspace?.patientId ?? null}
        initialConsultationId={workspace?.consultationId}
        initialSection={workspace?.section}
        onOpenChange={(open) => { if (!open) setWorkspace(null); }}
      />
    </section>
  );
}

function buildProgress(history: historyDb.ClinicalModuleHistory | undefined, consultationId: string | null) {
  const result: Record<WorkspaceSection, boolean> = {
    perfil: false,
    consulta: false,
    anamnese: false,
    antropometria: false,
    calculos: false,
    recordatorio: false,
    diagnostico: false,
    plano: false,
    parecer: false,
    historico: false,
  };
  if (!history || !consultationId) return result;
  result.consulta = true;
  result.anamnese = (history.anamnesisCount[consultationId] ?? 0) > 0;
  result.antropometria = Object.values(history.anthro[consultationId] ?? {}).some(Boolean);
  result.calculos = Boolean(history.calculations[consultationId]);
  result.recordatorio = (history.recallCount[consultationId] ?? 0) > 0;
  const diagnosis = history.diagnoses[consultationId];
  result.diagnostico = Boolean(diagnosis && (diagnosis.hypotheses > 0 || diagnosis.priorities > 0));
  result.plano = Boolean(history.plans[consultationId]);
  result.parecer = Boolean(history.reports[consultationId]);
  return result;
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function describePatient(patient: db.Patient) {
  const parts: string[] = [];
  if (patient.birth_date) {
    const birth = new Date(`${patient.birth_date}T12:00:00`);
    const age = Math.floor((Date.now() - birth.getTime()) / 31557600000);
    if (Number.isFinite(age) && age >= 0) parts.push(`${age} anos`);
  }
  if (patient.phone) parts.push(patient.phone);
  if (patient.tags?.[0]) parts.push(patient.tags[0]);
  return parts.join(" · ") || "Cadastro disponível";
}

function formatDate(value: string) {
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}
