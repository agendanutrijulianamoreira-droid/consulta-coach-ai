import { AlertTriangle, Bed, Check, ChevronDown, Loader2, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import * as db from "@/lib/nutrios/repository";
import {
  ANTHRO_SECTIONS,
  SKINFOLD_FORMULAS,
  SKINFOLD_FORMULA_LABELS,
  analyzeAnthropometry,
  biologicalSex,
  num,
  selectedVisceralScale,
  skinfoldEligibility,
  type AnthroData,
  type PatientProfile,
  type SkinfoldFormula,
  type VisceralScale,
} from "@/modules/avaliacao/domain/anthropometry";
import {
  applyAnthropometryInput,
  applyEstimatedWeight,
  estimateBedriddenWeight,
} from "@/modules/avaliacao/domain/anthropometry-automation";

type SaveState = "saved" | "pending" | "saving" | "error";

const BASICS = ANTHRO_SECTIONS.find((section) => section.id === "basicos")!;
const SKINFOLDS = ANTHRO_SECTIONS.find((section) => section.id === "dobras")!;
const BIOIMPEDANCE = ANTHRO_SECTIONS.find((section) => section.id === "bioimpedancia")!;
const OTHER_SECTIONS = ANTHRO_SECTIONS.filter((section) => !["basicos", "dobras", "bioimpedancia"].includes(section.id));

export function AnthropometryPanel({ consultationId: id, data, interpretation, profile, formula, onFormulaChange, onChange }: {
  consultationId: string;
  data: AnthroData;
  interpretation: string;
  profile: PatientProfile;
  formula: SkinfoldFormula;
  onFormulaChange: (value: SkinfoldFormula) => void;
  onChange: (next: AnthroData) => void;
}) {
  const [open, setOpen] = useState<string[]>(["dobras", "bioimpedancia"]);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [showBedridden, setShowBedridden] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const pending = useRef<{ data: AnthroData; formula: SkinfoldFormula } | null>(null);

  const analysis = useMemo(() => analyzeAnthropometry(data, profile, formula), [data, profile, formula]);
  const eligibility = useMemo(() => skinfoldEligibility(data, profile, formula), [data, profile, formula]);
  const bedridden = useMemo(() => estimateBedriddenWeight(data, profile), [data, profile]);
  const visceralScale = selectedVisceralScale(data);
  const fieldIssues = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const issue of analysis.issues) if (issue.field) map.set(issue.field, [...(map.get(issue.field) ?? []), issue.message]);
    return map;
  }, [analysis.issues]);

  const persist = useCallback((next: AnthroData, nextFormula: SkinfoldFormula) => {
    const snapshot = { data: { ...next, formula: nextFormula }, formula: nextFormula };
    pending.current = snapshot;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setSaveState("pending");
    saveTimer.current = window.setTimeout(() => {
      setSaveState("saving");
      void db.saveAnthropometry(id, snapshot.data, interpretation).then(() => {
        if (pending.current === snapshot) pending.current = null;
        setSaveState("saved");
      }).catch(() => {
        setSaveState("error");
        toast.error("Não foi possível salvar as medidas. Os valores permanecem na tela para nova tentativa.");
      });
    }, 500);
  }, [id, interpretation]);

  useEffect(() => () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    const snapshot = pending.current;
    if (snapshot) void db.saveAnthropometry(id, snapshot.data, interpretation);
  }, [id, interpretation]);

  const apply = useCallback((next: AnthroData) => {
    onChange(next);
    persist(next, formula);
  }, [formula, onChange, persist]);

  const updateField = (key: string, value: string) => {
    let next = applyAnthropometryInput(data, key, value);
    if (key.startsWith("bia_") && key !== "bia_mlg") next = { ...next, composition_method: "bioimpedance" };
    else if (key.startsWith("d_") && !hasBioData(next)) next = { ...next, composition_method: "skinfolds" };
    apply(next);
  };

  const changeFormula = (nextFormula: SkinfoldFormula) => {
    onFormulaChange(nextFormula);
    const next = { ...data, formula: nextFormula };
    onChange(next);
    persist(next, nextFormula);
  };

  const changeVisceralScale = (scale: VisceralScale) => apply({ ...data, visceral_scale: scale });
  const retrySave = () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    const snapshot = { data: { ...data, formula }, formula };
    pending.current = snapshot;
    setSaveState("saving");
    void db.saveAnthropometry(id, snapshot.data, interpretation).then(() => {
      if (pending.current === snapshot) pending.current = null;
      setSaveState("saved");
    }).catch(() => setSaveState("error"));
  };

  const applyBedriddenWeight = () => {
    if (bedridden.weight === null) return;
    apply(applyEstimatedWeight(data, bedridden.weight));
    setShowBedridden(false);
    toast.success(`Peso estimado de ${bedridden.weight.toLocaleString("pt-BR")} kg aplicado.`);
  };

  const toggle = (sectionId: string) => setOpen((current) => current.includes(sectionId) ? current.filter((value) => value !== sectionId) : [...current, sectionId]);
  const bioLeanMass = num(data["bia_mlg"]);
  const bioFatPercent = num(data["bia_gordura_pct"]);
  const skinfoldGroup = analysis.groups.find((group) => group.title === "Dobras cutâneas");
  const bioGroup = analysis.groups.find((group) => group.title === "Bioimpedância");
  const basicsGroup = analysis.groups.find((group) => group.title === "Pesos e medidas");

  return (
    <div className="space-y-5">
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><h2 className="text-base font-semibold">Dados antropométricos básicos</h2><SaveIndicator state={saveState} onRetry={retrySave} /></div>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Peso e altura ficam sempre visíveis. Dobras e bioimpedância podem ser preenchidas juntas na mesma avaliação.</p>
          </div>
          <span className="text-xs text-muted-foreground">{profile.age !== null ? `${profile.age} anos` : "Idade não informada"} · {biologicalSex(profile.sex) === "female" ? "Feminino" : biologicalSex(profile.sex) === "male" ? "Masculino" : "Sexo não informado"}</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BASICS.fields.map((field) => <AnthroFieldInput key={field.key} field={field} value={data[field.key]} issues={fieldIssues.get(field.key)} onChange={(value) => updateField(field.key, value)} />)}
        </div>
        <div className="mt-3 rounded-md bg-muted/35 p-3">
          <button type="button" className="inline-flex items-center gap-1.5 text-xs font-medium text-primary" onClick={() => setShowBedridden((value) => !value)}><Bed className="size-3.5" /> Paciente acamado / sem peso aferido</button>
          {showBedridden ? <div className="mt-3 text-xs text-muted-foreground">{bedridden.weight !== null ? <div className="flex flex-wrap items-center justify-between gap-3"><span>Peso estimado por Chumlea: <strong className="text-foreground">{bedridden.weight.toLocaleString("pt-BR")} kg</strong></span><Button type="button" size="sm" variant="outline" onClick={applyBedriddenWeight}>Usar este peso</Button></div> : <span>Preencha braço relaxado, panturrilha, dobra subescapular e altura do joelho. Falta: {bedridden.missing.join(", ")}.</span>}</div> : null}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        <section className="rounded-lg border border-border bg-card">
          <button type="button" onClick={() => toggle("dobras")} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
            <span><span className="block text-sm font-semibold">Dobras cutâneas</span><span className="mt-0.5 block text-xs text-muted-foreground">Preencha quando tiver as dobras. Elas são calculadas independentemente da bioimpedância.</span></span>
            <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open.includes("dobras") ? "rotate-180" : ""}`} />
          </button>
          {open.includes("dobras") ? <div className="border-t border-border p-4">
            <label className="text-xs text-muted-foreground">Fórmula de dobras
              <select value={formula} onChange={(event) => changeFormula(event.target.value as SkinfoldFormula)} className="mt-1 h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                {SKINFOLD_FORMULAS.map((item) => <option key={item} value={item}>{SKINFOLD_FORMULA_LABELS[item]}</option>)}
              </select>
            </label>
            {!eligibility.eligible ? <p className="mt-2 flex gap-1.5 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />Para calcular: {eligibility.missing.join(", ")}.</p> : null}
            <div className="mt-4 grid gap-3 sm:grid-cols-2">{SKINFOLDS.fields.map((field) => <AnthroFieldInput key={field.key} field={field} value={data[field.key]} required={eligibility.required.includes(field.key)} issues={fieldIssues.get(field.key)} onChange={(value) => updateField(field.key, value)} />)}</div>
            {skinfoldGroup ? <ResultMiniGroup group={skinfoldGroup} /> : null}
          </div> : null}
        </section>

        <section className="rounded-lg border border-border bg-card">
          <button type="button" onClick={() => toggle("bioimpedancia")} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left">
            <span><span className="block text-sm font-semibold">Bioimpedância</span><span className="mt-0.5 block text-xs text-muted-foreground">Informe os dados do equipamento. A massa livre de gordura é calculada automaticamente.</span></span>
            <ChevronDown className={`size-4 text-muted-foreground transition-transform ${open.includes("bioimpedancia") ? "rotate-180" : ""}`} />
          </button>
          {open.includes("bioimpedancia") ? <div className="border-t border-border p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {BIOIMPEDANCE.fields.filter((field) => field.key !== "bia_mlg").map((field) => <AnthroFieldInput key={field.key} field={field} value={data[field.key]} issues={fieldIssues.get(field.key)} onChange={(value) => updateField(field.key, value)} />)}
              <label className="text-xs text-muted-foreground">Massa livre de gordura (kg)
                <div className="mt-1 flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm font-medium tabular-nums text-foreground">{bioLeanMass !== null ? `${bioLeanMass.toLocaleString("pt-BR")} kg` : "Preencha peso + gordura"}</div>
                <span className="mt-1 block text-[11px]">Calculada por peso corporal − massa gorda.</span>
              </label>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>Escala de gordura visceral:</span><Button type="button" size="sm" variant={visceralScale === "omron" ? "secondary" : "ghost"} onClick={() => changeVisceralScale("omron")}>Omron</Button><Button type="button" size="sm" variant={visceralScale === "tanita" ? "secondary" : "ghost"} onClick={() => changeVisceralScale("tanita")}>Tanita</Button></div>
            {bioFatPercent !== null && bioLeanMass !== null ? <div className="mt-3 rounded-md bg-primary/5 px-3 py-2 text-xs text-muted-foreground"><Check className="mr-1 inline size-3.5 text-primary" />Composição da bio pronta: {bioFatPercent.toLocaleString("pt-BR")}% de gordura · {bioLeanMass.toLocaleString("pt-BR")} kg de massa livre de gordura.</div> : null}
            {bioGroup ? <ResultMiniGroup group={bioGroup} /> : null}
          </div> : null}
        </section>
      </div>

      <div className="space-y-2">
        {OTHER_SECTIONS.map((section) => {
          const expanded = open.includes(section.id);
          const filled = section.fields.filter((field) => String(data[field.key] ?? "").trim()).length;
          return <section key={section.id} className="rounded-lg border border-border bg-card"><button type="button" onClick={() => toggle(section.id)} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"><span><span className="block text-sm font-medium">{section.title}</span>{section.hint ? <span className="mt-0.5 block text-xs text-muted-foreground">{section.hint}</span> : null}</span><span className="flex items-center gap-2 text-xs text-muted-foreground">{filled}/{section.fields.length}<ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} /></span></button>{expanded ? <div className="grid gap-3 border-t border-border p-4 sm:grid-cols-2 lg:grid-cols-3">{section.fields.map((field) => <AnthroFieldInput key={field.key} field={field} value={data[field.key]} issues={fieldIssues.get(field.key)} onChange={(value) => updateField(field.key, value)} />)}</div> : null}</section>;
        })}
      </div>

      <section className="rounded-lg border border-border bg-card p-4">
        <h3 className="text-sm font-semibold">Resumo da avaliação</h3>
        <p className="mt-1 text-xs text-muted-foreground">Os resultados de dobras e bio permanecem separados para você comparar sem perder a origem de cada dado.</p>
        {basicsGroup ? <ResultMiniGroup group={basicsGroup} /> : null}
        {analysis.issues.filter((issue) => !issue.field).length ? <div className="mt-3 space-y-1">{analysis.issues.filter((issue) => !issue.field).map((issue, index) => <p key={`${issue.message}-${index}`} className="flex gap-2 text-xs text-muted-foreground"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{issue.message}</p>)}</div> : null}
        {interpretation ? <div className="mt-4 border-t border-border pt-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Interpretação clínica</p><div className="mt-2 whitespace-pre-wrap text-sm leading-6">{interpretation}</div></div> : null}
      </section>
    </div>
  );
}

function hasBioData(data: AnthroData) {
  return ["bia_gordura_pct", "bia_massa_gorda", "bia_musculo_pct", "bia_musculo", "bia_visceral", "bia_agua"].some((key) => num(data[key]) !== null);
}

function AnthroFieldInput({ field, value, issues, required = false, onChange }: {
  field: { key: string; label: string; unit?: string; min?: number; max?: number };
  value: string | undefined;
  issues?: string[] | undefined;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return <label className="text-xs text-muted-foreground"><span>{field.label}{required ? <span className="ml-1 text-primary">•</span> : null}</span><div className="relative mt-1"><Input type="number" inputMode="decimal" step="any" min={field.min} max={field.max} value={value ?? ""} onChange={(event) => onChange(event.target.value)} className={issues?.length ? "border-destructive pr-12" : field.unit ? "pr-12" : ""} />{field.unit ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{field.unit}</span> : null}</div>{issues?.map((issue) => <span key={issue} className="mt-1 block text-[11px] text-destructive">{issue}</span>)}</label>;
}

function ResultMiniGroup({ group }: { group: { title: string; results: Array<{ label: string; value: string; detail?: string | undefined; source?: "measured" | "derived" | "calculated" | undefined }> } }) {
  return <div className="mt-4 border-t border-border pt-3"><p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{group.title}</p><div className="grid gap-1.5 sm:grid-cols-2">{group.results.filter((result) => result.value !== "—").map((result) => <div key={result.label} className="rounded-md bg-muted/35 px-3 py-2"><div className="flex items-start justify-between gap-2 text-xs"><span className="text-muted-foreground">{result.label}</span><span className="text-right font-medium tabular-nums">{result.value}</span></div>{result.detail ? <p className="mt-1 text-[10px] leading-4 text-muted-foreground">{result.detail}</p> : null}</div>)}</div></div>;
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "error") return <button type="button" onClick={onRetry} className="text-xs text-destructive underline-offset-4 hover:underline">Falha ao salvar · tentar novamente</button>;
  if (state === "saving") return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Salvando…</span>;
  if (state === "pending") return <span className="text-xs text-muted-foreground">Alterações pendentes</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Save className="size-3" /> Salvo</span>;
}
