import { useQuery } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Bed, Check, ChevronDown, Loader2, Pencil, Plus, RefreshCw, Save, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DictationButton } from "@/components/nutrios/dictation";
import * as db from "@/lib/nutrios/repository";
import {
  ANAMNESIS_FIELDS,
  ANAMNESIS_SECTIONS,
  type AnamnesisField,
  type AnamnesisFields,
  type AnamnesisKey,
  type RecallItem,
} from "@/lib/nutrios/types";
import { extractClinicalAnamnesis } from "@/modules/consulta/application/anamnesis.functions";
import {
  anamnesisCompletion,
  mergeAnamnesisSuggestions,
  sectionCompletion,
  updateAnamnesisField,
} from "@/modules/consulta/domain/anamnesis";
import {
  ANTHRO_SECTIONS,
  SKINFOLD_FORMULAS,
  SKINFOLD_FORMULA_LABELS,
  analyzeAnthropometry,
  biologicalSex,
  selectedCompositionMethod,
  selectedVisceralScale,
  skinfoldEligibility,
  type AnthroData,
  type CompositionMethod,
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

export function AnamnesisPanel({ fields, onChange }: { fields: AnamnesisFields; onChange: (next: AnamnesisFields) => void }) {
  const { id } = useParams({ from: "/consulta/$id" });
  const extract = useServerFn(extractClinicalAnamnesis);
  const segments = useQuery({ queryKey: ["segments", id], queryFn: () => db.listSegments(id) });
  const storedAnamnesis = useQuery({ queryKey: ["anamnesis", id], queryFn: () => db.getAnamnesis(id) });
  const [editing, setEditing] = useState<AnamnesisKey | null>(null);
  const [openSections, setOpenSections] = useState<string[]>(["motivo", "clinico"]);
  const [extracting, setExtracting] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const saveTimer = useRef<number | null>(null);
  const pendingFields = useRef<AnamnesisFields | null>(null);
  const autoExtracted = useRef(false);

  const transcript = useMemo(() => (segments.data ?? []).map((segment) => `${segment.speaker === "nutricionista" ? "Nutricionista" : "Paciente"}: ${segment.content}`).join("\n"), [segments.data]);
  const completion = useMemo(() => anamnesisCompletion(fields), [fields]);

  const persist = useCallback((next: AnamnesisFields) => {
    pendingFields.current = next;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setSaveState("pending");
    saveTimer.current = window.setTimeout(() => {
      const snapshot = next;
      setSaveState("saving");
      void db.saveAnamnesis(id, snapshot).then(() => {
        if (pendingFields.current === snapshot) pendingFields.current = null;
        setSaveState("saved");
      }).catch(() => {
        setSaveState("error");
        toast.error("Não foi possível salvar a anamnese. As alterações permanecem na tela para nova tentativa.");
      });
    }, 700);
  }, [id]);

  useEffect(() => () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    const snapshot = pendingFields.current;
    if (snapshot) void db.saveAnamnesis(id, snapshot);
  }, [id]);

  const apply = useCallback((next: AnamnesisFields) => { onChange(next); persist(next); }, [onChange, persist]);
  const update = (key: AnamnesisKey, value: Partial<AnamnesisField>) => apply(updateAnamnesisField(fields, key, value));

  const extractFromConversation = useCallback(async (silent = false) => {
    if (!transcript.trim() || extracting) return;
    setExtracting(true);
    try {
      const result = await extract({ data: { transcript } });
      const next = mergeAnamnesisSuggestions(fields, result.fields);
      apply(next);
      if (!silent) toast.success("Anamnese atualizada com as novas informações da conversa.");
    } catch (error) {
      if (!silent) toast.error(error instanceof Error ? error.message : "Não foi possível extrair a anamnese.");
    } finally {
      setExtracting(false);
    }
  }, [apply, extract, extracting, fields, transcript]);

  useEffect(() => {
    if (!storedAnamnesis.isFetched) return;
    if (Object.keys(storedAnamnesis.data ?? {}).length > 0) return;
    if (autoExtracted.current || !transcript.trim() || Object.keys(fields).length > 0) return;
    autoExtracted.current = true;
    void extractFromConversation(true);
  }, [extractFromConversation, fields, storedAnamnesis.data, storedAnamnesis.isFetched, transcript]);

  const acceptAllSuggestions = () => {
    let changed = false;
    const next: AnamnesisFields = { ...fields };
    for (const { key } of ANAMNESIS_FIELDS) {
      const item = fields[key];
      if (item?.value.trim() && item.status === "sugerido") { next[key] = { ...item, status: "aceito" }; changed = true; }
    }
    if (changed) apply(next);
  };

  const retrySave = () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    const snapshot = fields;
    pendingFields.current = snapshot;
    setSaveState("saving");
    void db.saveAnamnesis(id, snapshot).then(() => {
      if (pendingFields.current === snapshot) pendingFields.current = null;
      setSaveState("saved");
    }).catch(() => setSaveState("error"));
  };

  const toggleSection = (sectionId: string) => setOpenSections((current) => current.includes(sectionId) ? current.filter((value) => value !== sectionId) : [...current, sectionId]);

  return (
    <div className="space-y-4">
      <div className="rounded-md border border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2"><h2 className="text-sm font-medium">Anamnese clínica</h2><SaveIndicator state={saveState} onRetry={retrySave} /></div>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">A IA organiza apenas o que foi dito. Campos revisados por você nunca são sobrescritos por uma nova extração.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {completion.suggested > 0 ? <Button type="button" variant="outline" size="sm" onClick={acceptAllSuggestions}><Check /> Aceitar sugestões ({completion.suggested})</Button> : null}
            <Button type="button" size="sm" disabled={!transcript.trim() || extracting} onClick={() => void extractFromConversation(false)}>{extracting ? <Loader2 className="animate-spin" /> : <RefreshCw />}{extracting ? "Organizando…" : "Atualizar da conversa"}</Button>
          </div>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${completion.percent}%` }} /></div>
          <p className="text-xs tabular-nums text-muted-foreground">{completion.completed}/{completion.total} campos essenciais · {completion.percent}%</p>
        </div>
      </div>

      <div className="space-y-2">
        {ANAMNESIS_SECTIONS.map((section) => {
          const expanded = openSections.includes(section.id);
          const sectionProgress = sectionCompletion(fields, section.id);
          return <section key={section.id} className="overflow-hidden rounded-md border border-border">
            <button type="button" className="flex w-full items-center justify-between gap-4 bg-muted/20 px-4 py-3 text-left" aria-expanded={expanded} onClick={() => toggleSection(section.id)}>
              <span><span className="block text-sm font-medium">{section.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{section.description}</span></span>
              <span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">{sectionProgress.total ? `${sectionProgress.filled}/${sectionProgress.total}` : "opcional"}<ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} /></span>
            </button>
            {expanded ? <div className="divide-y divide-border">{section.fields.map((key) => {
              const definition = ANAMNESIS_FIELDS.find((item) => item.key === key); if (!definition) return null;
              const field = fields[key]; const status = field?.status ?? "sugerido";
              return <div key={key} className="group grid gap-2 px-4 py-3 sm:grid-cols-[180px_1fr_auto] sm:items-start">
                <span className="pt-1 text-xs text-muted-foreground">{definition.label}{definition.required ? <span className="ml-1 text-primary" title="Campo essencial">•</span> : null}</span>
                {editing === key ? <Textarea autoFocus value={field?.value ?? ""} onChange={(event) => update(key, { value: event.target.value, status: "editado", source: "profissional" })} onBlur={() => setEditing(null)} className="min-h-20 text-sm" /> : <button type="button" onClick={() => setEditing(key)} className={`min-h-7 whitespace-pre-wrap text-left text-sm leading-5 ${status === "recusado" ? "text-muted-foreground line-through" : ""} ${field?.value ? "" : "text-muted-foreground"}`}>{field?.value || "Clique para preencher"}{field?.value && status === "sugerido" ? <span className="ml-2 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">sugestão da IA</span> : null}</button>}
                <div className="flex items-center gap-1"><StatusButton active={status === "aceito"} title="Validar informação" onClick={() => update(key, { status: "aceito" })}><Check /></StatusButton><StatusButton active={editing === key} title="Editar campo" onClick={() => setEditing(key)}><Pencil /></StatusButton><DictationButton size="icon" onText={(text) => update(key, { value: field?.value ? `${field.value} ${text}` : text, status: "editado", source: "profissional" })} />{field?.value && status === "sugerido" ? <StatusButton active={false} title="Descartar sugestão" onClick={() => update(key, { status: "recusado" })}><X /></StatusButton> : null}</div>
              </div>;
            })}</div> : null}
          </section>;
        })}
      </div>
      <p className="px-1 text-xs leading-5 text-muted-foreground">• Campo essencial para uma anamnese completa. Campos opcionais permanecem disponíveis quando forem clinicamente aplicáveis.</p>
    </div>
  );
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "error") return <button type="button" onClick={onRetry} className="text-xs text-destructive underline-offset-4 hover:underline">Falha ao salvar · tentar novamente</button>;
  if (state === "saving") return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Salvando…</span>;
  if (state === "pending") return <span className="text-xs text-muted-foreground">Alterações pendentes</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Save className="size-3" /> Salvo</span>;
}

function StatusButton({ children, active, title, onClick }: { children: React.ReactNode; active: boolean; title: string; onClick: () => void }) {
  return <Button type="button" variant="ghost" size="icon" title={title} aria-label={title} onClick={onClick} className={`size-7 ${active ? "bg-accent text-foreground" : "text-muted-foreground"}`}>{children}</Button>;
}

export function AnthropometryPanel({ data, interpretation, profile, formula, onFormulaChange, onChange }: {
  data: AnthroData;
  interpretation: string;
  profile: PatientProfile;
  formula: SkinfoldFormula;
  onFormulaChange: (value: SkinfoldFormula) => void;
  onChange: (next: AnthroData) => void;
}) {
  const { id } = useParams({ from: "/consulta/$id" });
  const [open, setOpen] = useState<string[]>(["basicos"]);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [showBedridden, setShowBedridden] = useState(false);
  const saveTimer = useRef<number | null>(null);
  const pending = useRef<{ data: AnthroData; formula: SkinfoldFormula } | null>(null);
  const analysis = useMemo(() => analyzeAnthropometry(data, profile, formula), [data, profile, formula]);
  const sex = biologicalSex(profile.sex);
  const eligibility = useMemo(() => skinfoldEligibility(data, profile, formula), [data, profile, formula]);
  const bedridden = useMemo(() => estimateBedriddenWeight(data, profile), [data, profile]);
  const method = selectedCompositionMethod(data);
  const visceralScale = selectedVisceralScale(data);
  const required = sex === null && formula !== "faulkner" ? [] : eligibility.required;
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
    }, 600);
  }, [id, interpretation]);

  useEffect(() => () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    const snapshot = pending.current;
    if (snapshot) void db.saveAnthropometry(id, snapshot.data, interpretation);
  }, [id, interpretation]);

  const apply = (next: AnthroData) => { onChange(next); persist(next, formula); };
  const updateField = (key: string, value: string) => apply(applyAnthropometryInput(data, key, value));
  const changeFormula = (nextFormula: SkinfoldFormula) => { onFormulaChange(nextFormula); const next = { ...data, formula: nextFormula }; onChange(next); persist(next, nextFormula); };
  const changeMethod = (nextMethod: CompositionMethod) => apply({ ...data, composition_method: nextMethod });
  const changeVisceralScale = (scale: VisceralScale) => apply({ ...data, visceral_scale: scale });
  const retrySave = () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    const snapshot = { data: { ...data, formula }, formula };
    pending.current = snapshot; setSaveState("saving");
    void db.saveAnthropometry(id, snapshot.data, interpretation).then(() => { if (pending.current === snapshot) pending.current = null; setSaveState("saved"); }).catch(() => setSaveState("error"));
  };
  const applyBedriddenWeight = () => {
    if (bedridden.weight === null) return;
    apply(applyEstimatedWeight(data, bedridden.weight));
    setShowBedridden(false);
    toast.success(`Peso estimado de ${bedridden.weight.toLocaleString("pt-BR")} kg aplicado. Identificado como estimativa de Chumlea.`);
  };

  const toggle = (sectionId: string) => setOpen((current) => current.includes(sectionId) ? current.filter((value) => value !== sectionId) : [...current, sectionId]);
  const filled = ANTHRO_SECTIONS.flatMap((section) => section.fields).filter((field) => String(data[field.key] ?? "").trim()).length;
  const hasCore = Boolean(String(data["peso"] ?? "").trim() && String(data["altura"] ?? "").trim());
  const compositionReady = method === "skinfolds" ? eligibility.eligible : analysis.bodyFatPercent !== null || analysis.leanMass !== null;
  const globalIssues = analysis.issues.filter((issue) => !issue.field);

  return <div className="space-y-4">
    <div className="rounded-md border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex items-center gap-2"><h2 className="text-sm font-medium">Avaliação antropométrica</h2><SaveIndicator state={saveState} onRetry={retrySave} /></div><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Escolha qual método deve alimentar a composição corporal da consulta. Dobras e bioimpedância permanecem separadas, e campos relacionados são calculados automaticamente sem apagar a origem do dado.</p></div>
        <div className="text-right text-xs text-muted-foreground"><div>{filled} medidas registradas</div><div>{hasCore && compositionReady ? "Base clínica suficiente" : "Avaliação em preenchimento"}</div></div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2"><MethodButton active={method === "skinfolds"} title="Dobras cutâneas" text="Usa a fórmula selecionada e os pontos medidos." onClick={() => changeMethod("skinfolds")} /><MethodButton active={method === "bioimpedance"} title="Bioimpedância" text="Usa os valores informados pelo equipamento." onClick={() => changeMethod("bioimpedance")} /></div>
      {globalIssues.length ? <div className="mt-3 space-y-1 rounded-md border border-border bg-muted/30 p-3">{globalIssues.map((issue, index) => <p key={`${issue.message}-${index}`} className="flex gap-2 text-xs leading-5 text-muted-foreground"><AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{issue.message}</p>)}</div> : null}
    </div>

    <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
      <div className="space-y-2">
        {ANTHRO_SECTIONS.map((section) => {
          const expanded = open.includes(section.id);
          const sectionFilled = section.fields.filter((field) => String(data[field.key] ?? "").trim()).length;
          return <section key={section.id} className="rounded-md border border-border">
            <button type="button" onClick={() => toggle(section.id)} aria-expanded={expanded} className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"><span><span className="block text-sm font-medium">{section.title}</span>{section.hint ? <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{section.hint}</span> : null}</span><span className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground">{sectionFilled}/{section.fields.length}<ChevronDown className={`size-4 transition-transform ${expanded ? "rotate-180" : ""}`} /></span></button>
            {expanded ? <div className="space-y-4 border-t border-border p-4">
              {section.id === "basicos" ? <div className="rounded-md bg-muted/40 p-3">
                <button type="button" className="inline-flex items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline" onClick={() => setShowBedridden((value) => !value)}><Bed className="size-3.5" /> Paciente acamado? Clique aqui para estimar o peso.</button>
                {data["weight_source"] === "estimated_chumlea" ? <p className="mt-2 text-xs text-muted-foreground">O peso atual foi preenchido por estimativa antropométrica de Chumlea, não por aferição em balança.</p> : null}
                {showBedridden ? <div className="mt-3 rounded-md border border-border bg-background p-3"><p className="text-xs font-medium">Peso estimado — Chumlea</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Necessários: braço relaxado, panturrilha, dobra subescapular, altura do joelho e sexo biológico. Você pode preencher esses campos nas respectivas seções; o resultado aparece aqui automaticamente.</p>{bedridden.weight !== null ? <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><div><span className="text-2xl font-semibold tabular-nums">{bedridden.weight.toLocaleString("pt-BR")} kg</span><span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">estimado</span></div><Button type="button" size="sm" onClick={applyBedriddenWeight}>Usar como peso estimado</Button></div> : <p className="mt-3 text-xs text-muted-foreground">Falta preencher: {bedridden.missing.join(", ")}.</p>}</div> : null}
              </div> : null}
              {section.id === "dobras" ? <div className="rounded-md bg-muted/40 p-3"><p className="mb-2 text-xs text-muted-foreground">Fórmula para percentual de gordura</p><div className="flex flex-wrap gap-1.5">{SKINFOLD_FORMULAS.map((option) => <Button key={option} type="button" size="sm" variant={formula === option ? "default" : "ghost"} onClick={() => changeFormula(option)}>{SKINFOLD_FORMULA_LABELS[option]}</Button>)}</div>{!eligibility.eligible ? <p className="mt-2 text-xs leading-5 text-muted-foreground">Para calcular: {eligibility.missing.join(", ")}.</p> : <p className="mt-2 text-xs text-muted-foreground">Todos os dados exigidos pela fórmula estão disponíveis.</p>}</div> : null}
              {section.id === "bioimpedancia" ? <div className="space-y-3 rounded-md bg-muted/40 p-3"><div><p className="text-xs font-medium">Cálculos automáticos</p><p className="mt-1 text-xs leading-5 text-muted-foreground">Com o peso preenchido: % gordura ↔ massa gorda e % muscular ↔ massa muscular. O campo que você digitar fica como fonte; o outro é recalculado automaticamente.</p></div><div><p className="mb-2 text-xs text-muted-foreground">Escala do índice de gordura visceral</p><div className="flex gap-1.5"><Button type="button" size="sm" variant={visceralScale === "omron" ? "default" : "ghost"} onClick={() => changeVisceralScale("omron")}>Omron</Button><Button type="button" size="sm" variant={visceralScale === "tanita" ? "default" : "ghost"} onClick={() => changeVisceralScale("tanita")}>Tanita</Button></div>{visceralScale === "omron" ? <p className="mt-2 text-xs text-muted-foreground">Omron: 1–6,99 normal · 7–9,99 aumentado · 10–12 alto · 13–30 muito alto.</p> : null}</div></div> : null}
              {section.id === "diametros" && analysis.boneMass !== null ? <div className="rounded-md border border-border bg-muted/30 p-3"><p className="text-xs text-muted-foreground">Peso ósseo calculado automaticamente</p><p className="mt-1 text-xl font-semibold tabular-nums">{analysis.boneMass.toLocaleString("pt-BR")} kg</p><p className="mt-1 text-[11px] text-muted-foreground">Calculado a partir da estatura e dos diâmetros ósseos necessários; não usa estimativa fixa por percentual da massa magra.</p></div> : null}
              <div className="grid gap-3 sm:grid-cols-2">{section.fields.map((field) => {
                const highlight = section.id === "dobras" && required.includes(field.key); const issues = fieldIssues.get(field.key) ?? [];
                const auto = field.key === "bia_massa_gorda" && data["bia_fat_source"] === "percent" || field.key === "bia_gordura_pct" && data["bia_fat_source"] === "mass" || field.key === "bia_musculo" && data["bia_muscle_source"] === "percent" || field.key === "bia_musculo_pct" && data["bia_muscle_source"] === "mass";
                return <label key={field.key} className="text-xs text-muted-foreground"><span className={highlight ? "font-medium text-foreground" : ""}>{field.label}{highlight ? " *" : ""}{auto ? <span className="ml-1 text-[10px] text-primary">calculado</span> : null}</span><Input inputMode="decimal" value={data[field.key] ?? ""} aria-invalid={issues.length > 0} onChange={(event) => updateField(field.key, event.target.value)} className={`mt-1 text-sm ${highlight ? "border-primary/60" : ""} ${issues.length ? "border-destructive" : ""}`} />{issues.map((message) => <span key={message} className="mt-1 block text-[11px] leading-4 text-destructive">{message}</span>)}</label>;
              })}</div>
            </div> : null}
          </section>;
        })}
      </div>

      <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
        <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-medium">Resultados analíticos</h3><span className="rounded bg-muted px-2 py-1 text-[10px] uppercase tracking-wide text-muted-foreground">principal: {method === "skinfolds" ? "dobras" : "bioimpedância"}</span></div>
        {analysis.groups.map((group) => <div key={group.title}><p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{group.title}</p><div className="space-y-1">{group.results.map((result) => <div key={result.label} className="flex items-start justify-between gap-3 rounded-md bg-muted/40 px-3 py-2 text-sm"><span className="text-muted-foreground">{result.label}</span><span className="max-w-[58%] shrink-0 text-right"><span className="font-medium tabular-nums">{result.value}</span>{result.source ? <span className="ml-1.5 rounded bg-background px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-muted-foreground">{sourceLabel(result.source)}</span> : null}{result.detail ? <span className="mt-0.5 block text-[11px] leading-4 text-muted-foreground">{result.detail}</span> : null}</span></div>)}</div></div>)}
        {interpretation ? <div className="rounded-md border border-border p-3"><p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Interpretação clínica</p><div className="whitespace-pre-wrap text-sm leading-6">{interpretation}</div><p className="mt-2 text-[11px] leading-4 text-muted-foreground">Após alterar medidas, use “Interpretar e salvar avaliação” para atualizar este texto.</p></div> : null}
      </aside>
    </div>
  </div>;
}

function MethodButton({ active, title, text, onClick }: { active: boolean; title: string; text: string; onClick: () => void }) {
  return <button type="button" aria-pressed={active} onClick={onClick} className={`rounded-md border p-3 text-left transition-colors ${active ? "border-primary bg-primary/5" : "border-border hover:bg-muted/40"}`}><span className="flex items-center gap-2 text-sm font-medium">{active ? <Check className="size-4" /> : null}{title}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{text}</span></button>;
}

function sourceLabel(source: "measured" | "derived" | "calculated") { if (source === "measured") return "medido"; if (source === "derived") return "derivado"; return "calculado"; }

export function RecallPanel({ items, onChange, onRemove, onAdd }: { items: RecallItem[]; onChange: (item: RecallItem) => void; onRemove: (id: string) => void; onAdd: () => void }) {
  return <div className="space-y-2"><div className="overflow-x-auto rounded-md border border-border"><table className="w-full min-w-[680px] text-sm"><thead className="bg-muted/50 text-xs text-muted-foreground"><tr><th className="px-3 py-2 text-left font-medium">Horário</th><th className="px-3 py-2 text-left font-medium">Alimentos</th><th className="px-3 py-2 text-left font-medium">Quantidade</th><th className="px-3 py-2 text-left font-medium">Preparo</th><th className="w-20" /></tr></thead><tbody className="divide-y divide-border">{items.map((item) => <tr key={item.id}>{(["time_label", "foods", "amount", "preparation"] as const).map((field) => <td key={field} className="p-0"><input value={item[field] ?? ""} onChange={(event) => onChange({ ...item, [field]: event.target.value })} className="w-full bg-transparent px-3 py-2 outline-none focus:bg-accent/40" /></td>)}<td className="px-2"><div className="flex items-center gap-1"><DictationButton size="icon" onText={(text) => onChange({ ...item, foods: item.foods ? `${item.foods} ${text}` : text })} /><Button type="button" variant="ghost" size="icon" onClick={() => onRemove(item.id)} className="size-7 text-muted-foreground" title="Remover refeição" aria-label="Remover refeição"><Trash2 /></Button></div></td></tr>)}{items.length === 0 ? <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Nenhuma refeição registrada.</td></tr> : null}</tbody></table></div><Button variant="secondary" size="sm" onClick={onAdd}><Plus /> Adicionar refeição</Button></div>;
}

export function DiagnosisPanel({ hypotheses, flags, onChange }: { hypotheses: string[]; flags: string[]; onChange: (hypotheses: string[]) => void }) {
  return <div className="grid gap-6 lg:grid-cols-2"><section><h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Sinalizações do recordatório</h3><ul className="space-y-1.5 text-sm">{flags.length ? flags.map((flag) => <li key={flag} className="rounded-md border border-border px-3 py-2">{flag}</li>) : <li className="text-muted-foreground">Nenhuma sinalização gerada ainda.</li>}</ul></section><section><h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Hipóteses nutricionais (sugestão)</h3><div className="space-y-2">{hypotheses.map((hypothesis, index) => <div key={index} className="flex gap-2"><Input value={hypothesis} onChange={(event) => { const next = [...hypotheses]; next[index] = event.target.value; onChange(next); }} className="text-sm" /><Button type="button" variant="ghost" size="icon" onClick={() => onChange(hypotheses.filter((_, i) => i !== index))} className="shrink-0 text-muted-foreground" title="Remover hipótese" aria-label="Remover hipótese"><Trash2 /></Button></div>)}<Button variant="secondary" size="sm" onClick={() => onChange([...hypotheses, ""])}><Plus /> Adicionar hipótese</Button><p className="text-xs text-muted-foreground">Todas as hipóteses são sugestões automáticas e exigem validação profissional.</p></div></section></div>;
}
