import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CircleAlert, DollarSign, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { brl } from "@/modules/sprint/domain/kpis";
import * as sprintDb from "@/modules/sprint/infrastructure/repository";
import { buildInstallments, summarizeEntries } from "@/modules/financeiro/domain/financeiro";

type Props = {
  patientId: string;
};

export function FinanceiroSection({ patientId }: Props) {
  const queryClient = useQueryClient();
  const entriesQuery = useQuery({
    queryKey: ["finance-entries", patientId],
    queryFn: () => sprintDb.listEntriesForPatient(patientId),
  });
  const [form, setForm] = useState({
    entry_type: "contrato" as "contrato" | "recebimento",
    amount: "",
    entry_date: new Date().toISOString().slice(0, 10),
    installments: "1",
    description: "",
  });

  const registrar = useMutation({
    mutationFn: async () => {
      const amount = Number(form.amount);
      const installments = Math.max(1, Math.floor(Number(form.installments) || 1));

      if (form.entry_type === "contrato") {
        await sprintDb.createEntry({
          entry_type: "contrato",
          amount,
          entry_date: form.entry_date,
          status: "ok",
          patient_id: patientId,
          description: form.description || null,
        });
        if (installments > 1) {
          const plans = buildInstallments(amount, installments, form.entry_date);
          for (const plan of plans) {
            await sprintDb.createEntry({
              entry_type: "recebimento",
              amount: plan.amount,
              entry_date: form.entry_date,
              due_date: plan.dueDate,
              status: "pendente",
              patient_id: patientId,
              description: form.description
                ? `${form.description} — parcela`
                : "Parcela do contrato",
            });
          }
        }
      } else {
        await sprintDb.createEntry({
          entry_type: "recebimento",
          amount,
          entry_date: form.entry_date,
          status: "ok",
          patient_id: patientId,
          description: form.description || null,
        });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["finance-entries", patientId] });
      setForm({ ...form, amount: "", installments: "1", description: "" });
      toast.success("Lançamento registrado.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const marcarPago = useMutation({
    mutationFn: (id: string) => sprintDb.updateEntryStatus(id, "ok"),
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: ["finance-entries", patientId] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const entries = entriesQuery.data ?? [];
  const summary = summarizeEntries(entries);

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-6">
      <div>
        <h2 className="text-lg font-semibold">Financeiro</h2>
        <p className="text-sm text-muted-foreground">
          Contratos, recebimentos e parcelas desta paciente. Os mesmos lançamentos aparecem no
          painel financeiro agregado de Meu Consultório.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="Contratado" value={brl(summary.contracted)} />
        <SummaryCard label="Recebido" value={brl(summary.received)} />
        <SummaryCard label="Pendente" value={brl(summary.pending)} />
        <SummaryCard label="Atrasado" value={brl(summary.overdue)} warn={summary.overdue > 0} />
      </div>

      <div className="cach-panel space-y-3 p-4">
        <p className="text-sm font-medium">Novo lançamento</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <select
            value={form.entry_type}
            onChange={(e) =>
              setForm({ ...form, entry_type: e.target.value as "contrato" | "recebimento" })
            }
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            <option value="contrato">Contrato (venda do protocolo/método)</option>
            <option value="recebimento">Recebimento avulso</option>
          </select>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="Valor total"
            value={form.amount}
            onChange={(e) => setForm({ ...form, amount: e.target.value })}
          />
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Data</Label>
            <Input
              type="date"
              value={form.entry_date}
              onChange={(e) => setForm({ ...form, entry_date: e.target.value })}
            />
          </div>
          {form.entry_type === "contrato" ? (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Número de parcelas</Label>
              <Input
                type="number"
                min="1"
                value={form.installments}
                onChange={(e) => setForm({ ...form, installments: e.target.value })}
              />
            </div>
          ) : null}
          <Input
            className="sm:col-span-2"
            placeholder="Descrição (opcional)"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {form.entry_type === "contrato" && Number(form.installments) > 1
            ? `Gera 1 lançamento de contrato e ${Math.floor(Number(form.installments))} recebimentos mensais pendentes.`
            : "Nada é cobrado automaticamente — isso só registra o lançamento."}
        </p>
        <Button
          type="button"
          disabled={registrar.isPending || !form.amount || Number(form.amount) <= 0}
          onClick={() => registrar.mutate()}
        >
          {registrar.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Registrar
        </Button>
      </div>

      <div className="divide-y divide-border rounded-lg border border-border">
        {entries.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhum lançamento financeiro ainda.</p>
        ) : (
          entries.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div className="flex items-center gap-2">
                {entry.status === "atrasado" ? (
                  <CircleAlert className="size-4 shrink-0 text-destructive" />
                ) : (
                  <DollarSign className="size-4 shrink-0 text-muted-foreground" />
                )}
                <div>
                  <p className="font-medium">
                    {entry.description || ENTRY_LABEL[entry.entry_type] || entry.entry_type}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {ENTRY_LABEL[entry.entry_type] ?? entry.entry_type} ·{" "}
                    {new Date(`${entry.entry_date}T12:00:00`).toLocaleDateString("pt-BR")}
                    {entry.due_date
                      ? ` · vence ${new Date(`${entry.due_date}T12:00:00`).toLocaleDateString("pt-BR")}`
                      : ""}{" "}
                    · {STATUS_LABEL[entry.status] ?? entry.status}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-semibold">{brl(Number(entry.amount))}</span>
                {entry.entry_type === "recebimento" && entry.status !== "ok" ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={marcarPago.isPending}
                    onClick={() => marcarPago.mutate(entry.id)}
                  >
                    Marcar como pago
                  </Button>
                ) : null}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

const ENTRY_LABEL: Record<string, string> = {
  contrato: "Contrato",
  recebimento: "Recebimento",
  reconhecimento: "Reconhecimento",
};

const STATUS_LABEL: Record<string, string> = {
  ok: "pago",
  pendente: "pendente",
  atrasado: "atrasado",
};

function SummaryCard({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className={`cach-panel p-3 ${warn ? "border-destructive/40" : ""}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${warn ? "text-destructive" : ""}`}>{value}</p>
    </div>
  );
}
