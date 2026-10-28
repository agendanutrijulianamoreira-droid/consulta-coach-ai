export type AppointmentStatus =
  | "agendado"
  | "encaixe"
  | "confirmado_profissional"
  | "confirmado_paciente"
  | "desmarcado_profissional"
  | "desmarcado_paciente"
  | "nao_compareceu"
  | "realizado";

export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  agendado: "Agendado",
  encaixe: "Encaixe",
  confirmado_profissional: "Confirmado por você",
  confirmado_paciente: "Paciente confirmou",
  desmarcado_profissional: "Desmarcado por você",
  desmarcado_paciente: "Desmarcado pela paciente",
  nao_compareceu: "Não compareceu",
  realizado: "Realizado",
};

/** Status que ainda ocupam o horário na agenda (não cancelados). */
const ACTIVE_STATUSES: readonly AppointmentStatus[] = [
  "agendado",
  "encaixe",
  "confirmado_profissional",
  "confirmado_paciente",
];

export function isActiveStatus(status: AppointmentStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

/** Status que ainda precisam de alguma ação (confirmar, ou decidir o que fazer com a falta). */
export function needsAttention(status: AppointmentStatus): boolean {
  return status === "agendado" || status === "encaixe" || status === "nao_compareceu";
}

export interface AppointmentSlot {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: AppointmentStatus;
}

/**
 * Dois horários conflitam quando ambos ocupam a agenda (status ativo) e os
 * intervalos [início, fim) se sobrepõem. Usado para avisar antes de criar um
 * agendamento em cima de outro já existente — nunca bloqueia (pode ser um
 * encaixe proposital), só avisa.
 */
export function findConflicts(
  candidate: AppointmentSlot,
  existing: AppointmentSlot[],
): AppointmentSlot[] {
  if (!isActiveStatus(candidate.status)) return [];
  const start = new Date(candidate.scheduledAt).getTime();
  const end = start + candidate.durationMinutes * 60_000;
  if (Number.isNaN(start)) return [];

  return existing.filter((item) => {
    if (item.id === candidate.id) return false;
    if (!isActiveStatus(item.status)) return false;
    const itemStart = new Date(item.scheduledAt).getTime();
    const itemEnd = itemStart + item.durationMinutes * 60_000;
    if (Number.isNaN(itemStart)) return false;
    return start < itemEnd && itemStart < end;
  });
}

export function groupByDay<T extends { scheduled_at: string }>(
  appointments: T[],
): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const appointment of appointments) {
    const day = appointment.scheduled_at.slice(0, 10);
    const bucket = groups.get(day);
    if (bucket) bucket.push(appointment);
    else groups.set(day, [appointment]);
  }
  for (const bucket of groups.values()) {
    bucket.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
  }
  return groups;
}

/** Início (domingo) da semana que contém `date`, à meia-noite local. */
export function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - result.getDay());
  return result;
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
