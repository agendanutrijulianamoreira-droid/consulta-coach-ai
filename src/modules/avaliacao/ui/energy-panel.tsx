import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Check, Equal, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as db from "@/lib/nutrios/repository";
import { biologicalSex } from "@/modules/avaliacao/domain/anthropometry";
import {
  ACTIVITY_FACTORS,
  EER_ACTIVITY_OPTIONS,
  ENERGY_FORMULAS,
  INJURY_FACTORS,
  PREGNANCY_OPTIONS,
  calculateEnergy,
  type EerActivity,
  type EnergyInputs,
} from "@/modules/avaliacao/domain/energy";

export function EnergyPanel({ consultationId: id, value, onChange }: { consultationId: string; value: EnergyInputs; onChange: (next: EnergyInputs) => void }) {
  const consultation = useQuery({ queryKey: ["consultation", id], queryFn: () => db.getConsultation(id) });
  const patientSex = biologicalSex(consultation.data?.patients?.sex ?? null);
  const result = calculateEnergy(value);
  const set = (patch: Partial<EnergyInputs>) => onChange({ ...value, ...patch });
  const estimates = [...result.estimates, result.eer];
  const selectedFormula = ENERGY_FORMULAS.find((item) => item.value === value.formula);
  const selectedEstimate = estimates.find((item) => item.key === value.formula);
  const isEer = value.formula === "eer";

  useEffect(() => {
    if (value.sex !== null || patientSex === null) return;
    onChange({ ...value, sex: patientSex });
  }, [onChange, patientSex, value]);

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-medium">Base do cálculo energético</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              Peso, altura, idade e massa livre de gordura são trazidos da avaliação. Se precisar corrigir um dado apenas para este cálculo, você pode editar aqui sem alterar a antropometria original.
            </p>
          </div>
          <span className="rounded bg-muted px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">{selectedFormula?.kind === "total" ? "necessidade total" : "taxa basal"}</span>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Peso (kg)" value={value.weight} onChange={(weight) => set({ weight })} />
          <Field label="Altura (cm)" value={value.height} onChange={(height) => set({ height })} />
          <Field label="Idade (anos)" value={value.age} onChange={(age) => set({ age })} />
          <Field label="Massa livre de gordura (kg)" value={value.leanMass} onChange={(leanMass) => set({ leanMass })} />
        </div>

        <div className="mt-4">
          <p className="mb-2 text-xs text-muted-foreground">Sexo biológico usado pelas equações que exigem esse dado</p>
          <div className="flex flex-wrap gap-2">
            <ChoiceButton active={value.sex === "female"} onClick={() => set({ sex: "female" })}>Feminino</ChoiceButton>
            <ChoiceButton active={value.sex === "male"} onClick={() => set({ sex: "male" })}>Masculino</ChoiceButton>
            <ChoiceButton active={value.sex === null} onClick={() => set({ sex: null })}>Não informado</ChoiceButton>
          </div>
          {patientSex !== null ? <p className="mt-2 text-[11px] text-muted-foreground">Pré-preenchido a partir do cadastro do paciente; pode ser confirmado ou corrigido para este cálculo.</p> : <p className="mt-2 text-[11px] text-muted-foreground">O cadastro não possui sexo biológico reconhecido. Fórmulas dependentes desse dado permanecem bloqueadas.</p>}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-5">
          <section>
            <div className="mb-2">
              <h3 className="text-sm font-medium">1. Escolha a equação</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Compare os valores disponíveis; somente a fórmula marcada alimentará os próximos cálculos.</p>
            </div>
            <div className="space-y-1.5">
              {estimates.map((estimate) => {
                const active = value.formula === estimate.key;
                const disabled = estimate.kcal === null;
                return (
                  <button
                    key={estimate.key}
                    type="button"
                    disabled={disabled}
                    onClick={() => set({ formula: estimate.key })}
                    className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2.5 text-left text-sm transition-colors ${active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"} ${disabled ? "cursor-not-allowed opacity-55" : ""}`}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-medium">{active ? <Check className="size-4" /> : null}{estimate.label}</span>
                      {estimate.note ? <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{estimate.note}</span> : null}
                      {disabled && estimate.requires?.length ? <span className="mt-0.5 block text-[11px] leading-4 text-destructive">Falta: {estimate.requires.join(", ")}</span> : null}
                    </span>
                    <span className="shrink-0 font-semibold tabular-nums">{estimate.kcal !== null ? `${estimate.kcal} kcal` : "—"}</span>
                  </button>
                );
              })}
            </div>
          </section>

          <section className="rounded-md border border-border p-4">
            <h3 className="text-sm font-medium">2. Atividade física</h3>
            {isEer ? (
              <div className="mt-3">
                <p className="mb-2 text-xs leading-5 text-muted-foreground">A EER possui categorias próprias de atividade física. Não será aplicado outro fator nem serão somadas calorias de MET por cima dela.</p>
                <label className="text-xs text-muted-foreground">
                  Categoria EER
                  <select value={value.eerActivity} onChange={(event) => set({ eerActivity: event.target.value as EerActivity })} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                    {EER_ACTIVITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
              </div>
            ) : (
              <>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <MethodButton active={value.exerciseMode === "activity_factor"} title="Fator de atividade diário" text="Usa um multiplicador global da rotina. MET não é somado." onClick={() => set({ exerciseMode: "activity_factor" })} />
                  <MethodButton active={value.exerciseMode === "met"} title="Rotina sedentária + exercício em MET" text="Usa base 1,20 e adiciona apenas o custo líquido do exercício." onClick={() => set({ exerciseMode: "met" })} />
                </div>
                {value.exerciseMode === "activity_factor" ? (
                  <div className="mt-3"><Select label="Fator de atividade" value={value.activityFactor} options={ACTIVITY_FACTORS} onChange={(activityFactor) => set({ activityFactor })} /></div>
                ) : (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Intensidade (MET)" value={value.met} onChange={(met) => set({ met })} />
                    <Field label="Duração média (min/dia)" value={value.metMinutes} onChange={(metMinutes) => set({ metMinutes })} />
                  </div>
                )}
              </>
            )}
          </section>

          <section className="rounded-md border border-border p-4">
            <h3 className="text-sm font-medium">3. Ajustes clínicos</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Esses ajustes nunca são inferidos automaticamente pelo diagnóstico. A decisão permanece com a nutricionista.</p>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <Select label="Fator de estresse / injúria" value={value.injuryFactor} options={INJURY_FACTORS} onChange={(injuryFactor) => set({ injuryFactor })} />
              <label className="space-y-1.5 text-xs text-muted-foreground">
                <span>Gestação / lactação</span>
                <select value={value.pregnancy} disabled={value.sex !== "female"} onChange={(event) => set({ pregnancy: event.target.value })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:opacity-50">
                  {PREGNANCY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                {value.sex !== "female" ? <span className="block text-[11px]">Disponível quando o sexo biológico informado é feminino.</span> : null}
              </label>
            </div>
          </section>

          <section className="rounded-md border border-border p-4">
            <h3 className="text-sm font-medium">4. Meta calórica da prescrição</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Primeiro calculamos o GET de manutenção. Depois você escolhe o déficit ou superávit que será enviado ao cardápio.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[-500, -300, -200, 0, 200, 300].map((adjustment) => (
                <Button key={adjustment} type="button" size="sm" variant={value.manualAdjust === adjustment ? "default" : "outline"} onClick={() => set({ manualAdjust: adjustment })}>
                  {adjustment < 0 ? <Minus /> : adjustment > 0 ? <Plus /> : <Equal />}{adjustment === 0 ? "Manutenção" : `${Math.abs(adjustment)} kcal`}
                </Button>
              ))}
            </div>
            <div className="mt-3 max-w-xs"><Field label="Ajuste personalizado (kcal/dia)" value={value.manualAdjust} onChange={(manualAdjust) => set({ manualAdjust: manualAdjust ?? 0 })} /></div>
          </section>
        </div>

        <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-md border border-border p-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">GET de manutenção estimado</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">{result.maintenanceKcal !== null ? result.maintenanceKcal : "—"}<span className="ml-1 text-sm font-normal text-muted-foreground">kcal/dia</span></p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Estimativa de gasto/necessidade antes do déficit ou superávit da prescrição.</p>
          </div>

          <div className="rounded-md border border-primary/40 bg-primary/5 p-4">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Meta para o plano alimentar</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums text-primary">{result.targetKcal !== null ? result.targetKcal : "—"}<span className="ml-1 text-sm font-normal text-muted-foreground">kcal/dia</span></p>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">Este é o valor que seguirá para o cardápio quando os cálculos forem salvos.</p>
          </div>

          <div className="space-y-1">
            <Row label={isEer ? "EER selecionada" : "TMB/GER selecionada"} value={selectedEstimate?.kcal !== null && selectedEstimate?.kcal !== undefined ? `${selectedEstimate.kcal} kcal` : "—"} />
            <Row label="Atividade" value={isEer ? EER_ACTIVITY_OPTIONS.find((item) => item.value === value.eerActivity)?.label ?? "—" : value.exerciseMode === "activity_factor" ? `× ${value.activityFactor.toLocaleString("pt-BR")}` : "base 1,20 + MET"} />
            {!isEer && value.exerciseMode === "met" ? <Row label="Exercício líquido" value={result.metKcal ? `+ ${result.metKcal} kcal` : "—"} /> : null}
            <Row label="Estresse / injúria" value={value.injuryFactor === 1 ? "não aplicado" : `× ${value.injuryFactor.toLocaleString("pt-BR")}`} />
            <Row label="Gestação / lactação" value={result.pregnancyKcal ? `+ ${result.pregnancyKcal} kcal` : "—"} />
            <Row label="Ajuste da prescrição" value={value.manualAdjust ? `${value.manualAdjust > 0 ? "+" : ""}${value.manualAdjust} kcal` : "0 kcal"} />
          </div>

          {result.issues.length ? (
            <div className="space-y-2 rounded-md border border-border bg-muted/30 p-3">
              {result.issues.map((issue, index) => <p key={`${issue.message}-${index}`} className={`flex gap-2 text-xs leading-5 ${issue.severity === "error" ? "text-destructive" : "text-muted-foreground"}`}><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{issue.message}</p>)}
            </div>
          ) : (
            <div className="flex gap-2 rounded-md border border-border p-3 text-xs leading-5 text-muted-foreground"><Check className="mt-0.5 size-3.5 shrink-0" />Cálculo consistente com os dados e opções selecionados.</div>
          )}
        </aside>
      </div>
    </div>
  );
}

function ChoiceButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Button type="button" size="sm" variant={active ? "default" : "outline"} onClick={onClick}>{active ? <Check /> : null}{children}</Button>;
}

function MethodButton({ active, title, text, onClick }: { active: boolean; title: string; text: string; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`rounded-md border p-3 text-left transition-colors ${active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}><span className="flex items-center gap-2 text-sm font-medium">{active ? <Check className="size-4" /> : null}{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{text}</span></button>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm"><span className="text-muted-foreground">{label}</span><span className="font-medium tabular-nums text-right">{value}</span></div>;
}

function Field({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return <label className="text-xs text-muted-foreground">{label}<Input inputMode="decimal" value={value ?? ""} onChange={(event) => { const parsed = Number(event.target.value.replace(",", ".")); onChange(event.target.value.trim() === "" || Number.isNaN(parsed) ? null : parsed); }} className="mt-1 text-sm" /></label>;
}

function Select({ label, value, options, onChange }: { label: string; value: number; options: { value: number; label: string }[]; onChange: (value: number) => void }) {
  return <label className="space-y-1.5 text-xs text-muted-foreground"><span>{label}</span><select value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>;
}
