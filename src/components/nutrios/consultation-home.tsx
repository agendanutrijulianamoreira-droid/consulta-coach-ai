import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AttentionCenter,
  ConsultationHistory,
  HomeHeader,
  PatientQuickAccess,
  SummaryCards,
  type AttentionItem,
  type PatientRow,
  type PatientView,
} from "@/components/nutrios/consultation-home-sections";
import { ConsultationRegistrationDialog } from "@/components/nutrios/consultation-registration-dialog";
import { PatientDialog } from "@/components/nutrios/patient-dialog";
import {
  PatientWorkspaceDialog,
  type WorkspaceSection,
} from "@/components/nutrios/patient-workspace-dialog";
import { useSession } from "@/lib/nutrios/use-session";
import * as db from "@/lib/nutrios/repository";

type WorkspaceState = {
  patientId: string;
  consultationId?: string | undefined;
  section?: WorkspaceSection | undefined;
} | null;

function focusConsultationSearch(
  searchArea: HTMLDivElement | null,
  searchInput: HTMLInputElement | null,
) {
  const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
  searchArea?.scrollIntoView({ behavior, block: "center" });
  searchInput?.focus({ preventScroll: true });
}

export function ConsultationHome() {
  const queryClient = useQueryClient();
  const searchAreaRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { session } = useSession();
  const [search, setSearch] = useState("");
  const [patientView, setPatientView] = useState<PatientView>("recent");
  const [consultationPrompt, setConsultationPrompt] = useState(false);
  const [patientDialogOpen, setPatientDialogOpen] = useState(false);
  const [workspace, setWorkspace] = useState<WorkspaceState>(null);
  const [consultationPatient, setConsultationPatient] = useState<db.Patient | null>(null);

  const patients = useQuery({ queryKey: ["patients"], queryFn: db.listPatients });
  const consultations = useQuery({ queryKey: ["consultations"], queryFn: db.listConsultations });
  const consultationDates = useQuery({
    queryKey: ["consultation-dates"],
    queryFn: db.listConsultationDates,
  });

  const latestByPatient = useMemo(() => {
    const latest = new Map<string, { id: string; date: string }>();
    for (const consultation of consultations.data ?? []) {
      const date = consultation.consultation_date ?? consultation.created_at;
      const current = latest.get(consultation.patient_id);
      if (!current || date > current.date) {
        latest.set(consultation.patient_id, { id: consultation.id, date });
      }
    }
    return latest;
  }, [consultations.data]);

  const filteredPatients = useMemo(() => {
    const term = normalize(search);
    return (patients.data ?? []).filter((patient) => {
      if (!term) return true;
      return [
        patient.name,
        patient.cpf ?? "",
        patient.phone ?? "",
        patient.email ?? "",
        ...(patient.tags ?? []),
      ].some((value) => normalize(value).includes(term));
    });
  }, [patients.data, search]);

  const patientRows = useMemo<PatientRow[]>(() => {
    return filteredPatients
      .map((patient) => toPatientRow(patient, latestByPatient))
      .sort(comparePatientRows)
      .slice(0, 5);
  }, [filteredPatients, latestByPatient]);

  const birthdayRows = useMemo<PatientRow[]>(() => {
    const currentMonth = new Date().getMonth() + 1;
    return filteredPatients
      .filter((patient) => getBirthDateParts(patient.birth_date)?.month === currentMonth)
      .sort((a, b) => {
        const aDay = getBirthDateParts(a.birth_date)?.day ?? 0;
        const bDay = getBirthDateParts(b.birth_date)?.day ?? 0;
        return aDay - bDay || a.name.localeCompare(b.name, "pt-BR");
      })
      .map((patient) => toPatientRow(patient, latestByPatient))
      .slice(0, 5);
  }, [filteredPatients, latestByPatient]);

  const birthdayCount = useMemo(() => {
    const currentMonth = new Date().getMonth() + 1;
    return (patients.data ?? []).filter(
      (patient) => getBirthDateParts(patient.birth_date)?.month === currentMonth,
    ).length;
  }, [patients.data]);

  const attentionItems = useMemo<AttentionItem[]>(() => {
    const patientById = new Map((patients.data ?? []).map((patient) => [patient.id, patient]));
    const items: AttentionItem[] = [];

    for (const consultation of consultations.data ?? []) {
      if (
        consultation.record_kind !== "attendance" ||
        consultation.status === "finalizada" ||
        !consultation.visible_in_history
      ) {
        continue;
      }

      const patient = patientById.get(consultation.patient_id);
      if (!patient) continue;

      const isInProgress = consultation.status === "em_andamento";
      items.push({
        id: `consultation-${consultation.id}`,
        patient,
        consultationId: consultation.id,
        title: isInProgress ? "Consulta em andamento" : "Consulta não finalizada",
        detail: consultation.current_step
          ? `Etapa: ${formatStep(consultation.current_step)}`
          : "Revisar prontuário",
        actionLabel: "Abrir consulta",
        section: "consulta",
        tone: isInProgress ? "urgent" : "attention",
      });

      if (items.length >= 4) break;
    }

    const currentMonth = new Date().getMonth() + 1;
    const birthdayPatient = (patients.data ?? []).find(
      (patient) => getBirthDateParts(patient.birth_date)?.month === currentMonth,
    );
    if (birthdayPatient) {
      items.push({
        id: `birthday-${birthdayPatient.id}`,
        patient: birthdayPatient,
        title: "Aniversariante do mês",
        detail: "Considerar um contato de relacionamento",
        actionLabel: "Abrir paciente",
        section: "perfil",
        tone: "informative",
      });
    }

    return items.slice(0, 5);
  }, [consultations.data, patients.data]);

  const consultationStats = useMemo(
    () => summarizeConsultations(consultationDates.data ?? []),
    [consultationDates.data],
  );
  const monthlyHistory = useMemo(
    () => buildMonthlyHistory(consultationDates.data ?? []),
    [consultationDates.data],
  );
  const historyTotal = useMemo(
    () => monthlyHistory.reduce((sum, item) => sum + item.count, 0),
    [monthlyHistory],
  );
  const firstName = getFirstName(
    session?.user.user_metadata["full_name"] ?? session?.user.user_metadata["name"],
    session?.user.email,
  );

  const dismissAttention = useMutation({
    mutationFn: (item: AttentionItem) => db.hideConsultationFromHistory(item.consultationId!),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["consultations"] }),
        queryClient.invalidateQueries({ queryKey: ["consultation-dates"] }),
      ]);
      toast.success("Consulta arquivada e removida da Atenção clínica.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startConsultation = useMutation({
    mutationFn: ({
      patientId,
      consultationDate,
      observations,
    }: {
      patientId: string;
      consultationDate: string;
      observations: string;
    }) => db.createConsultation(patientId, consultationDate, observations),
    onSuccess: async (consultation) => {
      setConsultationPatient(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["consultations"] }),
        queryClient.invalidateQueries({ queryKey: ["consultation-dates"] }),
      ]);
      setWorkspace({
        patientId: consultation.patient_id,
        consultationId: consultation.id,
        section: "consulta",
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const guideToNewConsultation = () => {
    setPatientView("recent");
    setConsultationPrompt(true);
    window.requestAnimationFrame(() => {
      focusConsultationSearch(searchAreaRef.current, searchInputRef.current);
    });
  };

  const selectConsultationPatient = (patient: db.Patient) => {
    setConsultationPrompt(false);
    setConsultationPatient(patient);
  };

  const openPatient = (row: PatientRow) => {
    setWorkspace({
      patientId: row.patient.id,
      consultationId: row.consultationId ?? undefined,
      section: "perfil",
    });
  };

  return (
    <section className="min-h-[calc(100vh-3rem)] bg-background print:hidden">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-7 lg:px-9">
        <HomeHeader
          dateLabel={formatToday()}
          firstName={firstName}
          onAddPatient={() => setPatientDialogOpen(true)}
          onNewConsultation={guideToNewConsultation}
        />

        <SummaryCards
          patients={
            patients.isLoading ? null : patients.isError ? undefined : (patients.data?.length ?? 0)
          }
          currentMonth={
            consultationDates.isLoading
              ? null
              : consultationDates.isError
                ? undefined
                : consultationStats.month
          }
          lastSevenDays={
            consultationDates.isLoading
              ? null
              : consultationDates.isError
                ? undefined
                : consultationStats.lastSevenDays
          }
          birthdays={patients.isLoading ? null : patients.isError ? undefined : birthdayCount}
        />

        <AttentionCenter
          items={attentionItems}
          isLoading={patients.isLoading || consultations.isLoading}
          onOpen={(item) =>
            setWorkspace({
              patientId: item.patient.id,
              consultationId: item.consultationId,
              section: item.section,
            })
          }
          onDismiss={(item) => dismissAttention.mutate(item)}
          dismissingId={dismissAttention.isPending ? dismissAttention.variables?.id ?? null : null}
        />

        <PatientQuickAccess
          search={search}
          onSearchChange={(value) => {
            setSearch(value);
            setConsultationPrompt(false);
          }}
          searchAreaRef={searchAreaRef}
          searchInputRef={searchInputRef}
          consultationPrompt={consultationPrompt}
          patientView={patientView}
          onPatientViewChange={setPatientView}
          birthdayCount={birthdayCount}
          patientRows={patientRows}
          birthdayRows={birthdayRows}
          isLoading={patients.isLoading}
          isError={patients.isError}
          onOpen={openPatient}
          onNewConsultation={selectConsultationPatient}
          isStartingConsultation={startConsultation.isPending}
          onViewAll={() => window.location.assign("/?patients=all")}
        />

        <ConsultationHistory
          isLoading={consultationDates.isLoading}
          isError={consultationDates.isError}
          total={historyTotal}
          history={monthlyHistory}
        />
      </div>

      <ConsultationRegistrationDialog
        open={!!consultationPatient}
        patientName={consultationPatient?.name}
        isPending={startConsultation.isPending}
        onOpenChange={(open) => {
          if (!open) setConsultationPatient(null);
        }}
        onConfirm={(consultationDate, observations) => {
          if (consultationPatient) {
            startConsultation.mutate({ patientId: consultationPatient.id, consultationDate, observations });
          }
        }}
        onDecline={() => {
          if (consultationPatient) {
            setWorkspace({ patientId: consultationPatient.id, section: "perfil" });
          }
        }}
      />
      <PatientDialog
        open={patientDialogOpen}
        onOpenChange={setPatientDialogOpen}
        onOpenWorkspace={(patientId, consultationId) =>
          setWorkspace({
            patientId,
            consultationId,
            section: consultationId ? "consulta" : "perfil",
          })
        }
      />
      <PatientWorkspaceDialog
        open={!!workspace}
        patientId={workspace?.patientId ?? null}
        initialConsultationId={workspace?.consultationId}
        initialSection={workspace?.section}
        onOpenChange={(open) => {
          if (!open) setWorkspace(null);
        }}
      />
    </section>
  );
}

function toPatientRow(
  patient: db.Patient,
  latestByPatient: Map<string, { id: string; date: string }>,
): PatientRow {
  const latest = latestByPatient.get(patient.id);
  return {
    patient,
    consultationId: latest?.id ?? null,
    lastAttendance: latest?.date ?? null,
  };
}

function comparePatientRows(a: PatientRow, b: PatientRow) {
  if (a.lastAttendance && b.lastAttendance) {
    return b.lastAttendance.localeCompare(a.lastAttendance);
  }
  if (a.lastAttendance) return -1;
  if (b.lastAttendance) return 1;
  return b.patient.created_at.localeCompare(a.patient.created_at);
}

function normalize(value: string) {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

function getFirstName(value: unknown, email?: string | null) {
  if (typeof value === "string" && value.trim()) {
    return value.trim().split(/\s+/)[0] ?? "";
  }
  const local = email?.split("@")[0]?.trim();
  return local || "";
}

function getBirthDateParts(value: string | null) {
  if (!value) return null;
  const [, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!month || !day) return null;
  return { month, day };
}

function formatStep(value: string) {
  const labels: Record<string, string> = {
    consulta: "consulta",
    anamnese: "anamnese",
    antropometria: "antropometria",
    calculos: "cálculos",
    recordatorio: "recordatório",
    exames: "exames",
    diagnostico: "diagnóstico",
    plano: "plano alimentar",
    parecer: "parecer",
  };
  return labels[value] ?? value.replaceAll("_", " ");
}

function formatToday() {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date());
}

function toLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function summarizeConsultations(rows: { consultation_date: string }[]) {
  const today = new Date();
  const todayKey = toLocalDateKey(today);
  const monthKey = todayKey.slice(0, 7);
  const sevenDaysAgo = new Date(today);
  sevenDaysAgo.setDate(today.getDate() - 6);

  return {
    month: rows.filter((row) => row.consultation_date.slice(0, 7) === monthKey).length,
    lastSevenDays: rows.filter((row) => {
      const date = row.consultation_date.slice(0, 10);
      return date >= toLocalDateKey(sevenDaysAgo) && date <= todayKey;
    }).length,
  };
}

function buildMonthlyHistory(rows: { consultation_date: string }[]) {
  const shortFormatter = new Intl.DateTimeFormat("pt-BR", { month: "short" });
  const longFormatter = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });
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

    return {
      key: `${year}-${month + 1}`,
      label: shortFormatter.format(date).replace(".", ""),
      fullLabel: longFormatter.format(date),
      count,
    };
  });
}
