import { describe, expect, test } from "bun:test";
import {
  addDays,
  findConflicts,
  groupByDay,
  isActiveStatus,
  needsAttention,
  startOfWeek,
} from "./agenda";

describe("isActiveStatus", () => {
  test("agendado, encaixe e confirmados ocupam a agenda", () => {
    expect(isActiveStatus("agendado")).toBe(true);
    expect(isActiveStatus("encaixe")).toBe(true);
    expect(isActiveStatus("confirmado_profissional")).toBe(true);
    expect(isActiveStatus("confirmado_paciente")).toBe(true);
  });

  test("cancelados e faltas não ocupam a agenda", () => {
    expect(isActiveStatus("desmarcado_profissional")).toBe(false);
    expect(isActiveStatus("desmarcado_paciente")).toBe(false);
    expect(isActiveStatus("nao_compareceu")).toBe(false);
    expect(isActiveStatus("realizado")).toBe(false);
  });
});

describe("needsAttention", () => {
  test("agendado, encaixe e não compareceu precisam de ação", () => {
    expect(needsAttention("agendado")).toBe(true);
    expect(needsAttention("encaixe")).toBe(true);
    expect(needsAttention("nao_compareceu")).toBe(true);
  });

  test("confirmado e realizado não precisam de ação", () => {
    expect(needsAttention("confirmado_paciente")).toBe(false);
    expect(needsAttention("realizado")).toBe(false);
  });
});

describe("findConflicts", () => {
  const base = {
    id: "a",
    scheduledAt: "2026-11-02T14:00:00.000Z",
    durationMinutes: 50,
    status: "agendado" as const,
  };

  test("detecta sobreposição parcial", () => {
    const overlapping = { ...base, id: "b", scheduledAt: "2026-11-02T14:30:00.000Z" };
    expect(findConflicts(base, [overlapping])).toEqual([overlapping]);
  });

  test("não detecta horários encostados (fim de um = início do outro)", () => {
    const adjacent = { ...base, id: "b", scheduledAt: "2026-11-02T14:50:00.000Z" };
    expect(findConflicts(base, [adjacent])).toEqual([]);
  });

  test("ignora conflito consigo mesmo", () => {
    expect(findConflicts(base, [base])).toEqual([]);
  });

  test("ignora agendamentos desmarcados", () => {
    const cancelled = { ...base, id: "b", status: "desmarcado_paciente" as const };
    expect(findConflicts(base, [cancelled])).toEqual([]);
  });

  test("um encaixe proposital não é bloqueado, só reportado", () => {
    const encaixe = { ...base, id: "b", status: "encaixe" as const };
    expect(findConflicts(base, [encaixe]).map((c) => c.id)).toEqual(["b"]);
  });
});

describe("groupByDay", () => {
  test("agrupa e ordena por horário dentro do dia", () => {
    const items = [
      { scheduled_at: "2026-11-02T18:00:00.000Z" },
      { scheduled_at: "2026-11-02T13:00:00.000Z" },
      { scheduled_at: "2026-11-03T09:00:00.000Z" },
    ];
    const groups = groupByDay(items);
    expect([...groups.keys()]).toEqual(["2026-11-02", "2026-11-03"]);
    expect(groups.get("2026-11-02")?.map((i) => i.scheduled_at)).toEqual([
      "2026-11-02T13:00:00.000Z",
      "2026-11-02T18:00:00.000Z",
    ]);
  });
});

describe("startOfWeek / addDays", () => {
  test("volta para o domingo da semana", () => {
    const wednesday = new Date(2026, 10, 4); // 4 nov 2026 é uma quarta
    const sunday = startOfWeek(wednesday);
    expect(sunday.getDay()).toBe(0);
    expect(sunday.getDate()).toBe(1);
  });

  test("addDays soma dias preservando o horário zerado", () => {
    const start = startOfWeek(new Date(2026, 10, 4));
    expect(addDays(start, 6).getDay()).toBe(6);
  });
});
