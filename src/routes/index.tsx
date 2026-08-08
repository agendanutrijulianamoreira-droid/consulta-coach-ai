import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Activity, ArrowRight, CalendarClock, Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/nutrios/app-shell";
import { PatientDialog } from "@/components/nutrios/patient-dialog";
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
import { createConsultation, deletePatient, listConsultations, listPatients, type Patient } from "@/lib/nutrios/repository";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pacientes — NutriOS" },
      { name: "description", content: "Central de pacientes e consultas clínicas do NutriOS." },
      { property: "og:title", content: "Pacientes — NutriOS" },
      { property: "og:description", content: "Inicie consultas e acompanhe a documentação clínica em um só lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Patient | null>(null);
  const [removing, setRemoving] = useState<Patient | null>(null);
  const patients = useQuery({ queryKey: ["patients"], queryFn: listPatients });
  const consultations = useQuery({ queryKey: ["consultations"], queryFn: listConsultations });
  const filteredPatients = useMemo(
    () => (patients.data ?? []).filter((patient) => patient.name.toLowerCase().includes(search.trim().toLowerCase())),
    [patients.data, search],
  );

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
    onSuccess: (consultation) => navigate({ to: "/consulta/$id", params: { id: consultation.id } }),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
        <header className="flex flex-col justify-between gap-5 border-b border-border pb-6 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Consultório</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Pacientes</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">Comece pelo paciente. O NutriOS organiza a consulta, revisa os dados clínicos e monta a conduta com rastreabilidade.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:min-w-56">
            <Metric icon={<Users />} label="Pacientes" value={patients.data?.length ?? 0} />
            <Metric icon={<Activity />} label="Consultas" value={consultations.data?.length ?? 0} />
          </div>
        </header>

        <div className="mt-6">
          <Button onClick={() => { setEditing(null); setDialogOpen(true); }}><Plus /> Novo paciente</Button>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <section aria-labelledby="patients-heading">
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div><h2 id="patients-heading" className="text-sm font-semibold">Cadastrados</h2><p className="mt-1 text-xs text-muted-foreground">Selecione um paciente para abrir uma consulta.</p></div>
              <div className="relative sm:w-56"><Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar paciente" aria-label="Buscar paciente" className="h-8 pl-8 text-xs" /></div>
            </div>
            <div className="divide-y divide-border rounded-md border border-border">
              {filteredPatients.length ? filteredPatients.map((patient) => (
                <div key={patient.id} className="flex items-center justify-between gap-3 px-3 py-3 text-sm">
                  <div className="min-w-0"><p className="truncate font-medium">{patient.name}</p><p className="mt-0.5 truncate text-xs text-muted-foreground">{describePatient(patient)}</p></div>
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
            <div className="mb-3"><h2 id="recent-heading" className="text-sm font-semibold">Consultas recentes</h2><p className="mt-1 text-xs text-muted-foreground">Retome a documentação de onde parou.</p></div>
            <div className="divide-y divide-border rounded-md border border-border">
              {consultations.data?.length ? consultations.data.map((consultation) => (
                <Button key={consultation.id} variant="ghost" className="h-auto w-full justify-between rounded-none px-3 py-3 text-left" onClick={() => navigate({ to: "/consulta/$id", params: { id: consultation.id } })}>
                  <span className="min-w-0"><span className="block truncate font-medium">{consultation.patients?.name ?? "Paciente"}</span><span className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><CalendarClock className="size-3" />{formatDate(consultation.created_at)}</span></span>
                  <span className="shrink-0 text-xs text-muted-foreground">{consultation.status === "finalizada" ? "Finalizada" : "Em aberto"}</span>
                </Button>
              )) : <p className="px-3 py-8 text-sm text-muted-foreground">Nenhuma consulta registrada.</p>}
            </div>
          </section>
        </div>
      </div>
      <PatientDialog open={dialogOpen} onOpenChange={setDialogOpen} patient={editing} />
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
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
}

/** Resumo textual do cadastro (idade, sexo, contato) exibido na listagem. */
function describePatient(patient: Patient) {
  const parts: string[] = [];
  if (patient.birth_date) {
    const age = Math.floor((Date.now() - new Date(patient.birth_date).getTime()) / 31557600000);
    if (Number.isFinite(age) && age >= 0) parts.push(`${age} anos`);
  }
  if (patient.sex) parts.push(patient.sex === "feminino" ? "Feminino" : "Masculino");
  if (patient.phone) parts.push(patient.phone);
  if (patient.email) parts.push(patient.email);
  return parts.join(" · ") || "Cadastro incompleto";
}
