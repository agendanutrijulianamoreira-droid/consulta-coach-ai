import { describe, expect, test } from "bun:test";
import {
  isCurrentlyOpen,
  sortAndCap,
  tasksFromBirthdays,
  tasksFromNoShowAppointments,
  tasksFromOpenConsultations,
  type TaskCandidate,
} from "./fila";

const patient = (id: string, name: string, birth_date: string | null = null) => ({
  id,
  name,
  birth_date,
});

describe("tasksFromOpenConsultations", () => {
  const patients = [patient("p1", "Camila")];

  test("ignora consultas finalizadas", () => {
    const tasks = tasksFromOpenConsultations(
      [
        {
          id: "c1",
          patient_id: "p1",
          status: "finalizada",
          current_step: "parecer",
          record_kind: "attendance",
          visible_in_history: true,
        },
      ],
      patients,
    );
    expect(tasks).toEqual([]);
  });

  test("ignora consultas arquivadas (visible_in_history=false)", () => {
    const tasks = tasksFromOpenConsultations(
      [
        {
          id: "c1",
          patient_id: "p1",
          status: "em_andamento",
          current_step: "anamnese",
          record_kind: "attendance",
          visible_in_history: false,
        },
      ],
      patients,
    );
    expect(tasks).toEqual([]);
  });

  test("ignora registros de módulo (não são atendimento)", () => {
    const tasks = tasksFromOpenConsultations(
      [
        {
          id: "c1",
          patient_id: "p1",
          status: "em_andamento",
          current_step: "anamnese",
          record_kind: "module",
          visible_in_history: true,
        },
      ],
      patients,
    );
    expect(tasks).toEqual([]);
  });

  test("gera tarefa para consulta aberta visível", () => {
    const tasks = tasksFromOpenConsultations(
      [
        {
          id: "c1",
          patient_id: "p1",
          status: "em_andamento",
          current_step: "anamnese",
          record_kind: "attendance",
          visible_in_history: true,
        },
      ],
      patients,
    );
    expect(tasks.length).toBe(1);
    expect(tasks[0]!.dedupeKey).toBe("consulta_aberta:c1");
    expect(tasks[0]!.titulo).toBe("Consulta em andamento");
  });
});

describe("tasksFromNoShowAppointments", () => {
  const patients = [patient("p1", "Camila")];

  test("gera tarefa quando não há reagendamento posterior", () => {
    const tasks = tasksFromNoShowAppointments(
      [
        {
          id: "a1",
          patient_id: "p1",
          scheduled_at: "2026-11-01T14:00:00.000Z",
          status: "nao_compareceu",
        },
      ],
      patients,
    );
    expect(tasks.length).toBe(1);
    expect(tasks[0]!.dedupeKey).toBe("falta_sem_remarcar:a1");
  });

  test("não gera tarefa quando já existe agendamento posterior", () => {
    const tasks = tasksFromNoShowAppointments(
      [
        {
          id: "a1",
          patient_id: "p1",
          scheduled_at: "2026-11-01T14:00:00.000Z",
          status: "nao_compareceu",
        },
        {
          id: "a2",
          patient_id: "p1",
          scheduled_at: "2026-11-10T14:00:00.000Z",
          status: "agendado",
        },
      ],
      patients,
    );
    expect(tasks).toEqual([]);
  });

  test("ignora agendamentos que não são falta", () => {
    const tasks = tasksFromNoShowAppointments(
      [
        {
          id: "a1",
          patient_id: "p1",
          scheduled_at: "2026-11-01T14:00:00.000Z",
          status: "realizado",
        },
      ],
      patients,
    );
    expect(tasks).toEqual([]);
  });
});

describe("tasksFromBirthdays", () => {
  test("gera tarefa só para quem faz aniversário no mês corrente", () => {
    const now = new Date(2026, 10, 15); // novembro
    const tasks = tasksFromBirthdays(
      [patient("p1", "Camila", "1990-11-20"), patient("p2", "Ana", "1990-03-02")],
      now,
    );
    expect(tasks.length).toBe(1);
    expect(tasks[0]!.patientId).toBe("p1");
    expect(tasks[0]!.dedupeKey).toBe("aniversario:p1:2026");
  });
});

describe("sortAndCap", () => {
  function candidate(prioridade: number, dedupeKey: string): TaskCandidate {
    return {
      dedupeKey,
      tipo: "aniversario",
      patientId: "p1",
      consultationId: null,
      prioridade,
      titulo: "t",
      motivo: "m",
      actionLabel: "a",
      actionSection: null,
    };
  }

  test("ordena por prioridade crescente e corta no teto", () => {
    const tasks = [candidate(5, "a"), candidate(2, "b"), candidate(4, "c"), candidate(1, "d")];
    const result = sortAndCap(tasks, 3);
    expect(result.map((t) => t.dedupeKey)).toEqual(["d", "b", "c"]);
  });
});

describe("isCurrentlyOpen", () => {
  test("aberta sempre conta como aberta", () => {
    expect(isCurrentlyOpen({ status: "aberta", adiadaAte: null })).toBe(true);
  });

  test("adiada com prazo futuro não conta como aberta", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(isCurrentlyOpen({ status: "adiada", adiadaAte: future })).toBe(false);
  });

  test("adiada com prazo vencido volta a contar como aberta", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(isCurrentlyOpen({ status: "adiada", adiadaAte: past })).toBe(true);
  });

  test("feita e descartada nunca contam como aberta", () => {
    expect(isCurrentlyOpen({ status: "feita", adiadaAte: null })).toBe(false);
    expect(isCurrentlyOpen({ status: "descartada", adiadaAte: null })).toBe(false);
  });
});
