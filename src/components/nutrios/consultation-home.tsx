import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, UserRound } from "lucide-react";
import { toast } from "sonner";
import { PatientDialog } from "@/components/nutrios/patient-dialog";
import { PatientWorkspaceDialog, type WorkspaceSection } from "@/components/nutrios/patient-workspace-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as db from "@/lib/nutrios/repository";

type WorkspaceState = {
  patientId: string;
  consultationId?: string | undefined;
  section?: WorkspaceSection | undefined;
} | null;

type RecentPatient = {
  patient: db.Patient;
  consultationId: string | null;
  lastAttendance: string | null;
};

export function ConsultationHome() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [patientDialogOpen, setPatientDialogOpen] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceState>(null);

  const patients = useQuery({ queryKey: ["patients"], queryFn: db.listPatients });
  const consultations = useQuery({ queryKey: ["consultations"], queryFn: db.listConsultations });
  const consultationDates = useQuery({ queryKey: ["consultation-dates"], queryFn: db.listConsultationDates });

  const patientRows = useMemo(() => {
    const latestByPatient = new Map<string, { id: string; date: string }>();
    for (const consultation of consultations.data ?? []) {
      const date = consultation.consultation_date ?? consultation.created_at;
      const current = latestByPatient.get(consultation.patient_id);
      if (!current || date > current.date) latestByPatient.set(consultation.patient_id, { id: consultation.id, date });
    }

    const term = normalize(search);
    const rows: RecentPatient[] = (patients.data ?? [])
      .filter((patient) => {
        if (!term) return true;
        return [patient.name, patient.cpf ?? "", patient.phone ?? "", patient.email ?? "", ...(patient.tags ?? [])]
          .some((value) => normalize(value).includes(term));
      })
      .map((patient) => {
        const latest = latestByPatient.get(patient.id);
        return {
          patient,
          consultationId: latest?.id ?? null,
          lastAttendance: latest?.date ?? null,
        };
      });

    return rows
      .sort((a, b) => {
        if (a.lastAttendance && b.lastAttendance) return b.lastAttendance.localeCompare(a.lastAttendance);
        if (a.lastAttendance) return -1;
        if (b.lastAttendance) return 1;
        return b.patient.created_at.localeCompare(a.patient.created_at);
      })
      .slice(0, 5);
  }, [patients.data, consultations.data, search]);

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
        <div className="rounded-lg border border-border bg-background p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Pacientes recentes</h1>
              <p className="mt-1 text-xs text-muted-foreground">Acesso rápido pelos últimos atendimentos</p>
            </div>
            <div className="flex flex-wrap gap-1 text-xs">
              <Button variant="ghost" size="sm" onClick={() => window.location.assign("/?patients=all")}>Ver todos</Button>
              <Button variant="ghost" size="sm" disabled={!birthdaysToday.length} title={birthdaysToday.map((patient) => patient.name).join(", ")}>Aniversariantes ({birthdaysToday.length})</Button>
            </div>
          </div>

          <Button className="mt-5 w-full" onClick={() => setPatientDialogOpen(true)}><Plus /> Adicionar paciente</Button>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-3 size-4 text-muted-foreground" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Busque por nome, CPF, telefone, e-mail ou tag" className="pl-9" />
          </div>

          <div className="mt-3 divide-y divide-border rounded-md bg-muted/35 px-3">
            {patientRows.map(({ patient, consultationId, lastAttendance }) => (
              <div key={patient.id} className="flex items-center gap-3 py-3">
                <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => setWorkspace({ patientId: patient.id, consultationId: consultationId ?? undefined, section: "perfil" })}>
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted"><UserRound className="size-5 text-muted-foreground" /></span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{patient.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{lastAttendance ? `Último atendimento: ${formatDate(lastAttendance)}` : "Sem atendimento registrado"}</span>
                  </span>
                </button>
                <Button size="sm" variant="secondary" disabled={startConsultation.isPending} onClick={() => startConsultation.mutate(patient.id)}>Nova consulta</Button>
              </div>
            ))}
            {!patientRows.length ? <p className="py-8 text-center text-sm text-muted-foreground">Nenhum paciente encontrado.</p> : null}
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-border bg-background p-4 sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">Histórico de consultas</h2>
              <p className="mt-1 text-xs text-muted-foreground">Últimos 13 meses</p>
            </div>
          </div>
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
      </div>

      <PatientDialog open={patientDialogOpen} onOpenChange={setPatientDialogOpen} onOpenWorkspace={(patientId, consultationId) => setWorkspace({ patientId, consultationId, section: consultationId ? "consulta" : "perfil" })} />
      <PatientWorkspaceDialog open={!!workspace} patientId={workspace?.patientId ?? null} initialConsultationId={workspace?.consultationId} initialSection={workspace?.section} onOpenChange={(open) => { if (!open) setWorkspace(null); }} />
    </section>
  );
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function formatDate(value: string) {
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
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
