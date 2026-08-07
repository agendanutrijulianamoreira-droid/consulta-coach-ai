/**
 * Aba de cálculos energéticos.
 *
 * Os dados vêm pré-preenchidos da antropometria e do cadastro do paciente; a
 * nutricionista apenas escolhe a fórmula e ajusta atividade, injúria, MET e o
 * adicional para gestantes/lactantes.
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ACTIVITY_FACTORS,
  ENERGY_FORMULAS,
  INJURY_FACTORS,
  PREGNANCY_OPTIONS,
  calculateEnergy,
  type EnergyInputs,
} from "@/modules/avaliacao/domain/energy";

export function EnergyPanel({ value, onChange }: { value: EnergyInputs; onChange: (next: EnergyInputs) => void }) {
  const result = calculateEnergy(value);
  const set = (patch: Partial<EnergyInputs>) => onChange({ ...value, ...patch });

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        <section className="rounded-md border border-border p-4">
          <h3 className="text-sm font-medium">Dados usados no cálculo</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">Pré-preenchidos pela antropometria e pelo cadastro — ajuste se precisar.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Peso (kg)" value={value.weight} onChange={(weight) => set({ weight })} />
            <Field label="Altura (cm)" value={value.height} onChange={(height) => set({ height })} />
            <Field label="Idade (anos)" value={value.age} onChange={(age) => set({ age })} />
            <Field label="Massa magra (kg)" value={value.leanMass} onChange={(leanMass) => set({ leanMass })} />
          </div>
          <div className="mt-3 flex gap-1.5">
            {[
              { label: "Feminino", male: false },
              { label: "Masculino", male: true },
            ].map((option) => (
              <Button key={option.label} type="button" size="sm" variant={value.male === option.male ? "default" : "outline"} onClick={() => set({ male: option.male })}>
                {option.label}
              </Button>
            ))}
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-sm font-medium">Taxa metabólica basal (TMB)</h3>
          <div className="space-y-1">
            {result.estimates.map((estimate) => {
              const active = value.formula === estimate.key;
              return (
                <button
                  key={estimate.key}
                  type="button"
                  onClick={() => set({ formula: estimate.key })}
                  className={`flex w-full items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition-colors ${active ? "border-primary bg-accent" : "border-border hover:bg-accent/50"}`}
                >
                  <span>
                    <span className="block">{estimate.label}</span>
                    {estimate.note ? <span className="block text-[11px] text-muted-foreground">{estimate.note}</span> : null}
                  </span>
                  <span className="shrink-0 font-medium tabular-nums">{estimate.kcal ? `${estimate.kcal} kcal` : "—"}</span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {ENERGY_FORMULAS.find((f) => f.value === value.formula)?.label ?? "Fórmula"} é a base do gasto energético total.
          </p>
        </section>

        <section className="grid gap-4 sm:grid-cols-2">
          <Select label="Fator de atividade" value={value.activityFactor} options={ACTIVITY_FACTORS} onChange={(activityFactor) => set({ activityFactor })} />
          <Select label="Fator de injúria" value={value.injuryFactor} options={INJURY_FACTORS} onChange={(injuryFactor) => set({ injuryFactor })} />
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Atividade em MET</span>
            <div className="grid grid-cols-2 gap-2">
              <Field label="MET" value={value.met} onChange={(met) => set({ met })} />
              <Field label="Minutos/dia" value={value.metMinutes} onChange={(metMinutes) => set({ metMinutes })} />
            </div>
          </div>
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">Adicional energético (gestação/lactação)</span>
            <select
              value={value.pregnancy}
              onChange={(event) => set({ pregnancy: event.target.value })}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {PREGNANCY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <Field label="Ajuste clínico manual (kcal)" value={value.manualAdjust} onChange={(manualAdjust) => set({ manualAdjust: manualAdjust ?? 0 })} />
        </section>
      </div>

      <aside className="space-y-3 lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-md border border-border p-4">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Gasto energético total (GET)</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">{result.tee ? `${result.tee}` : "—"}<span className="ml-1 text-sm font-normal text-muted-foreground">kcal/dia</span></p>
          <p className="mt-2 text-xs text-muted-foreground">Este valor alimenta automaticamente o plano alimentar.</p>
        </div>
        <Row label="TMB escolhida" value={result.bmr ? `${result.bmr} kcal` : "—"} />
        <Row label="Fator de atividade" value={value.formula === "eer" ? "Incluído na EER" : `× ${value.activityFactor.toLocaleString("pt-BR")}`} />
        <Row label="Fator de injúria" value={`× ${value.injuryFactor.toLocaleString("pt-BR")}`} />
        <Row label="Atividade MET" value={result.metKcal ? `+ ${result.metKcal} kcal` : "—"} />
        <Row label="Gestação / lactação" value={result.pregnancyKcal ? `+ ${result.pregnancyKcal} kcal` : "—"} />
        <Row label="Ajuste manual" value={value.manualAdjust ? `${value.manualAdjust > 0 ? "+" : ""}${value.manualAdjust} kcal` : "—"} />
      </aside>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: number | null; onChange: (value: number | null) => void }) {
  return (
    <label className="text-xs text-muted-foreground">
      {label}
      <Input
        inputMode="decimal"
        value={value ?? ""}
        onChange={(event) => {
          const parsed = Number(event.target.value.replace(",", "."));
          onChange(event.target.value.trim() === "" || Number.isNaN(parsed) ? null : parsed);
        }}
        className="mt-1 text-sm"
      />
    </label>
  );
}

function Select({ label, value, options, onChange }: { label: string; value: number; options: { value: number; label: string }[]; onChange: (value: number) => void }) {
  return (
    <label className="space-y-1.5 text-xs text-muted-foreground">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(Number(event.target.value))} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}