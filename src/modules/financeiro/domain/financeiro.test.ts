import { describe, expect, test } from "bun:test";
import { buildInstallments, summarizeEntries } from "./financeiro";

describe("summarizeEntries", () => {
  test("separa contratado, recebido, pendente e atrasado", () => {
    const summary = summarizeEntries([
      { entry_type: "contrato", amount: 3000, status: "ok" },
      { entry_type: "recebimento", amount: 1000, status: "ok" },
      { entry_type: "recebimento", amount: 1000, status: "pendente" },
      { entry_type: "recebimento", amount: 500, status: "atrasado" },
      { entry_type: "reconhecimento", amount: 3000, status: "ok" },
    ]);
    expect(summary.contracted).toBe(3000);
    expect(summary.received).toBe(1000);
    expect(summary.pending).toBe(1000);
    expect(summary.overdue).toBe(500);
  });
});

describe("buildInstallments", () => {
  test("divide em parcelas mensais iguais quando o valor é exato", () => {
    const plans = buildInstallments(3000, 3, "2026-01-15");
    expect(plans.length).toBe(3);
    expect(plans[0]?.amount).toBe(1000);
    expect(plans[1]?.amount).toBe(1000);
    expect(plans[2]?.amount).toBe(1000);
    expect(plans[0]?.dueDate).toBe("2026-01-15");
    expect(plans[1]?.dueDate).toBe("2026-02-15");
    expect(plans[2]?.dueDate).toBe("2026-03-15");
  });

  test("última parcela absorve a diferença de arredondamento", () => {
    const plans = buildInstallments(100, 3, "2026-01-01");
    const total = plans.reduce((sum, p) => sum + p.amount, 0);
    expect(total).toBe(100);
    expect(plans[0]?.amount).toBe(33.33);
    expect(plans[1]?.amount).toBe(33.33);
    expect(plans[2]?.amount).toBe(33.34);
  });

  test("nunca gera menos de uma parcela", () => {
    const plans = buildInstallments(500, 0, "2026-01-01");
    expect(plans.length).toBe(1);
    expect(plans[0]?.amount).toBe(500);
  });
});
