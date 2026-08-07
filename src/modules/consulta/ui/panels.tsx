import { Check, ChevronDown, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DictationButton } from "@/components/nutrios/dictation";
import { ANAMNESIS_FIELDS, type AnamnesisFields, type AnamnesisKey, type RecallItem } from "@/lib/nutrios/types";
import {
  ANTHRO_SECTIONS,
  SKINFOLD_FORMULAS,
  SKINFOLD_FORMULA_LABELS,
  analyzeAnthropometry,
  isMale,
  requiredSkinfolds,
  type AnthroData,
  type PatientProfile,
  type SkinfoldFormula,
} from "@/modules/avaliacao/domain/anthropometry";

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
          <DictationButton size="icon" onText={(text) => update(key, { value: field?.value ? `${field.value} ${text}` : text, status: "editado" })} />
          <StatusButton active={status === "recusado"} title="Recusar sugestão" onClick={() => update(key, { status: "recusado" })}><X /></StatusButton>
        </div>
      </div>;
    })}
  </div>;
}

function StatusButton({ children, active, title, onClick }: { children: React.ReactNode; active: boolean; title: string; onClick: () => void }) {
  return <Button type="button" variant="ghost" size="icon" title={title} aria-label={title} onClick={onClick} className={`size-7 ${active ? "bg-accent text-foreground" : "text-muted-foreground"}`}>{children}</Button>;
}

/**
 * Avaliação antropométrica completa: formulário em seções recolhíveis à
 * esquerda e resultados analíticos calculados em tempo real à direita.
 */
export function AnthropometryPanel({ data, interpretation, profile, formula, onFormulaChange, onChange }: {
  data: AnthroData;
  interpretation: string;
  profile: PatientProfile;
  formula: SkinfoldFormula;
  onFormulaChange: (value: SkinfoldFormula) => void;
  onChange: (next: AnthroData) => void;
}) {
  const [open, setOpen] = useState<string[]>(["basicos"]);
  const analysis = analyzeAnthropometry(data, profile, formula);
  const required = requiredSkinfolds(formula, isMale(profile.sex));
  const toggle = (id: string) => setOpen((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-2">
        {ANTHRO_SECTIONS.map((section) => {
          const expanded = open.includes(section.id);
          return (
            <section key={section.id} className="rounded-md border border-border">
              <button type="button" onClick={() => toggle(section.id)} aria-expanded={expanded} className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left">
                <span>
                  <span className="block text-sm font-medium">{section.title}</span>
                  {section.hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{section.hint}</span> : null}
                </span>
                <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
              </button>
              {expanded ? (
                <div className="space-y-3 border-t border-border p-4">
                  {section.id === "dobras" ? (
                    <div className="rounded-md bg-muted/40 p-3">
                      <p className="mb-2 text-xs text-muted-foreground">Fórmula para cálculo do percentual de gordura</p>
                      <div className="flex flex-wrap gap-1.5">
                        {SKINFOLD_FORMULAS.map((option) => (
                          <Button key={option} type="button" size="sm" variant={formula === option ? "default" : "ghost"} onClick={() => onFormulaChange(option)}>
                            {SKINFOLD_FORMULA_LABELS[option]}
                          </Button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    {section.fields.map((field) => {
                      const highlight = section.id === "dobras" && required.includes(field.key);
                      return (
                        <label key={field.key} className="text-xs text-muted-foreground">
                          <span className={highlight ? "text-foreground" : ""}>{field.label}{highlight ? " *" : ""}</span>
                          <Input inputMode="decimal" value={data[field.key] ?? ""} onChange={(event) => onChange({ ...data, [field.key]: event.target.value })} className={`mt-1 text-sm ${highlight ? "border-primary/60" : ""}`} />
                        </label>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
        <h3 className="text-sm font-medium">Resultados analíticos</h3>
        {analysis.groups.map((group) => (
          <div key={group.title}>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.title}</p>
            <div className="space-y-1">
              {group.results.map((result) => (
                <div key={result.label} className="flex items-baseline justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">{result.label}</span>
                  <span className="shrink-0 text-right">
                    <span className="font-medium tabular-nums">{result.value}</span>
                    {result.detail ? <span className="block text-[11px] text-muted-foreground">{result.detail}</span> : null}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
        {interpretation ? <div className="whitespace-pre-wrap rounded-md border border-border p-3 text-sm">{interpretation}</div> : null}
      </aside>
    </div>
  );
}

export function RecallPanel({ items, onChange, onRemove, onAdd }: { items: RecallItem[]; onChange: (item: RecallItem) => void; onRemove: (id: string) => void; onAdd: () => void }) {
  return <div className="space-y-2"><div className="overflow-x-auto rounded-md border border-border"><table className="w-full min-w-[680px] text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-3 py-2 text-left font-medium">Horário</th><th className="px-3 py-2 text-left font-medium">Alimentos</th><th className="px-3 py-2 text-left font-medium">Quantidade</th><th className="px-3 py-2 text-left font-medium">Preparo</th><th className="w-20" /></tr></thead><tbody className="divide-y divide-border">{items.map((item) => <tr key={item.id}>{(["time_label", "foods", "amount", "preparation"] as const).map((field) => <td key={field} className="p-0"><input value={item[field] ?? ""} onChange={(event) => onChange({ ...item, [field]: event.target.value })} className="w-full bg-transparent px-3 py-2 outline-none focus:bg-accent/40" /></td>)}<td className="px-2"><div className="flex items-center gap-1"><DictationButton size="icon" onText={(text) => onChange({ ...item, foods: item.foods ? `${item.foods} ${text}` : text })} /><Button type="button" variant="ghost" size="icon" onClick={() => onRemove(item.id)} className="size-7 text-muted-foreground" title="Remover refeição" aria-label="Remover refeição"><Trash2 /></Button></div></td></tr>)}{items.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Nenhuma refeição registrada.</td></tr> : null}</tbody></table></div><Button variant="secondary" size="sm" onClick={onAdd}><Plus /> Adicionar refeição</Button></div>;
}

export function DiagnosisPanel({ hypotheses, flags, onChange }: { hypotheses: string[]; flags: string[]; onChange: (hypotheses: string[]) => void }) {
  return <div className="grid gap-6 lg:grid-cols-2"><section><h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Sinalizações do recordatório</h3><ul className="space-y-1.5 text-sm">{flags.length ? flags.map((flag) => <li key={flag} className="rounded-md border border-border px-3 py-2">{flag}</li>) : <li className="text-muted-foreground">Nenhuma sinalização gerada ainda.</li>}</ul></section><section><h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Hipóteses nutricionais (sugestão)</h3><div className="space-y-2">{hypotheses.map((hypothesis, index) => <div key={index} className="flex gap-2"><Input value={hypothesis} onChange={(event) => { const next = [...hypotheses]; next[index] = event.target.value; onChange(next); }} className="text-sm" /><Button type="button" variant="ghost" size="icon" onClick={() => onChange(hypotheses.filter((_, i) => i !== index))} className="shrink-0 text-muted-foreground" title="Remover hipótese" aria-label="Remover hipótese"><Trash2 /></Button></div>)}<Button variant="secondary" size="sm" onClick={() => onChange([...hypotheses, ""])}><Plus /> Adicionar hipótese</Button><p className="text-xs text-muted-foreground">Todas as hipóteses são sugestões automáticas e exigem validação profissional.</p></div></section></div>;
}
