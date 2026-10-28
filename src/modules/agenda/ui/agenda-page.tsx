import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Clock,
  List,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import * as db from "@/lib/nutrios/repository";
import {
  APPOINTMENT_STATUS_LABEL,
  addDays,
  findConflicts,
  groupByDay,
  needsAttention,
  startOfWeek,
  type AppointmentStatus,
} from "@/modules/agenda/domain/agenda";
import * as agendaDb from "@/modules/agenda/infrastructure/agenda-repository";
import type { AppointmentWithPatient } from "@/modules/agenda/infrastructure/agenda-repository";

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function AgendaPage() {
  const [view, setView] = useState<"semana" | "lista">("semana");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [creatingFor, setCreatingFor] = useState<Date | null>(null);
  const [editing, setEditing] = useState<AppointmentWithPatient | null>(null);
  const queryClient = useQueryClient();

  const weekEnd = useMemo(() => addDays(weekStart, 7), [weekStart]);
  const weekQuery = useQuery({
    queryKey: ["appointments-week", weekStart.toISOString()],
    queryFn: () => agendaDb.listAppointmentsInRange(weekStart.toISOString(), weekEnd.toISOString()),
    enabled: view === "semana",
  });
  const listQuery = useQuery({
    queryKey: ["appointments-upcoming"],
    queryFn: () => agendaDb.listUpcomingAppointments(new Date().toISOString()),
    enabled: view === "lista",
  });
  const waitlistQuery = useQuery({
    queryKey: ["appointment-waitlist"],
    queryFn: agendaDb.listWaitlist,
  });

  async function invalidateAppointments() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["appointments-week"] }),
      queryClient.invalidateQueries({ queryKey: ["appointments-upcoming"] }),
    ]);
  }

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: AppointmentStatus }) =>
      agendaDb.updateAppointment(id, { status }),
    onSuccess: invalidateAppointments,
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteAppointment = useMutation({
    mutationFn: (id: string) => agendaDb.deleteAppointment(id),
    onSuccess: async () => {
      toast.success("Agendamento removido.");
      await invalidateAppointments();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const byDay = useMemo(() => groupByDay(weekQuery.data ?? []), [weekQuery.data]);
  const pendingCount = useMemo(
    () => (listQuery.data ?? weekQuery.data ?? []).filter((a) => needsAttention(a.status)).length,
    [listQuery.data, weekQuery.data],
  );

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <header className="mb-6 flex flex-col gap-4 border-b border-border/70 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <CalendarDays className="size-3.5" />
            Agenda
          </div>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Consultas agendadas</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
            Status de confirmação e falta por consulta. Lembrete automático por WhatsApp e
            sincronização com o Google Agenda ainda não estão conectados — dependem de uma
            integração externa a configurar.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {pendingCount > 0 ? (
            <Badge variant="outline" className="gap-1 border-amber-300 text-amber-700">
              <AlertTriangle className="size-3" /> {pendingCount} pendente
              {pendingCount === 1 ? "" : "s"}
            </Badge>
          ) : null}
          <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
            <button
              type="button"
              onClick={() => setView("semana")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${view === "semana" ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
            >
              <CalendarDays className="size-3.5" /> Semana
            </button>
            <button
              type="button"
              onClick={() => setView("lista")}
              className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 ${view === "lista" ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
            >
              <List className="size-3.5" /> Lista
            </button>
          </div>
          <Button type="button" onClick={() => setCreatingFor(new Date())}>
            <Plus /> Agendar
          </Button>
        </div>
      </header>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0">
          {view === "semana" ? (
            <WeekView
              weekStart={weekStart}
              byDay={byDay}
              loading={weekQuery.isLoading}
              onPrev={() => setWeekStart(addDays(weekStart, -7))}
              onNext={() => setWeekStart(addDays(weekStart, 7))}
              onToday={() => setWeekStart(startOfWeek(new Date()))}
              onSlotClick={(date) => setCreatingFor(date)}
              onAppointmentClick={setEditing}
            />
          ) : (
            <ListView
              appointments={listQuery.data ?? []}
              loading={listQuery.isLoading}
              onAppointmentClick={setEditing}
            />
          )}
        </section>

        <aside>
          <WaitlistPanel entries={waitlistQuery.data ?? []} />
        </aside>
      </div>

      {creatingFor ? (
        <AppointmentDialog
          initialDate={creatingFor}
          onClose={() => setCreatingFor(null)}
          onSaved={async () => {
            setCreatingFor(null);
            await invalidateAppointments();
          }}
        />
      ) : null}

      {editing ? (
        <AppointmentDialog
          appointment={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await invalidateAppointments();
          }}
          onStatusChange={(status) => updateStatus.mutate({ id: editing.id, status })}
          onDelete={() => {
            deleteAppointment.mutate(editing.id);
            setEditing(null);
          }}
        />
      ) : null}
    </div>
  );
}

function WeekView({
  weekStart,
  byDay,
  loading,
  onPrev,
  onNext,
  onToday,
  onSlotClick,
  onAppointmentClick,
}: {
  weekStart: Date;
  byDay: Map<string, AppointmentWithPatient[]>;
  loading: boolean;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onSlotClick: (date: Date) => void;
  onAppointmentClick: (appointment: AppointmentWithPatient) => void;
}) {
  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const todayKey = new Date().toISOString().slice(0, 10);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onPrev}
            aria-label="Semana anterior"
          >
            <ChevronLeft />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={onToday}>
            Hoje
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onNext}
            aria-label="Próxima semana"
          >
            <ChevronRight />
          </Button>
        </div>
        <span className="text-sm font-medium">
          {formatShortDate(days[0]!)} – {formatShortDate(days[6]!)}
        </span>
      </div>
      {loading ? (
        <p className="px-6 py-10 text-center text-sm text-muted-foreground">Carregando agenda…</p>
      ) : null}
      {!loading ? (
        <div className="grid grid-cols-7 divide-x divide-border">
          {days.map((day, index) => {
            const key = day.toISOString().slice(0, 10);
            const appointments = byDay.get(key) ?? [];
            return (
              <div key={key} className={`min-h-[320px] ${key === todayKey ? "bg-accent/30" : ""}`}>
                <button
                  type="button"
                  onClick={() => onSlotClick(day)}
                  className="w-full border-b border-border px-2 py-2 text-center hover:bg-muted/40"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {WEEKDAY_LABELS[index]}
                  </p>
                  <p className="text-sm font-semibold">{day.getDate()}</p>
                </button>
                <div className="space-y-1.5 p-1.5">
                  {appointments.map((appointment) => (
                    <AppointmentCard
                      key={appointment.id}
                      appointment={appointment}
                      onClick={() => onAppointmentClick(appointment)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ListView({
  appointments,
  loading,
  onAppointmentClick,
}: {
  appointments: AppointmentWithPatient[];
  loading: boolean;
  onAppointmentClick: (appointment: AppointmentWithPatient) => void;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <div className="border-b border-border px-5 py-4">
        <h2 className="text-sm font-semibold">Próximas consultas</h2>
      </div>
      {loading ? (
        <p className="px-6 py-10 text-center text-sm text-muted-foreground">Carregando…</p>
      ) : null}
      {!loading && !appointments.length ? (
        <p className="px-6 py-10 text-center text-sm text-muted-foreground">
          Nenhuma consulta agendada.
        </p>
      ) : null}
      <div className="divide-y divide-border">
        {appointments.map((appointment) => (
          <button
            key={appointment.id}
            type="button"
            onClick={() => onAppointmentClick(appointment)}
            className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-muted/40"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{appointment.patient_name}</p>
              <p className="text-xs text-muted-foreground">
                {formatFullDate(new Date(appointment.scheduled_at))}
              </p>
            </div>
            <StatusBadge status={appointment.status} />
          </button>
        ))}
      </div>
    </div>
  );
}

function AppointmentCard({
  appointment,
  onClick,
}: {
  appointment: AppointmentWithPatient;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-md border border-border/70 bg-background px-2 py-1.5 text-left text-xs hover:border-border"
    >
      <p className="font-medium text-foreground">
        {formatTime(new Date(appointment.scheduled_at))}
      </p>
      <p className="truncate text-muted-foreground">{appointment.patient_name}</p>
      <StatusDot status={appointment.status} />
    </button>
  );
}

function StatusDot({ status }: { status: AppointmentStatus }) {
  const className = statusColor(status);
  return (
    <span className="mt-1 flex items-center gap-1 text-[10px]">
      <span className={`size-1.5 rounded-full ${className}`} />
      {APPOINTMENT_STATUS_LABEL[status]}
    </span>
  );
}

function StatusBadge({ status }: { status: AppointmentStatus }) {
  return (
    <Badge variant="outline" className="shrink-0 gap-1.5">
      <span className={`size-1.5 rounded-full ${statusColor(status)}`} />
      {APPOINTMENT_STATUS_LABEL[status]}
    </Badge>
  );
}

function statusColor(status: AppointmentStatus): string {
  switch (status) {
    case "confirmado_profissional":
    case "confirmado_paciente":
      return "bg-emerald-500";
    case "desmarcado_profissional":
    case "desmarcado_paciente":
    case "nao_compareceu":
      return "bg-destructive";
    case "realizado":
      return "bg-muted-foreground";
    default:
      return "bg-amber-500";
  }
}

function WaitlistPanel({ entries }: { entries: agendaDb.WaitlistEntry[] }) {
  const [adding, setAdding] = useState(false);
  const [patientId, setPatientId] = useState("");
  const [desiredPeriod, setDesiredPeriod] = useState("");
  const queryClient = useQueryClient();
  const patientsQuery = useQuery({
    queryKey: ["patients"],
    queryFn: db.listPatients,
    enabled: adding,
  });

  async function invalidateWaitlist() {
    await queryClient.invalidateQueries({ queryKey: ["appointment-waitlist"] });
  }

  const addEntry = useMutation({
    mutationFn: agendaDb.addToWaitlist,
    onSuccess: async () => {
      toast.success("Adicionada à lista de espera.");
      setAdding(false);
      setPatientId("");
      setDesiredPeriod("");
      await invalidateWaitlist();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const removeEntry = useMutation({
    mutationFn: (id: string) => agendaDb.removeFromWaitlist(id),
    onSuccess: invalidateWaitlist,
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
        <Users className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Lista de espera</h2>
        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-xs font-semibold">
          {entries.length}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="ml-auto"
          onClick={() => setAdding((v) => !v)}
        >
          <Plus className={adding ? "rotate-45 transition-transform" : "transition-transform"} />
        </Button>
      </div>

      {adding ? (
        <div className="space-y-2 border-b border-border bg-muted/20 p-3">
          <select
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="">Selecione a paciente…</option>
            {(patientsQuery.data ?? []).map((patient) => (
              <option key={patient.id} value={patient.id}>
                {patient.name}
              </option>
            ))}
          </select>
          <Input
            value={desiredPeriod}
            onChange={(e) => setDesiredPeriod(e.target.value)}
            placeholder="Período desejado (ex.: semana que vem à tarde)"
            className="h-9"
          />
          <Button
            type="button"
            size="sm"
            className="w-full"
            disabled={!patientId || addEntry.isPending}
            onClick={() =>
              addEntry.mutate({
                patient_id: patientId,
                desired_period: desiredPeriod.trim() || null,
              })
            }
          >
            Adicionar
          </Button>
        </div>
      ) : null}

      <div className="max-h-[420px] divide-y divide-border overflow-y-auto">
        {entries.map((entry) => (
          <div key={entry.id} className="flex items-start justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium">{entry.patient_name}</p>
              {entry.desired_period ? (
                <p className="mt-0.5 text-xs text-muted-foreground">{entry.desired_period}</p>
              ) : null}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-7 shrink-0 text-muted-foreground"
              onClick={() => removeEntry.mutate(entry.id)}
              aria-label="Remover da lista de espera"
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
        {!entries.length ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            Ninguém na lista de espera.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AppointmentDialog({
  appointment,
  initialDate,
  onClose,
  onSaved,
  onStatusChange,
  onDelete,
}: {
  appointment?: AppointmentWithPatient;
  initialDate?: Date;
  onClose: () => void;
  onSaved: () => void;
  onStatusChange?: (status: AppointmentStatus) => void;
  onDelete?: () => void;
}) {
  const isEditing = !!appointment;
  const patientsQuery = useQuery({ queryKey: ["patients"], queryFn: db.listPatients });
  const navigate = useNavigate();

  const [patientId, setPatientId] = useState(appointment?.patient_id ?? "");
  const [date, setDate] = useState(() =>
    toDateInputValue(
      appointment ? new Date(appointment.scheduled_at) : (initialDate ?? new Date()),
    ),
  );
  const [time, setTime] = useState(() =>
    toTimeInputValue(
      appointment ? new Date(appointment.scheduled_at) : roundToNextSlot(initialDate ?? new Date()),
    ),
  );
  const [duration, setDuration] = useState(appointment?.duration_minutes ?? 50);
  const [notes, setNotes] = useState(appointment?.notes ?? "");
  const [conflictWarning, setConflictWarning] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const createMutation = useMutation({
    mutationFn: agendaDb.createAppointment,
    onSuccess: () => {
      toast.success("Consulta agendada.");
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const updateMutation = useMutation({
    mutationFn: (patch: Parameters<typeof agendaDb.updateAppointment>[1]) =>
      agendaDb.updateAppointment(appointment!.id, patch),
    onSuccess: () => {
      toast.success("Consulta atualizada.");
      onSaved();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  async function handleSave() {
    if (!patientId) {
      toast.error("Escolha a paciente.");
      return;
    }
    const scheduledAt = combineDateTime(date, time);
    if (!scheduledAt) {
      toast.error("Data e horário inválidos.");
      return;
    }
    setSaving(true);
    setConflictWarning(null);
    try {
      const dayStart = new Date(scheduledAt);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = addDays(dayStart, 1);
      const existing = await agendaDb.listAppointmentsForConflictCheck(
        dayStart.toISOString(),
        dayEnd.toISOString(),
      );
      const conflicts = findConflicts(
        {
          id: appointment?.id ?? "new",
          scheduledAt: scheduledAt.toISOString(),
          durationMinutes: duration,
          status: "agendado",
        },
        existing.map((e) => ({
          id: e.id,
          scheduledAt: e.scheduled_at,
          durationMinutes: e.duration_minutes,
          status: e.status,
        })),
      );
      if (conflicts.length > 0) {
        setConflictWarning(
          `Este horário conflita com ${conflicts.length} outro(s) agendamento(s) neste dia. Salvando mesmo assim como encaixe é permitido.`,
        );
      }
      if (isEditing) {
        await updateMutation.mutateAsync({
          patient_id: patientId,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: duration,
          notes: notes.trim() || null,
        } as unknown as Parameters<typeof agendaDb.updateAppointment>[1]);
      } else {
        await createMutation.mutateAsync({
          patient_id: patientId,
          scheduled_at: scheduledAt.toISOString(),
          duration_minutes: duration,
          status: conflicts.length > 0 ? "encaixe" : "agendado",
          notes: notes.trim() || null,
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Editar consulta" : "Agendar consulta"}</DialogTitle>
          <DialogDescription>
            Status de confirmação e falta ficam registrados aqui.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Paciente</label>
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              disabled={isEditing}
            >
              <option value="">Selecione…</option>
              {(patientsQuery.data ?? []).map((patient) => (
                <option key={patient.id} value={patient.id}>
                  {patient.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <label className="text-xs text-muted-foreground">Data</label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <label className="text-xs text-muted-foreground">Horário</label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Duração (minutos)</label>
            <Input
              type="number"
              min={10}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value) || 50)}
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-xs text-muted-foreground">Observações</label>
            <Textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          {conflictWarning ? (
            <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-xs text-amber-900">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              {conflictWarning}
            </div>
          ) : null}

          {isEditing && appointment ? (
            <div className="grid gap-1.5">
              <label className="text-xs text-muted-foreground">Status</label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(APPOINTMENT_STATUS_LABEL) as AppointmentStatus[]).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => onStatusChange?.(status)}
                    className={`rounded-full border px-2.5 py-1 text-[11px] ${
                      appointment.status === status
                        ? "border-foreground bg-foreground text-background"
                        : "border-border hover:bg-muted/60"
                    }`}
                  >
                    {APPOINTMENT_STATUS_LABEL[status]}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex items-center justify-between gap-2">
          {isEditing ? (
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 /> Excluir
            </Button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {isEditing && appointment?.patient_id ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => void navigate({ to: `/paciente/${appointment.patient_id}` })}
              >
                <CalendarPlus /> Abrir prontuário
              </Button>
            ) : null}
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>
              <Clock /> {isEditing ? "Salvar" : "Agendar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function toDateInputValue(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function toTimeInputValue(date: Date): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function roundToNextSlot(date: Date): Date {
  const result = new Date(date);
  const minutes = result.getMinutes();
  result.setMinutes(minutes < 30 ? 30 : 60, 0, 0);
  return result;
}

function combineDateTime(date: string, time: string): Date | null {
  if (!date || !time) return null;
  const combined = new Date(`${date}T${time}:00`);
  return Number.isNaN(combined.getTime()) ? null : combined;
}

function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date);
}

function formatFullDate(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
}
