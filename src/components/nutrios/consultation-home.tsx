import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Check, Circle, ClipboardList, Copy, FileText, Play, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { PatientWorkspaceDialog, type WorkspaceSection } from "@/components/nutrios/patient-workspace-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listRecentMealPlans } from "@/lib/nutrios/dashboard-repository";
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
  const consultationDates = useQuery({ queryKey: ["consultation-dates"], queryFn: db.listConsultationDates });
  const recentPlans = useQuery({ queryKey: ["dashboard-recent-plans"], queryFn: () => listRecentMealPlans(6) });
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
  const monthlyHistory = useMemo(() => buildMonthlyHistory(consultationDates.data ?? []), [consultationDates.data]);
  const maxMonth = Math.max(1, ...monthlyHistory.map((item) => item.count));

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
      queryClient.invalidateQueries({ queryKey: ["dashboard-recent-plans"] }),
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
    setWorkspace({ patientId: selectedPatientId, consultationId: latestConsultation?.id, section });
  };

  return (
    <section className="border-b border-border bg-muted/15 print:hidden">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Início</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Consulta guiada</h1>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Escolha o paciente, veja o que já foi concluído e continue exatamente do ponto que precisa de atenção.</p>
          </div>
          <Button variant="outline" onClick={() => document.getElementById("patients-heading")?.scrollIntoView({ behavior: "smooth" })}><UserRound /> Ver pacientes</Button>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_280px]">
          <div className="rounded-lg border border-border bg-background p-4">
            <div className="flex items-center gap-2 text-sm font-semibold"><Search className="size-4" /> Escolher paciente</div>
            <Input className="mt-3" value={patientSearch} onChange={(event) => setPatientSearch(event.target.value)} placeholder="Nome, CPF, telefone ou tag" aria-label="Buscar paciente para consulta guiada" />
            <div className="mt-2 max-h-56 space-y-1 overflow-y-auto">
              {matches.map((patient) => (
                <button key={patient.id} type="button" onClick={() => { setSelectedPatientId(patient.id); setPatientSearch(""); }} className={`w-full rounded-md px-3 py-2 text-left text-sm transition-colors ${selectedPatientId === patient.id ? "bg-accent text-foreground" : "hover:bg-muted"}`}>
                  <span className="block truncate font-medium">{patient.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-muted-foreground">{describePatient(patient)}</span>
                </button>
              ))}
              {!matches.length ? <p className="px-3 py-5 text-center text-xs text-muted-foreground">Nenhum paciente encontrado.</p> : null}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background p-4 sm:p-5">
            {!selectedPatient ? (
              <div className="flex min-h-64 flex-col items-center justify-center text-center"><ClipboardList className="size-8 text-muted-foreground" /><p className="mt-3 text-sm font-medium">Selecione um paciente para preparar a consulta.</p></div>
            ) : (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold">{selectedPatient.name}</h2>{selectedPatient.tags?.slice(0, 3).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div>
                    <p className="mt-1 text-xs text-muted-foreground">{latestConsultation ? `Última consulta: ${formatDate(latestConsultation.consultation_date ?? latestConsultation.created_at)}` : "Paciente sem consulta registrada"}</p>
                  </div>
                  <div className="text-right"><div className="text-xl font-semibold tabular-nums">{completedCount}/{FLOW.length}</div><div className="text-[11px] text-muted-foreground">etapas concluídas</div></div>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                  {FLOW.map((item) => {
                    const done = progress[item.section];
                    const current = latestConsultation && nextStep.section === item.section && !done;
                    return <button key={item.section} type="button" onClick={() => openStep(item.section)} className={`flex min-h-16 items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${current ? "border-foreground/30 bg-accent" : "border-border hover:bg-muted/60"}`}>
                      {done ? <Check className="size-4 shrink-0" /> : <Circle className="size-4 shrink-0 text-muted-foreground" />}
                      <span className="min-w-0"><span className="block truncate text-sm font-medium">{item.label}</span><span className="block text-[11px] text-muted-foreground">{done ? "Concluído" : current ? "Próxima etapa" : "Pendente"}</span></span>
                    </button>;
                  })}
                </div>
                <div className="mt-4 rounded-md bg-muted/45 px-4 py-3"><p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">Próxima ação</p><p className="mt-1 text-sm font-medium">{latestConsultation ? `Continuar em ${nextStep.label}` : "Iniciar a primeira consulta deste paciente"}</p></div>
              </>
            )}
          </div>

          <div className="rounded-lg border border-border bg-background p-4">
            <h2 className="text-sm font-semibold">Ações rápidas</h2>
            <div className="mt-3 grid gap-2">
              <Button className="justify-between" disabled={!selectedPatientId || newConsultation.isPending} onClick={() => selectedPatientId && newConsultation.mutate(selectedPatientId)}><span className="flex items-center gap-2"><Play /> Nova consulta guiada</span><ArrowRight /></Button>
              <Button variant="secondary" className="justify-start" disabled={!selectedPatientId || !latestConsultation} onClick={() => latestConsultation && openStep(nextStep.section)}><ArrowRight /> Continuar de onde parei</Button>
              <Button variant="outline" className="justify-start" disabled={!selectedPatientId || !latestConsultation || duplicateLast.isPending} onClick={() => selectedPatientId && latestConsultation && duplicateLast.mutate({ patientId: selectedPatientId, consultationId: latestConsultation.id })}><Copy /> Usar última consulta como base</Button>
              <Button variant="ghost" className="justify-start" disabled={!selectedPatientId} onClick={() => selectedPatientId && setWorkspace({ patientId: selectedPatientId, section: "perfil" })}><UserRound /> Abrir prontuário completo</Button>
            </div>
            <p className="mt-4 text-xs leading-5 text-muted-foreground">O modo guiado orienta a sequência, mas não bloqueia etapas. Você continua livre para entrar em qualquer módulo do prontuário.</p>
          </div>
        </div>

        <div className="mt-8 border-t border-border pt-7">
          <div className="flex items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Visão geral</p><h2 className="mt-1 text-xl font-semibold">Consultório</h2></div><p className="text-xs text-muted-foreground">Dados reais do Cach AI</p></div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <DashboardCard title="Seus pacientes" subtitle={`${patients.data?.length ?? 0} cadastrados`}>
              <div className="divide-y divide-border">
                {(patients.data ?? []).slice(0, 5).map((patient) => <button key={patient.id} type="button" onClick={() => setWorkspace({ patientId: patient.id, section: "perfil" })} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-muted/30"><div className="min-w-0"><p className="truncate text-sm font-medium">{patient.name}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">Cadastrado em {formatDate(patient.created_at)}</p></div><ArrowRight className="size-4 shrink-0 text-muted-foreground" /></button>)}
              </div>
            </DashboardCard>

            <DashboardCard title="Consultas recentes" subtitle={`${recentConsultations.data?.length ?? 0} carregadas`}>
              <div className="divide-y divide-border">
                {(recentConsultations.data ?? []).slice(0, 5).map((consultation) => <button key={consultation.id} type="button" onClick={() => setWorkspace({ patientId: consultation.patient_id, consultationId: consultation.id, section: "consulta" })} className="flex w-full items-center justify-between gap-3 py-3 text-left hover:bg-muted/30"><div className="min-w-0"><p className="truncate text-sm font-medium">{consultation.patients?.name ?? "Paciente"}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatDate(consultation.consultation_date ?? consultation.created_at)} · {humanStatus(consultation.status)}</p></div><ArrowRight className="size-4 shrink-0 text-muted-foreground" /></button>)}
              </div>
            </DashboardCard>
          </div>

          <DashboardCard title="Histórico de consultas" subtitle="Últimos 13 meses" className="mt-4">
            <div className="mt-5 flex h-64 items-end gap-2 overflow-x-auto border-b border-border pb-6">
              {monthlyHistory.map((item) => <div key={item.key} className="flex min-w-14 flex-1 flex-col items-center justify-end gap-2"><span className="text-[10px] tabular-nums text-muted-foreground">{item.count}</span><div className="w-full max-w-12 rounded-t-sm bg-primary/80" style={{ height: `${Math.max(4, (item.count / maxMonth) * 180)}px` }} /><span className="text-[10px] text-muted-foreground">{item.label}</span></div>)}
            </div>
          </DashboardCard>

          <DashboardCard title="Planos alimentares recentes" subtitle="Prescrições criadas no Cach AI" className="mt-4">
            {recentPlans.isLoading ? <p className="py-8 text-sm text-muted-foreground">Carregando planos…</p> : null}
            {!recentPlans.isLoading && !recentPlans.data?.length ? <p className="py-8 text-sm text-muted-foreground">Nenhum plano alimentar registrado ainda.</p> : null}
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {(recentPlans.data ?? []).map((plan) => <button key={plan.id} type="button" onClick={() => setWorkspace({ patientId: plan.patientId, consultationId: plan.consultationId, section: "plano" })} className="rounded-md border border-border p-3 text-left hover:bg-muted/30"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-medium">{plan.patientName}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatDate(plan.consultationDate)}</p></div><FileText className="size-4 shrink-0 text-muted-foreground" /></div><p className="mt-3 text-xs text-muted-foreground">{plan.kcal != null ? `${Math.round(plan.kcal)} kcal` : "Energia não informada"}{plan.proteinG != null ? ` · P ${Math.round(plan.proteinG)} g` : ""}</p></button>)}
            </div>
          </DashboardCard>
        </div>
      </div>

      <PatientWorkspaceDialog open={!!workspace} patientId={workspace?.patientId ?? null} initialConsultationId={workspace?.consultationId} initialSection={workspace?.section} onOpenChange={(open) => { if (!open) setWorkspace(null); }} />
    </section>
  );
}

function DashboardCard({ title, subtitle, className = "", children }: { title: string; subtitle: string; className?: string; children: React.ReactNode }) {
  return <section className={`rounded-lg border border-border bg-background p-4 sm:p-5 ${className}`}><div className="flex items-start justify-between gap-4"><div><h3 className="text-base font-semibold">{title}</h3><p className="mt-1 text-xs text-muted-foreground">{subtitle}</p></div></div><div className="mt-2">{children}</div></section>;
}

function buildProgress(history: historyDb.ClinicalModuleHistory | undefined, consultationId: string | null) {
  const result: Record<WorkspaceSection, boolean> = { perfil: false, consulta: false, anamnese: false, antropometria: false, calculos: false, recordatorio: false, diagnostico: false, plano: false, parecer: false, historico: false };
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

function buildMonthlyHistory(rows: { consultation_date: string }[]) {
  const now = new Date();
  const months = Array.from({ length: 13 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (12 - index), 1);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return { key, label: new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" }).format(date).replace(" de ", "/"), count: 0 };
  });
  const byKey = new Map(months.map((item) => [item.key, item]));
  rows.forEach((row) => {
    const date = new Date(`${row.consultation_date.slice(0, 10)}T12:00:00`);
    if (Number.isNaN(date.getTime())) return;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    const item = byKey.get(key);
    if (item) item.count += 1;
  });
  return months;
}

function humanStatus(status: string) {
  if (status === "completed") return "Concluída";
  if (status === "in_progress") return "Em andamento";
  return status || "Registrada";
}

function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }

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
