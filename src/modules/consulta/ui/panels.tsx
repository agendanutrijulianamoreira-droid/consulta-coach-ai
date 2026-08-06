import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ANAMNESIS_FIELDS, type AnamnesisFields, type AnamnesisKey, type RecallItem } from "@/lib/nutrios/types";
import type { AnthropometryData } from "@/lib/nutrios/repository";

export function AnamnesisPanel({ fields, onChange }: { fields: AnamnesisFields; onChange: (next: AnamnesisFields) => void }) {
  const [editing, setEditing] = useState<AnamnesisKey | null>(null);
  const update = (key: AnamnesisKey, value: Partial<AnamnesisFields[AnamnesisKey]>) => {
    const current = fields[key] ?? { value: "", status: "sugerido" as const };
    onChange({ ...fields, [key]: { ...current, ...value } });
  };
  return <div className="divide-y divide-border rounded-md border border-border">
    <div className="flex items-center justify-between bg-muted/30 px-3 py-2 text-xs text-muted-foreground"><span>Campo clínico</span><span>Revisão profissional</span></div>
    {ANAMNESIS_FIELDS.map(({ key, label }) => {
      const field = fields[key]; const status = field?.status ?? "sugerido";
      return <div key={key} className="group grid gap-2 px-3 py-3 sm:grid-cols-[150px_1fr_auto] sm:items-start">
        <span className="pt-1 text-xs text-muted-foreground">{label}</span>
        {editing === key ? <Textarea autoFocus value={field?.value ?? ""} onChange={(event) => update(key, { value: event.target.value, status: "editado" })} onBlur={() => setEditing(null)} className="min-h-9 text-sm" /> : <button type="button" onClick={() => setEditing(key)} className={`min-h-6 text-left text-sm ${status === "recusado" ? "text-muted-foreground line-through" : ""} ${field?.value ? "" : "text-muted-foreground"}`}>{field?.value || "—"}</button>}
        <div className="flex items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <StatusButton active={status === "aceito"} title="Aceitar sugestão" onClick={() => update(key, { status: "aceito" })}><Check /></StatusButton>
          <StatusButton active={editing === key} title="Editar campo" onClick={() => setEditing(key)}><Pencil /></StatusButton>
          <StatusButton active={status === "recusado"} title="Recusar sugestão" onClick={() => update(key, { status: "recusado" })}><X /></StatusButton>
        </div>
      </div>;
    })}
  </div>;
}

function StatusButton({ children, active, title, onClick }: { children: React.ReactNode; active: boolean; title: string; onClick: () => void }) {
  return <Button type="button" variant="ghost" size="icon" title={title} aria-label={title} onClick={onClick} className={`size-7 ${active ? "bg-accent text-foreground" : "text-muted-foreground"}`}>{children}</Button>;
}

const ANTHRO_FIELDS: { key: keyof AnthropometryData; label: string; unit: string }[] = [
  { key: "peso", label: "Peso", unit: "kg" }, { key: "altura", label: "Altura", unit: "cm" }, { key: "cintura", label: "Cintura", unit: "cm" }, { key: "quadril", label: "Quadril", unit: "cm" }, { key: "braco", label: "Braço", unit: "cm" }, { key: "dobras", label: "Dobras cutâneas", unit: "mm" }, { key: "gordura", label: "Gordura corporal", unit: "%" }, { key: "massa_muscular", label: "Massa muscular", unit: "kg" }, { key: "agua_corporal", label: "Água corporal", unit: "%" }, { key: "bioimpedancia", label: "Observações da bioimpedância", unit: "" },
];
export function calculateBmi(data: AnthropometryData) { const weight = Number((data.peso ?? "").replace(",", ".")); const height = Number((data.altura ?? "").replace(",", ".")) / 100; if (!weight || !height) return null; return weight / (height * height); }
export function AnthropometryPanel({ data, interpretation, onChange }: { data: AnthropometryData; interpretation: string; onChange: (next: AnthropometryData) => void }) {
  const bmi = calculateBmi(data);
  return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{ANTHRO_FIELDS.map(({ key, label, unit }) => <label key={key} className="text-xs text-muted-foreground">{label} {unit ? `(${unit})` : ""}<Input value={data[key] ?? ""} onChange={(event) => onChange({ ...data, [key]: event.target.value })} className="mt-1 text-sm" /></label>)}</div>{bmi ? <p className="text-sm"><span className="text-muted-foreground">IMC calculado:</span> <span className="font-medium tabular-nums">{bmi.toFixed(1)}</span></p> : null}{interpretation ? <div className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-sm">{interpretation}</div> : null}</div>;
}

export function RecallPanel({ items, onChange, onRemove, onAdd }: { items: RecallItem[]; onChange: (item: RecallItem) => void; onRemove: (id: string) => void; onAdd: () => void }) {
  return <div className="space-y-2"><div className="overflow-x-auto rounded-md border border-border"><table className="w-full min-w-[680px] text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-3 py-2 text-left font-medium">Horário</th><th className="px-3 py-2 text-left font-medium">Alimentos</th><th className="px-3 py-2 text-left font-medium">Quantidade</th><th className="px-3 py-2 text-left font-medium">Preparo</th><th className="w-10" /></tr></thead><tbody className="divide-y divide-border">{items.map((item) => <tr key={item.id}>{(["time_label", "foods", "amount", "preparation"] as const).map((field) => <td key={field} className="p-0"><input value={item[field] ?? ""} onChange={(event) => onChange({ ...item, [field]: event.target.value })} className="w-full bg-transparent px-3 py-2 outline-none focus:bg-accent/40" /></td>)}<td className="px-2"><Button type="button" variant="ghost" size="icon" onClick={() => onRemove(item.id)} className="size-7 text-muted-foreground" title="Remover refeição" aria-label="Remover refeição"><Trash2 /></Button></td></tr>)}{items.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Nenhuma refeição registrada.</td></tr> : null}</tbody></table></div><Button variant="secondary" size="sm" onClick={onAdd}><Plus /> Adicionar refeição</Button></div>;
}

export function DiagnosisPanel({ hypotheses, flags, onChange }: { hypotheses: string[]; flags: string[]; onChange: (hypotheses: string[]) => void }) {
  return <div className="grid gap-6 lg:grid-cols-2"><section><h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Sinalizações do recordatório</h3><ul className="space-y-1.5 text-sm">{flags.length ? flags.map((flag) => <li key={flag} className="rounded-md border border-border px-3 py-2">{flag}</li>) : <li className="text-muted-foreground">Nenhuma sinalização gerada ainda.</li>}</ul></section><section><h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Hipóteses nutricionais (sugestão)</h3><div className="space-y-2">{hypotheses.map((hypothesis, index) => <div key={index} className="flex gap-2"><Input value={hypothesis} onChange={(event) => { const next = [...hypotheses]; next[index] = event.target.value; onChange(next); }} className="text-sm" /><Button type="button" variant="ghost" size="icon" onClick={() => onChange(hypotheses.filter((_, i) => i !== index))} className="shrink-0 text-muted-foreground" title="Remover hipótese" aria-label="Remover hipótese"><Trash2 /></Button></div>)}<Button variant="secondary" size="sm" onClick={() => onChange([...hypotheses, ""])}><Plus /> Adicionar hipótese</Button><p className="text-xs text-muted-foreground">Todas as hipóteses são sugestões automáticas e exigem validação profissional.</p></div></section></div>;
}
