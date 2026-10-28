/**
 * IA Gerente — Entregas 1 e 2: fila de aprovações priorizada, gerada por
 * regras fixas (nunca pela IA). Cada regra lê um sinal real do sistema e
 * produz um candidato a tarefa; quem decide a ordem final é a prioridade
 * (1 = mais urgente), seguindo exatamente as 5 regras do documento:
 * 1. risco clínico/perda de dado, 2. consulta aberta hoje/ontem,
 * 3. dinheiro, 4. continuidade, 5. relacionamento e comercial.
 *
 * As regras 1 e 3 (risco clínico granular e dinheiro) ainda não têm um
 * sinal confiável no sistema para se apoiar — não inventamos tarefa para
 * algo que não dá pra detectar de verdade.
 */
export type TarefaTipo = "consulta_aberta" | "falta_sem_remarcar" | "aniversario";
export type TarefaStatus = "aberta" | "adiada" | "feita" | "descartada";
export type TarefaOrigem = "regra" | "ia";

export const PRIORITY_TIER: Record<TarefaTipo, number> = {
  consulta_aberta: 2,
  falta_sem_remarcar: 4,
  aniversario: 5,
};

export interface TaskCandidate {
  dedupeKey: string;
  tipo: TarefaTipo;
  patientId: string;
  consultationId: string | null;
  prioridade: number;
  titulo: string;
  motivo: string;
  actionLabel: string;
  actionSection: string | null;
}

export interface Tarefa extends TaskCandidate {
  id: string;
  origem: TarefaOrigem;
  status: TarefaStatus;
  adiadaAte: string | null;
}

type PatientLike = { id: string; name: string; birth_date: string | null };
type ConsultationLike = {
  id: string;
  patient_id: string;
  status: string;
  current_step: string;
  record_kind: "attendance" | "module";
  visible_in_history: boolean;
};
type AppointmentLike = { id: string; patient_id: string; scheduled_at: string; status: string };

/** Consultas de atendimento ainda não finalizadas e visíveis no histórico. */
export function tasksFromOpenConsultations(
  consultations: ConsultationLike[],
  patients: PatientLike[],
): TaskCandidate[] {
  const patientById = new Map(patients.map((p) => [p.id, p]));
  const tasks: TaskCandidate[] = [];
  for (const consultation of consultations) {
    if (
      consultation.record_kind !== "attendance" ||
      consultation.status === "finalizada" ||
      !consultation.visible_in_history
    ) {
      continue;
    }
    const patient = patientById.get(consultation.patient_id);
    if (!patient) continue;
    const emAndamento = consultation.status === "em_andamento";
    tasks.push({
      dedupeKey: `consulta_aberta:${consultation.id}`,
      tipo: "consulta_aberta",
      patientId: patient.id,
      consultationId: consultation.id,
      prioridade: PRIORITY_TIER.consulta_aberta,
      titulo: emAndamento ? "Consulta em andamento" : "Consulta não finalizada",
      motivo: `${patient.name} — etapa: ${formatStep(consultation.current_step)}`,
      actionLabel: "Abrir consulta",
      actionSection: "consulta",
    });
  }
  return tasks;
}

/**
 * Paciente faltou (status nao_compareceu) e não tem nenhum outro
 * agendamento marcado depois daquela falta — ninguém remarcou ainda.
 */
export function tasksFromNoShowAppointments(
  appointments: AppointmentLike[],
  patients: PatientLike[],
): TaskCandidate[] {
  const patientById = new Map(patients.map((p) => [p.id, p]));
  const byPatient = new Map<string, AppointmentLike[]>();
  for (const appointment of appointments) {
    const bucket = byPatient.get(appointment.patient_id);
    if (bucket) bucket.push(appointment);
    else byPatient.set(appointment.patient_id, [appointment]);
  }

  const tasks: TaskCandidate[] = [];
  for (const appointment of appointments) {
    if (appointment.status !== "nao_compareceu") continue;
    const patient = patientById.get(appointment.patient_id);
    if (!patient) continue;
    const siblings = byPatient.get(appointment.patient_id) ?? [];
    const hasLaterBooking = siblings.some(
      (other) => other.id !== appointment.id && other.scheduled_at > appointment.scheduled_at,
    );
    if (hasLaterBooking) continue;

    tasks.push({
      dedupeKey: `falta_sem_remarcar:${appointment.id}`,
      tipo: "falta_sem_remarcar",
      patientId: patient.id,
      consultationId: null,
      prioridade: PRIORITY_TIER.falta_sem_remarcar,
      titulo: "Paciente faltou e não remarcou",
      motivo: `${patient.name} — faltou em ${formatDateBr(appointment.scheduled_at)}`,
      actionLabel: "Agendar retorno",
      actionSection: null,
    });
  }
  return tasks;
}

/** Aniversariantes do mês corrente, um por ano (a chave inclui o ano). */
export function tasksFromBirthdays(
  patients: PatientLike[],
  now: Date = new Date(),
): TaskCandidate[] {
  const currentMonth = now.getMonth() + 1;
  const year = now.getFullYear();
  const tasks: TaskCandidate[] = [];
  for (const patient of patients) {
    const month = patient.birth_date ? Number(patient.birth_date.slice(5, 7)) : null;
    if (month !== currentMonth) continue;
    tasks.push({
      dedupeKey: `aniversario:${patient.id}:${year}`,
      tipo: "aniversario",
      patientId: patient.id,
      consultationId: null,
      prioridade: PRIORITY_TIER.aniversario,
      titulo: "Aniversariante do mês",
      motivo: `${patient.name} — considerar um contato de relacionamento`,
      actionLabel: "Abrir paciente",
      actionSection: "perfil",
    });
  }
  return tasks;
}

/** Teto de 7 itens é proposital (documento): mais que isso vira o mesmo ruído das notificações do WebDiet. */
export function sortAndCap(tasks: TaskCandidate[], max = 7): TaskCandidate[] {
  return [...tasks].sort((a, b) => a.prioridade - b.prioridade).slice(0, max);
}

/** Uma tarefa "adiada" volta a valer quando o prazo do adiamento passa. */
export function isCurrentlyOpen(
  task: { status: TarefaStatus; adiadaAte: string | null },
  now: Date = new Date(),
): boolean {
  if (task.status === "aberta") return true;
  if (task.status === "adiada" && task.adiadaAte)
    return new Date(task.adiadaAte).getTime() <= now.getTime();
  return false;
}

function formatDateBr(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleDateString("pt-BR");
}

const STEP_LABELS: Record<string, string> = {
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

function formatStep(value: string): string {
  if (!value) return "revisar prontuário";
  return STEP_LABELS[value] ?? value.replaceAll("_", " ");
}
