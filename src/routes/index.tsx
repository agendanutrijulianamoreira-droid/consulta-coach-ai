import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowRight, CalendarClock, ChevronDown, ChevronUp, Download, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/nutrios/app-shell";
import { PatientDialog } from "@/components/nutrios/patient-dialog";
import { PatientWorkspaceDialog, type WorkspaceSection } from "@/components/nutrios/patient-workspace-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { createConsultation, deletePatient, listConsultationDates, listConsultations, listPatients, type Patient } from "@/lib/nutrios/repository";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Pacientes — Cach AI" }, { name: "description", content: "Central de pacientes e consultas clínicas do Cach AI." }] }),
  component: Home,
});

type WorkspaceState = { patientId: string; consultationId?: string | undefined; section?: WorkspaceSection | undefined } | null;
type PeriodFilter = "all" | "1m" | "2m" | "3m" | "custom";
type SortMode = "modified" | "created" | "alpha";
type SexFilter = "all" | "masculino" | "feminino";
type PatientWithUpdatedAt = Patient & { updated_at?: string };

function Home() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createdPeriod, setCreatedPeriod] = useState<PeriodFilter>("all");
  const [modifiedPeriod, setModifiedPeriod] = useState<PeriodFilter>("all");
  const [createdStart, setCreatedStart] = useState("");
  const [createdEnd, setCreatedEnd] = useState("");
  const [modifiedStart, setModifiedStart] = useState("");
  const [modifiedEnd, setModifiedEnd] = useState("");
  const [sexFilter, setSexFilter] = useState<SexFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("modified");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [removing, setRemoving] = useState<Patient | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<WorkspaceState>(null);
  const patients = useQuery({ queryKey: ["patients"], queryFn: listPatients });
  const consultations = useQuery({ queryKey: ["consultations"], queryFn: listConsultations });
  const consultationDates = useQuery({ queryKey: ["consultation-dates"], queryFn: listConsultationDates });
  const stats = useMemo(() => summarize(consultationDates.data ?? []), [consultationDates.data]);
  const allTags = useMemo(() => Array.from(new Set((patients.data ?? []).flatMap((patient) => patient.tags ?? []))).sort(), [patients.data]);

  const filteredPatients = useMemo(() => {
    const term = normalize(search);
    const digits = search.replace(/\D/g, "");
    const rows = (patients.data ?? []).filter((patient) => {
      const searchable = [patient.name, patient.email ?? "", patient.phone ?? "", ...(patient.tags ?? [])].map(normalize);
      const matchesTerm = !term || searchable.some((value) => value.includes(term)) || (!!digits && (patient.cpf ?? "").replace(/\D/g, "").includes(digits));
      const matchesTag = !tagFilter || (patient.tags ?? []).includes(tagFilter);
      const matchesSex = sexFilter === "all" || normalize(patient.sex ?? "") === sexFilter;
      const created = patient.created_at;
      const modified = (patient as PatientWithUpdatedAt).updated_at ?? patient.created_at;
      return matchesTerm && matchesTag && matchesSex && matchesPeriod(created, createdPeriod, createdStart, createdEnd) && matchesPeriod(modified, modifiedPeriod, modifiedStart, modifiedEnd);
    });
    return rows.sort((a, b) => {
      if (sortMode === "alpha") return a.name.localeCompare(b.name, "pt-BR");
      if (sortMode === "created") return b.created_at.localeCompare(a.created_at);
      const am = (a as PatientWithUpdatedAt).updated_at ?? a.created_at;
      const bm = (b as PatientWithUpdatedAt).updated_at ?? b.created_at;
      return bm.localeCompare(am);
    });
  }, [patients.data, search, tagFilter, sexFilter, createdPeriod, modifiedPeriod, createdStart, createdEnd, modifiedStart, modifiedEnd, sortMode]);

  const removePatient = useMutation({ mutationFn: (id: string) => deletePatient(id), onSuccess: () => { setRemoving(null); void queryClient.invalidateQueries({ queryKey: ["patients"] }); toast.success("Paciente excluído."); }, onError: (error: Error) => toast.error(error.message) });
  const startConsultation = useMutation({ mutationFn: (patientId: string) => createConsultation(patientId), onSuccess: (consultation) => { void queryClient.invalidateQueries({ queryKey: ["consultation-dates"] }); void queryClient.invalidateQueries({ queryKey: ["consultations"] }); setWorkspace({ patientId: consultation.patient_id, consultationId: consultation.id, section: "consulta" }); }, onError: (error: Error) => toast.error(error.message) });

  const exportPatients = () => {
    const header = ["Nome", "CPF", "Telefone", "E-mail", "Sexo", "Nascimento", "Tags", "Criado em", "Modificado em"];
    const rows = filteredPatients.map((patient) => [patient.name, patient.cpf ?? "", patient.phone ?? "", patient.email ?? "", patient.sex ?? "", patient.birth_date ?? "", (patient.tags ?? []).join("; "), patient.created_at, (patient as PatientWithUpdatedAt).updated_at ?? patient.created_at]);
    const csv = [header, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `pacientes-cach-ai-${new Date().toISOString().slice(0, 10)}.csv`; link.click(); URL.revokeObjectURL(url);
  };

  return (
    <AppShell>
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex flex-col justify-between gap-5 border-b border-border pb-6 sm:flex-row sm:items-end">
          <div><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Consultório</p><h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Pacientes cadastrados</h1><p className="mt-2 text-sm text-muted-foreground">Total de pacientes: {patients.data?.length ?? 0}</p></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportPatients}><Download /> Exportar pacientes</Button><Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus /> Adicionar paciente</Button></div>
        </header>

        <section aria-label="Volume de consultas" className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4"><Metric icon={<CalendarClock />} label="Hoje" value={stats.today} /><Metric icon={<CalendarClock />} label="Esta semana" value={stats.week} /><Metric icon={<CalendarClock />} label="Este mês" value={stats.month} /><Metric icon={<Activity />} label="Média mensal (12m)" value={stats.monthlyAverage} /></section>

        <section className="mt-8" aria-labelledby="patients-heading">
          <div className="flex gap-2"><div className="relative min-w-0 flex-1"><Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Busque por nome, CPF, telefone, e-mail ou tag" className="pl-9" /></div><Button variant="outline" onClick={() => setFiltersOpen((value) => !value)}>{filtersOpen ? <ChevronUp /> : <ChevronDown />} {filtersOpen ? "Ocultar filtros" : "Exibir filtros"}</Button></div>

          {filtersOpen ? <div className="mt-3 space-y-2 rounded-lg border border-border bg-muted/20 p-3">
            <FilterRow label="Data de modificação"><PeriodButtons value={modifiedPeriod} onChange={setModifiedPeriod} />{modifiedPeriod === "custom" ? <DateRange start={modifiedStart} end={modifiedEnd} onStart={setModifiedStart} onEnd={setModifiedEnd} /> : null}</FilterRow>
            <FilterRow label="Data de criação"><PeriodButtons value={createdPeriod} onChange={setCreatedPeriod} />{createdPeriod === "custom" ? <DateRange start={createdStart} end={createdEnd} onStart={setCreatedStart} onEnd={setCreatedEnd} /> : null}</FilterRow>
            <FilterRow label="Gênero do paciente"><ChoiceButton active={sexFilter === "all"} onClick={() => setSexFilter("all")}>Sem especificar</ChoiceButton><ChoiceButton active={sexFilter === "masculino"} onClick={() => setSexFilter("masculino")}>Masculino</ChoiceButton><ChoiceButton active={sexFilter === "feminino"} onClick={() => setSexFilter("feminino")}>Feminino</ChoiceButton></FilterRow>
            <FilterRow label="Ordenar resultados por"><ChoiceButton active={sortMode === "modified"} onClick={() => setSortMode("modified")}>Data de modificação</ChoiceButton><ChoiceButton active={sortMode === "created"} onClick={() => setSortMode("created")}>Data de cadastro</ChoiceButton><ChoiceButton active={sortMode === "alpha"} onClick={() => setSortMode("alpha")}>Ordem alfabética</ChoiceButton></FilterRow>
          </div> : null}

          {allTags.length ? <div className="mt-3 flex flex-wrap gap-1.5"><Badge variant={tagFilter ? "outline" : "secondary"} className="cursor-pointer" onClick={() => setTagFilter(null)}>Todas as tags</Badge>{allTags.map((tag) => <Badge key={tag} variant={tagFilter === tag ? "secondary" : "outline"} className="cursor-pointer" onClick={() => setTagFilter(tagFilter === tag ? null : tag)}>{tag}</Badge>)}</div> : null}

          <div className="mt-4 mb-2 flex items-center justify-between"><div><h2 id="patients-heading" className="text-sm font-semibold">Resultados</h2><p className="mt-1 text-xs text-muted-foreground">{filteredPatients.length} paciente(s) encontrado(s).</p></div></div>
          <div className="grid gap-2 lg:grid-cols-2">{filteredPatients.length ? filteredPatients.map((patient) => <div key={patient.id} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-3 text-sm"><button type="button" className="min-w-0 flex-1 text-left" onClick={() => setWorkspace({ patientId: patient.id, section: "perfil" })}><span className="block truncate font-medium hover:underline">{patient.name}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">Modificado em {formatDateTime((patient as PatientWithUpdatedAt).updated_at ?? patient.created_at)}</span>{patient.tags?.length ? <span className="mt-1 flex flex-wrap gap-1">{patient.tags.map((tag) => <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>)}</span> : null}</button><div className="flex shrink-0 items-center gap-1"><Button size="icon" variant="ghost" aria-label={`Editar ${patient.name}`} onClick={() => { setEditing(patient); setDialogOpen(true); }}><Pencil /></Button><Button size="icon" variant="ghost" aria-label={`Excluir ${patient.name}`} onClick={() => setRemoving(patient)}><Trash2 /></Button><Button size="sm" variant="secondary" onClick={() => startConsultation.mutate(patient.id)} disabled={startConsultation.isPending}>Nova consulta <ArrowRight /></Button></div></div>) : <p className="col-span-full rounded-md border border-dashed border-border px-3 py-10 text-center text-sm text-muted-foreground">Nenhum paciente corresponde aos filtros.</p>}</div>
        </section>
      </div>

      <PatientDialog open={dialogOpen} onOpenChange={setDialogOpen} patient={editing} onOpenWorkspace={(patientId, consultationId) => setWorkspace({ patientId, consultationId, section: consultationId ? "consulta" : "perfil" })} />
      <PatientWorkspaceDialog open={!!workspace} patientId={workspace?.patientId ?? null} initialConsultationId={workspace?.consultationId} initialSection={workspace?.section} onOpenChange={(open) => { if (!open) setWorkspace(null); }} />
      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir {removing?.name}?</AlertDialogTitle><AlertDialogDescription>Esta ação não pode ser desfeita. Pacientes com consultas registradas não podem ser excluídos.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={(event) => { event.preventDefault(); if (removing) removePatient.mutate(removing.id); }} disabled={removePatient.isPending}>{removePatient.isPending ? "Excluindo…" : "Excluir"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    </AppShell>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) { return <div className="flex flex-col gap-2 rounded-md bg-background px-3 py-2 sm:flex-row sm:items-center"><span className="w-48 shrink-0 text-sm font-medium">{label}:</span><div className="flex flex-1 flex-wrap gap-1.5">{children}</div></div>; }
function ChoiceButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <Button type="button" size="sm" variant={active ? "default" : "secondary"} onClick={onClick}>{children}</Button>; }
function PeriodButtons({ value, onChange }: { value: PeriodFilter; onChange: (value: PeriodFilter) => void }) { return <><ChoiceButton active={value === "all"} onClick={() => onChange("all")}>Todo período</ChoiceButton><ChoiceButton active={value === "1m"} onClick={() => onChange("1m")}>1 mês atrás</ChoiceButton><ChoiceButton active={value === "2m"} onClick={() => onChange("2m")}>2 meses atrás</ChoiceButton><ChoiceButton active={value === "3m"} onClick={() => onChange("3m")}>3 meses atrás</ChoiceButton><ChoiceButton active={value === "custom"} onClick={() => onChange("custom")}>Personalizar data</ChoiceButton></>; }
function DateRange({ start, end, onStart, onEnd }: { start: string; end: string; onStart: (v: string) => void; onEnd: (v: string) => void }) { return <><Input type="date" value={start} onChange={(e) => onStart(e.target.value)} className="h-8 w-40" aria-label="Data inicial" /><Input type="date" value={end} onChange={(e) => onEnd(e.target.value)} className="h-8 w-40" aria-label="Data final" /></>; }
function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) { return <div className="rounded-md border border-border px-3 py-2"><div className="flex items-center gap-1.5 text-xs text-muted-foreground">{icon}{label}</div><div className="mt-1 text-xl font-semibold tabular-nums">{value}</div></div>; }
function normalize(value: string) { return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
function monthsAgo(months: number) { const date = new Date(); date.setMonth(date.getMonth() - months); return date; }
function matchesPeriod(value: string, period: PeriodFilter, start: string, end: string) { if (period === "all") return true; const date = new Date(value); if (period === "custom") { if (start && date < new Date(`${start}T00:00:00`)) return false; if (end && date > new Date(`${end}T23:59:59.999`)) return false; return true; } const months = period === "1m" ? 1 : period === "2m" ? 2 : 3; return date >= monthsAgo(months); }
function formatDateTime(value: string) { return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(value)); }
function csvCell(value: string) { const safe = value.replace(/"/g, '""'); return `"${safe}"`; }
function summarize(rows: { consultation_date: string }[]) { const now = new Date(); const today = now.toISOString().slice(0, 10); const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7)); const weekStart = startOfWeek.toISOString().slice(0, 10); const monthStart = `${today.slice(0, 7)}-01`; const yearAgo = new Date(now); yearAgo.setFullYear(now.getFullYear() - 1); const yearStart = yearAgo.toISOString().slice(0, 10); const lastYear = rows.filter((row) => row.consultation_date >= yearStart).length; return { today: rows.filter((row) => row.consultation_date === today).length, week: rows.filter((row) => row.consultation_date >= weekStart).length, month: rows.filter((row) => row.consultation_date >= monthStart).length, monthlyAverage: Math.round((lastYear / 12) * 10) / 10 }; }
