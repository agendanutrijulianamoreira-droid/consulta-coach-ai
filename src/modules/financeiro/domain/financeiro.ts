export type EntryType = "contrato" | "recebimento" | "reconhecimento";
export type EntryStatus = "ok" | "pendente" | "atrasado";

export type FinanceEntryLike = {
  entry_type: string;
  amount: number;
  status: string;
};

export interface PatientFinanceSummary {
  contracted: number;
  received: number;
  pending: number;
  overdue: number;
}

/** Soma pura por tipo/status — mesma lógica do painel executivo (kpis.ts), sem o funil de leads. */
export function summarizeEntries(entries: FinanceEntryLike[]): PatientFinanceSummary {
  const receipts = entries.filter((e) => e.entry_type === "recebimento");
  return {
    contracted: entries
      .filter((e) => e.entry_type === "contrato")
      .reduce((sum, e) => sum + Number(e.amount), 0),
    received: receipts
      .filter((e) => e.status === "ok")
      .reduce((sum, e) => sum + Number(e.amount), 0),
    pending: receipts
      .filter((e) => e.status === "pendente")
      .reduce((sum, e) => sum + Number(e.amount), 0),
    overdue: receipts
      .filter((e) => e.status === "atrasado")
      .reduce((sum, e) => sum + Number(e.amount), 0),
  };
}

export interface InstallmentPlan {
  amount: number;
  dueDate: string;
}

/**
 * Divide um valor em N parcelas mensais a partir da data do contrato.
 * Última parcela absorve a diferença de centavos do arredondamento.
 */
export function buildInstallments(
  totalAmount: number,
  installments: number,
  startDate: string,
): InstallmentPlan[] {
  const count = Math.max(1, Math.floor(installments));
  const base = Math.floor((totalAmount / count) * 100) / 100;
  const plans: InstallmentPlan[] = [];
  let remaining = totalAmount;
  const start = new Date(`${startDate}T12:00:00`);
  for (let i = 0; i < count; i++) {
    const due = new Date(start);
    due.setMonth(due.getMonth() + i);
    const amount = i === count - 1 ? Math.round(remaining * 100) / 100 : base;
    remaining -= amount;
    plans.push({ amount, dueDate: due.toISOString().slice(0, 10) });
  }
  return plans;
}
