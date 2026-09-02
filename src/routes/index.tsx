import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowRight, CalendarClock, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/nutrios/app-shell";
import { PatientDialog } from "@/components/nutrios/patient-dialog";
import { PatientWorkspaceDialog, type WorkspaceSection } from "@/components/nutrios/patient-workspace-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import {
  createConsultation,
  deletePatient,
  listConsultationDates,
  listConsultations,
  listPatients,
  type Patient,
} from "@/lib/nutrios/repository";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pacientes — Cach AI" },
      { name: "description", content: "Central de pacientes e consultas clínicas do Cach AI." },
      { property: "og:title", content: "Pacientes — Cach AI" },
      { property: "og:description", content: "Inicie consultas e acompanhe a documentação clínica em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

type WorkspaceState = {
  patientId: string;
  consultationId?: string | undefined;
  section?: WorkspaceSection | undefined;
} | null;

function Home() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [removing, setRemoving] = useState<Patient | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceState>(null);
  const patients = useQuery({ queryKey: ["patients"], queryFn: listPatients });
  const consultations = useQuery({ queryKey: ["consultations"], queryFn: listConsultations });
  const consultationDates = useQuery({ queryKey: ["consultation-dates"], queryFn: listConsultationDates });
  const stats = useMemo(() => summarize(consultationDates.data ?? []), [consultationDates.data]);
  const allTags = useMemo(
    () => Array.from(new Set((patients.data ?? []).flatMap((patient) => patient.tags ?? []))).sort(),
    [patients.data],
  );
  const filteredPatients = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (patients.data ?? []).filter((patient) => {
      const matchesTerm =
        !term ||
        patient.name.toLowerCase().includes(term) ||
        ((patient.cpf ?? "").replace(/\D/g, "").includes(term.replace(/\D/g, "")) && !!term.replace(/\D/g, ""));
      const matchesTag = !tagFilter || (patient.tags ?? []).includes(tagFilter);
      return matchesTerm && matchesTag;
    });
  }, [patients.data, search, tagFilter]);

  const removePatient = useMutation({
    mutationFn: (id: string) => deletePatient(id),
    onSuccess: () => {
      setRemoving(null);
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      toast.success("Paciente excluído.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startConsultation = useMutation({
    mutationFn: (patientId: string) => createConsultation(patientId),
    onSuccess: (consultation) => {
      void queryClient.invalidateQueries({ queryKey: ["consultation-dates"] });
      void queryClient.invalidateQueries({ queryKey: ["consultations"] });
      setWorkspace({ patientId: consultation.patient_id, consultationId: consultation.id, section: "consulta" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex flex-col justify-between gap-5 border-b border-border pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Consultório</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Pacientes</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">Comece pelo paciente. O Cach AI reúne cadastro, consulta e documentação clínica em uma única experiência.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:min-w-56">
            <Metric icon={<Users />} label="Pacientes" value={patients.data?.length ?? 0} />
            <Metric icon={<Activity />} label="Consultas" value={consultations.data?.length ?? 0} />
          </div>
        </header>

        <div className="mt-6">
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus /> Novo paciente</Button>
        </div>

        <section aria-label="Volume de consultas" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric icon={<CalendarClock />} label="Hoje" value={stats.today} />
          <Metric icon={<CalendarClock />} label="Esta semana" value={stats.week} />
          <Metric icon={<CalendarClock />} label="Este mês" value={stats.month} />
          <Metric icon={<Activity />} label="Média mensal (12m)" value={stats.monthlyAverage} />
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <section aria-labelledby="patients-heading">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 id="patients-heading" className="text-sm font-semibold">Cadastrados</h2><p className="mt-1 text-xs text-muted-foreground">Selecione um paciente para abrir o prontuário.</p></div>
              <div className="relative sm:w-56"><Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar paciente" aria-label="Buscar paciente" className="h-8 pl-8 text-xs" /></div>
            </div>
            {allTags.length ? (
              <div className="mb-3 flex flex-wrap gap-1.5">
                <Badge variant={tagFilter ? "outline" : "secondary"} className="cursor-pointer" onClick={() => setTagFilter(null)}>Todas</Badge>
                {allTags.map((tag) => (
                  <Badge key={tag} variant={tagFilter === tag ? "secondary" : "outline"} className="cursor-pointer" onClick={() => setTagFilter(tagFilter === tag ? null : tag)}>{tag}</Badge>
                ))}
              </div>
            ) : null}
            <div className="divide-y divide-border rounded-md border border-border">
              {filteredPatients.length ? filteredPatients.map((patient) => (
                <div key={patient.id} className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
                  <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setWorkspace({ patientId: patient.id, section: "perfil" })}>
                    <span className="block truncate font-medium hover:underline">{patient.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{describePatient(patient)}</span>
                    {patient.tags?.length ? <span className="mt-1 flex flex-wrap gap-1">{patient.tags.map((tag) => <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>)}</span> : null}
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="icon" variant="ghost" aria-label={`Editar ${patient.name}`} onClick={() => { setEditing(patient); setDialogOpen(true); }}><Pencil /></Button>
                    <Button size="icon" variant="ghost" aria-label={`Excluir ${patient.name}`} onClick={() => setRemoving(patient)}><Trash2 /></Button>
                    <Button size="sm" variant="secondary" onClick={() => startConsultation.mutate(patient.id)} disabled={startConsultation.isPending}>Nova consulta <ArrowRight /></Button>
                  </div>
                </div>
              )) : <p className="px-3 py-8 text-sm text-muted-foreground">{search ? "Nenhum paciente encontrado." : "Nenhum paciente ainda."}</p>}
            </div>
          </section>

          <section aria-labelledby="recent-heading">
            <div className="mb-3"><h2 id="recent-heading" className="text-sm font-semibold">Consultas recentes</h2><p className="mt-1 text-xs text-muted-foreground">Retome a documentação dentro do prontuário.</p></div>
            <div className="divide-y divide-border rounded-md border border-border">
              {consultations.data?.length ? consultations.data.map((consultation) => (
                <Button key={consultation.id} variant="ghost" className="h-auto w-full justify-between rounded-none px-3 py-3 text-left" onClick={() => setWorkspace({ patientId: consultation.patient_id, consultationId: consultation.id, section: "consulta" })}>
                  <span className="min-w-0"><span className="block truncate font-medium">{consultation.patients?.name ?? "Paciente"}</span><span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="size-3" />{formatDate(consultation.consultation_date ?? consultation.created_at)}</span></span>
                  <span className="shrink-0 text-xs text-muted-foreground">{consultation.status === "finalizada" ? "Finalizada" : "Em aberto"}</span>
                </Button>
              )) : <p className="px-3 py-8 text-sm text-muted-foreground">Nenhuma consulta registrada.</p>}
            </div>
          </section>
        </div>
      </div>

      <PatientDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        patient={editing}
        onOpenWorkspace={(patientId, consultationId) => setWorkspace({ patientId, consultationId, section: consultationId ? "consulta" : "perfil" })}
      />
      <PatientWorkspaceDialog
        open={!!workspace}
        patientId={workspace?.patientId ?? null}
        initialConsultationId={workspace?.consultationId}
        initialSection={workspace?.section}
        onOpenChange={(open) => { if (!open) setWorkspace(null); }}
      />
      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita. Pacientes com consultas registradas não podem ser excluídos.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(event) => { event.preventDefault(); if (removing) removePatient.mutate(removing.id); }} disabled={removePatient.isPending}>
              {removePatient.isPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-md border border-border px-3 py-2"><div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div><div className="mt-1 text-xl font-semibold tabular-nums">{value}</div></div>;
}

function formatDate(value: string) {
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function summarize(rows: { consultation_date: string }[]) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const weekStart = startOfWeek.toISOString().slice(0, 10);
  const monthStart = `${today.slice(0, 7)}-01`;
  const yearAgo = new Date(now);
  yearAgo.setFullYear(now.getFullYear() - 1);
  const yearStart = yearAgo.toISOString().slice(0, 10);
  const lastYear = rows.filter((row) => row.consultation_date >= yearStart).length;
  return {
    today: rows.filter((row) => row.consultation_date === today).length,
    week: rows.filter((row) => row.consultation_date >= weekStart).length,
    month: rows.filter((row) => row.consultation_date >= monthStart).length,
    monthlyAverage: Math.round((lastYear / 12) * 10) / 10,
  };
}

function describePatient(patient: Patient) {
  const parts: string[] = [];
  if (patient.birth_date) {
    const age = Math.floor((Date.now() - new Date(patient.birth_date).getTime()) / 31557600000);
    if (Number.isFinite(age) && age >= 0) parts.push(`${age} anos`);
  }
  if (patient.sex) parts.push(patient.sex === "feminino" ? "Feminino" : "Masculino");
  if (patient.is_pregnant) parts.push(patient.pregnancy_weeks ? `Gestante · ${patient.pregnancy_weeks} sem` : "Gestante");
  if (patient.cpf) parts.push(patient.cpf);
  if (patient.phone) parts.push(patient.phone);
  if (patient.email) parts.push(patient.email);
  return parts.join(" · ") || "Cadastro incompleto";
}
