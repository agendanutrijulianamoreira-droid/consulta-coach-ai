import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Cake, CalendarDays, Plus, Search, UserRound, Utensils } from "lucide-react";
import { toast } from "sonner";
import { PatientDialog } from "@/components/nutrios/patient-dialog";
import { PatientWorkspaceDialog, type WorkspaceSection } from "@/components/nutrios/patient-workspace-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { listRecentMealPlans } from "@/lib/nutrios/dashboard-repository";
import * as db from "@/lib/nutrios/repository";

type WorkspaceState = {
  patientId: string;
  consultationId?: string | undefined;
  section?: WorkspaceSection | undefined;
} | null;

export function ConsultationHome() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [patientDialogOpen, setPatientDialogOpen] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceState>(null);

  const patients = useQuery({ queryKey: ["patients"], queryFn: db.listPatients });
  const consultations = useQuery({ queryKey: ["consultations"], queryFn: db.listConsultations });
  const consultationDates = useQuery({ queryKey: ["consultation-dates"], queryFn: db.listConsultationDates });
  const recentPlans = useQuery({ queryKey: ["dashboard-recent-plans"], queryFn: () => listRecentMealPlans(6) });

  const patientRows = useMemo(() => {
    const term = normalize(search);
    return (patients.data ?? [])
      .filter((patient) => {
        if (!term) return true;
        return [patient.name, patient.cpf ?? "", patient.phone ?? "", patient.email ?? "", ...(patient.tags ?? [])]
          .some((value) => normalize(value).includes(term));
      })
      .slice(0, 5);
  }, [patients.data, search]);

  const birthdaysToday = useMemo(() => {
    const today = new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();
    return (patients.data ?? []).filter((patient) => {
      if (!patient.birth_date) return false;
      const [, mm, dd] = patient.birth_date.split("-").map(Number);
      return mm === month && dd === day;
    });
  }, [patients.data]);

  const monthlyHistory = useMemo(() => buildMonthlyHistory(consultationDates.data ?? []), [consultationDates.data]);
  const maxMonth = Math.max(1, ...monthlyHistory.map((item) => item.count));
  const stats = useMemo(() => summarizeConsultations(consultationDates.data ?? []), [consultationDates.data]);

  const startConsultation = useMutation({
    mutationFn: (patientId: string) => db.createConsultation(patientId),
    onSuccess: async (consultation) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["consultations"] }),
        queryClient.invalidateQueries({ queryKey: ["consultation-dates"] }),
      ]);
      setWorkspace({ patientId: consultation.patient_id, consultationId: consultation.id, section: "consulta" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <section className="border-b border-border bg-muted/20 print:hidden">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.85fr)]">
          <div className="rounded-lg border border-border bg-background p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold tracking-tight">Seus pacientes</h1>
                <p className="mt-1 text-xs text-muted-foreground">Total de pacientes: {patients.data?.length ?? 0}</p>
              </div>
              <div className="flex flex-wrap gap-1 text-xs">
                <Button variant="ghost" size="sm" onClick={() => document.getElementById("patients-heading")?.scrollIntoView({ behavior: "smooth" })}>Ver todos</Button>
                <Button variant="ghost" size="sm" disabled={!birthdaysToday.length} title={birthdaysToday.map((patient) => patient.name).join(", ")}>Aniversariantes ({birthdaysToday.length})</Button>
              </div>
            </div>

            <Button className="mt-5 w-full" onClick={() => setPatientDialogOpen(true)}><Plus /> Adicionar paciente</Button>

            <div className="relative mt-3">
              <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Busque por nome, CPF, telefone, e-mail ou tag" className="pl-9" />
            </div>

            <div className="mt-3 divide-y divide-border rounded-md bg-muted/35 px-3">
              {patientRows.map((patient) => (
                <div key={patient.id} className="flex items-center gap-3 py-3">
                  <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setWorkspace({ patientId: patient.id, section: "perfil" })}>
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted"><UserRound className="size-5 text-muted-foreground" /></span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{patient.name}</span>
                      <span className="mt-0.5 block truncate text-xs text-muted-foreground">{describePatient(patient)}</span>
                    </span>
                  </button>
                  <Button size="sm" variant="secondary" disabled={startConsultation.isPending} onClick={() => startConsultation.mutate(patient.id)}>Nova consulta</Button>
                </div>
              ))}
              {!patientRows.length ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum paciente encontrado.</p> : null}
            </div>
          </div>

          <div className="rounded-lg border border-border bg-background p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">Consultório</h2>
                <p className="mt-1 text-xs text-muted-foreground">Resumo operacional</p>
              </div>
              <CalendarDays className="size-5 text-muted-foreground" />
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <Metric label="Hoje" value={stats.today} />
              <Metric label="Semana" value={stats.week} />
              <Metric label="Mês" value={stats.month} />
            </div>

            <div className="mt-4 rounded-md border border-border px-3 py-3">
              <div className="flex items-center gap-2 text-sm font-medium"><Cake className="size-4" /> Aniversariantes hoje</div>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{birthdaysToday.length}</p>
              <p className="text-xs text-muted-foreground">{birthdaysToday.length ? birthdaysToday.slice(0, 2).map((patient) => patient.name).join(" · ") : "Nenhum aniversário cadastrado para hoje"}</p>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Consultas recentes</h3><span className="text-[11px] text-muted-foreground">últimas 5</span></div>
              <div className="mt-2 divide-y divide-border">
                {(consultations.data ?? []).slice(0, 5).map((consultation) => (
                  <button key={consultation.id} type="button" onClick={() => setWorkspace({ patientId: consultation.patient_id, consultationId: consultation.id, section: "consulta" })} className="flex w-full items-center justify-between gap-3 py-2.5 text-left hover:bg-muted/30">
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{consultation.patients?.name ?? "Paciente"}</span><span className="block text-xs text-muted-foreground">{formatDate(consultation.consultation_date ?? consultation.created_at)} · {humanStatus(consultation.status)}</span></span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
                {!consultations.data?.length ? <p className="py-6 text-center text-xs text-muted-foreground">Nenhuma consulta registrada.</p> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-border bg-background p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-semibold tracking-tight">Histórico de consultas</h2><p className="mt-1 text-xs text-muted-foreground">Últimos 13 meses</p></div><span className="text-xs text-muted-foreground">{stats.totalLast13Months} consultas no período</span></div>
          <div className="mt-5 flex h-64 items-end gap-2 overflow-x-auto border-b border-border pb-6">
            {monthlyHistory.map((item) => (
              <div key={item.key} className="flex min-w-14 flex-1 flex-col items-center justify-end gap-2">
                <span className="text-[10px] tabular-nums text-muted-foreground">{item.count}</span>
                <div className="w-full max-w-12 rounded-t-sm bg-primary/80" style={{ height: `${Math.max(4, (item.count / maxMonth) * 180)}px` }} />
                <span className="text-[10px] text-muted-foreground">{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-border bg-background p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-semibold tracking-tight">Prescrições recentes</h2><p className="mt-1 text-xs text-muted-foreground">Planos alimentares criados no Cach AI</p></div><Utensils className="size-5 text-muted-foreground" /></div>
          {recentPlans.isLoading ? <p className="py-8 text-sm text-muted-foreground">Carregando prescrições…</p> : recentPlans.data?.length ? (
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {recentPlans.data.map((plan) => (
                <button key={plan.id} type="button" onClick={() => setWorkspace({ patientId: plan.patientId, consultationId: plan.consultationId, section: "plano" })} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-3 text-left hover:bg-muted/35">
                  <span className="min-w-0"><span className="block truncate text-sm font-medium">{plan.patientName}</span><span className="mt-0.5 block text-xs text-muted-foreground">{formatDate(plan.consultationDate)}{plan.kcal ? ` · ${Math.round(plan.kcal)} kcal` : ""}</span><span className="mt-1 block text-[11px] text-muted-foreground">{formatMacros(plan)}</span></span>
                  <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </div>
          ) : <p className="py-8 text-sm text-muted-foreground">Nenhum plano alimentar criado ainda.</p>}
        </div>
      </div>

      <PatientDialog open={patientDialogOpen} onOpenChange={setPatientDialogOpen} onOpenWorkspace={(patientId, consultationId) => setWorkspace({ patientId, consultationId, section: consultationId ? "consulta" : "perfil" })} />
      <PatientWorkspaceDialog open={!!workspace} patientId={workspace?.patientId ?? null} initialConsultationId={workspace?.consultationId} initialSection={workspace?.section} onOpenChange={(open) => { if (!open) setWorkspace(null); }} />
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-md bg-muted/45 px-3 py-3 text-center"><div className="text-xl font-semibold tabular-nums">{value}</div><div className="mt-1 text-[11px] text-muted-foreground">{label}</div></div>;
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

function humanStatus(status: string) {
  const normalized = normalize(status);
  if (normalized.includes("complet") || normalized.includes("final")) return "Concluída";
  if (normalized.includes("cancel")) return "Cancelada";
  return "Em andamento";
}

function buildMonthlyHistory(rows: { consultation_date: string }[]) {
  const formatter = new Intl.DateTimeFormat("pt-BR", { month: "short", year: "2-digit" });
  const now = new Date();
  return Array.from({ length: 13 }, (_, index) => {
    const offset = 12 - index;
    const date = new Date(now.getFullYear(), now.getMonth() - offset, 1);
    const year = date.getFullYear();
    const month = date.getMonth();
    const count = rows.filter((row) => {
      const item = new Date(`${row.consultation_date.slice(0, 10)}T12:00:00`);
      return item.getFullYear() === year && item.getMonth() === month;
    }).length;
    return { key: `${year}-${month + 1}`, label: formatter.format(date).replace(" de ", "/"), count };
  });
}

function summarizeConsultations(rows: { consultation_date: string }[]) {
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startWeek = new Date(startToday);
  startWeek.setDate(startToday.getDate() - ((startToday.getDay() + 6) % 7));
  const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const thirteenMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  const dates = rows.map((row) => new Date(`${row.consultation_date.slice(0, 10)}T12:00:00`));
  return {
    today: dates.filter((date) => date >= startToday).length,
    week: dates.filter((date) => date >= startWeek).length,
    month: dates.filter((date) => date >= startMonth).length,
    totalLast13Months: dates.filter((date) => date >= thirteenMonthsAgo).length,
  };
}

function formatMacros(plan: { proteinG: number | null; carbG: number | null; fatG: number | null }) {
  const parts: string[] = [];
  if (plan.proteinG != null) parts.push(`P ${Math.round(plan.proteinG)}g`);
  if (plan.carbG != null) parts.push(`C ${Math.round(plan.carbG)}g`);
  if (plan.fatG != null) parts.push(`G ${Math.round(plan.fatG)}g`);
  return parts.join(" · ") || "Plano salvo";
}
