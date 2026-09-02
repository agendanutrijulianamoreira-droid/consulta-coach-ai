import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, ClipboardCheck, Loader2, Pencil, Plus, RefreshCw, Save, ShieldCheck, Target, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { generateClinicalReasoning } from "../application/clinical-reasoning.functions";
import { acceptedClinicalContext, clinicalId, mergeClinicalReasoning, type ClinicalDirection, type ClinicalHypothesis, type ClinicalPriority, type ClinicalReasoning, type ReviewStatus } from "../domain/clinical-reasoning";
import * as reasoningDb from "../infrastructure/reasoning-repository";

type SaveState = "saved" | "pending" | "saving" | "error";

type Props = {
  consultationId: string;
  anamnesis: string;
  anthropometry: string;
  energy: string;
  recall: string;
  labs: string;
  onChange?: (reasoning: ClinicalReasoning) => void;
};

export function ClinicalReasoningPanel({ consultationId, anamnesis, anthropometry, energy, recall, labs, onChange }: Props) {
  const stored = useQuery({ queryKey: ["clinical-reasoning", consultationId], queryFn: () => reasoningDb.getClinicalReasoning(consultationId) });
  const analyze = useServerFn(generateClinicalReasoning);
  const [reasoning, setReasoning] = useState<ClinicalReasoning | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const saveTimer = useRef<number | null>(null);
  const pending = useRef<ClinicalReasoning | null>(null);

  useEffect(() => { if (stored.data && reasoning === null) setReasoning(stored.data); }, [reasoning, stored.data]);
  useEffect(() => { if (reasoning) onChange?.(reasoning); }, [onChange, reasoning]);

  const persist = useCallback((next: ClinicalReasoning) => {
    pending.current = next;
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    setSaveState("pending");
    saveTimer.current = window.setTimeout(() => {
      const snapshot = next;
      setSaveState("saving");
      void reasoningDb.saveClinicalReasoning(consultationId, snapshot).then(() => {
        if (pending.current === snapshot) pending.current = null;
        setSaveState("saved");
      }).catch(() => {
        setSaveState("error");
        toast.error("Não foi possível salvar o raciocínio clínico. As alterações permanecem na tela.");
      });
    }, 500);
  }, [consultationId]);

  useEffect(() => () => {
    if (saveTimer.current) window.clearTimeout(saveTimer.current);
    if (pending.current) void reasoningDb.saveClinicalReasoning(consultationId, pending.current);
  }, [consultationId]);

  const apply = useCallback((next: ClinicalReasoning) => { setReasoning(next); persist(next); }, [persist]);

  const runAnalysis = async () => {
    if (analyzing) return;
    setAnalyzing(true);
    try {
      const suggestion = await analyze({ data: { anamnesis, anthropometry, energy, recall, labs } });
      const next = mergeClinicalReasoning(reasoning ?? await reasoningDb.getClinicalReasoning(consultationId), suggestion);
      apply(next);
      toast.success("Raciocínio clínico atualizado. Revise as sugestões antes de avançar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível analisar a consulta.");
    } finally { setAnalyzing(false); }
  };

  const current = reasoning ?? stored.data;
  const accepted = useMemo(() => current ? acceptedClinicalContext(current) : null, [current]);
  const reviewedCount = (accepted?.hypotheses.length ?? 0) + (accepted?.priorities.length ?? 0) + (accepted?.directions.length ?? 0);

  if (stored.isLoading || !current) return <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 size-4 animate-spin" /> Carregando raciocínio clínico…</div>;

  const setHypothesis = (id: string, patch: Partial<ClinicalHypothesis>) => apply({ ...current, hypotheses: current.hypotheses.map((item) => item.id === id ? { ...item, ...patch } : item) });
  const setPriority = (id: string, patch: Partial<ClinicalPriority>) => apply({ ...current, priorities: current.priorities.map((item) => item.id === id ? { ...item, ...patch } : item).sort((a, b) => a.rank - b.rank) });
  const setDirection = (id: string, patch: Partial<ClinicalDirection>) => apply({ ...current, directions: current.directions.map((item) => item.id === id ? { ...item, ...patch } : item) });

  return <div className="space-y-5">
    <section className="rounded-md border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><ClipboardCheck className="size-4" /><h2 className="text-sm font-medium">Raciocínio clínico nutricional</h2><SaveIndicator state={saveState} onRetry={() => persist(current)} /></div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">A IA organiza evidências e sugere hipóteses. Você valida o que entra no direcionamento clínico. Itens revisados não são sobrescritos em uma nova análise.</p>
        </div>
        <Button size="sm" disabled={analyzing} onClick={() => void runAnalysis()}>{analyzing ? <Loader2 className="animate-spin" /> : <RefreshCw />}{analyzing ? "Analisando…" : current.findings.length ? "Atualizar análise" : "Analisar consulta completa"}</Button>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <Metric label="Achados objetivos" value={current.findings.length} />
        <Metric label="Itens revisados" value={reviewedCount} />
        <Metric label="Pendentes de revisão" value={[...current.hypotheses, ...current.priorities, ...current.directions].filter((item) => item.status === "suggested").length} />
      </div>
    </section>

    <section className="rounded-md border border-border p-4">
      <div className="flex items-center gap-2"><ShieldCheck className="size-4" /><h3 className="text-sm font-medium">1. Achados clínicos confirmados</h3></div>
      <p className="mt-1 text-xs text-muted-foreground">Somente fatos localizados nas etapas anteriores. Estes itens não são diagnósticos.</p>
      <div className="mt-3 grid gap-2 lg:grid-cols-2">{current.findings.length ? current.findings.map((item) => <div key={item.id} className="rounded-md bg-muted/30 px-3 py-2"><div className="flex items-start justify-between gap-2"><span className="text-sm font-medium">{item.label}</span><span className="rounded bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">{sourceLabel(item.source)}</span></div><p className="mt-1 text-xs leading-5 text-muted-foreground">{item.detail}</p></div>) : <p className="col-span-full py-4 text-sm text-muted-foreground">Execute a análise para organizar os achados objetivos.</p>}</div>
    </section>

    {current.flags.length ? <section className="rounded-md border border-border p-4"><div className="flex items-center gap-2"><AlertTriangle className="size-4" /><h3 className="text-sm font-medium">2. Sinalizações para revisão</h3></div><ul className="mt-3 grid gap-2 lg:grid-cols-2">{current.flags.map((flag) => <li key={flag} className="rounded-md bg-muted/30 px-3 py-2 text-sm">{flag}</li>)}</ul></section> : null}

    <ReviewSection title="3. Hipóteses nutricionais" description="Cada hipótese precisa ter evidências explícitas. Aceite, edite ou recuse individualmente." icon={<ClipboardCheck className="size-4" />}>
      {current.hypotheses.map((item) => <HypothesisCard key={item.id} item={item} onChange={(patch) => setHypothesis(item.id, patch)} onDelete={() => apply({ ...current, hypotheses: current.hypotheses.filter((value) => value.id !== item.id) })} />)}
      <Button type="button" variant="secondary" size="sm" onClick={() => apply({ ...current, hypotheses: [...current.hypotheses, { id: clinicalId("hyp", crypto.randomUUID()), title: "", rationale: "", evidence: [], status: "edited" }] })}><Plus /> Adicionar hipótese</Button>
    </ReviewSection>

    <ReviewSection title="4. Prioridades clínicas" description="Ordene o que merece intervenção primeiro. A prioridade é uma decisão profissional, não uma classificação automática de gravidade." icon={<Target className="size-4" />}>
      {current.priorities.map((item) => <PriorityCard key={item.id} item={item} onChange={(patch) => setPriority(item.id, patch)} onDelete={() => apply({ ...current, priorities: current.priorities.filter((value) => value.id !== item.id) })} />)}
      <Button type="button" variant="secondary" size="sm" onClick={() => apply({ ...current, priorities: [...current.priorities, { id: clinicalId("priority", crypto.randomUUID()), rank: current.priorities.length + 1, title: "", rationale: "", status: "edited" }] })}><Plus /> Adicionar prioridade</Button>
    </ReviewSection>

    <ReviewSection title="5. Direcionamento nutricional" description="Objetivos clínico-nutricionais aprovados aqui serão o contexto da próxima etapa. Sem alimentos, suplementos ou doses automáticas." icon={<Check className="size-4" />}>
      {current.directions.map((item) => <DirectionCard key={item.id} item={item} onChange={(patch) => setDirection(item.id, patch)} onDelete={() => apply({ ...current, directions: current.directions.filter((value) => value.id !== item.id) })} />)}
      <Button type="button" variant="secondary" size="sm" onClick={() => apply({ ...current, directions: [...current.directions, { id: clinicalId("direction", crypto.randomUUID()), title: "", rationale: "", status: "edited" }] })}><Plus /> Adicionar direcionamento</Button>
    </ReviewSection>
  </div>;
}

function ReviewSection({ title, description, icon, children }: { title: string; description: string; icon: React.ReactNode; children: React.ReactNode }) {
  return <section className="rounded-md border border-border p-4"><div className="flex items-center gap-2">{icon}<h3 className="text-sm font-medium">{title}</h3></div><p className="mt-1 text-xs text-muted-foreground">{description}</p><div className="mt-3 space-y-2">{children}</div></section>;
}

function HypothesisCard({ item, onChange, onDelete }: { item: ClinicalHypothesis; onChange: (patch: Partial<ClinicalHypothesis>) => void; onDelete: () => void }) {
  return <div className={`rounded-md border p-3 ${item.status === "rejected" ? "opacity-55" : "border-border"}`}><div className="grid gap-2 sm:grid-cols-[1fr_auto]"><div className="space-y-2"><Input value={item.title} placeholder="Hipótese nutricional" onChange={(event) => onChange({ title: event.target.value, status: "edited" })} /><Textarea value={item.rationale} placeholder="Justificativa clínica" onChange={(event) => onChange({ rationale: event.target.value, status: "edited" })} className="min-h-16" />{item.evidence.length ? <div className="flex flex-wrap gap-1.5">{item.evidence.map((evidence) => <span key={evidence} className="rounded bg-muted px-2 py-1 text-[10px] text-muted-foreground">{evidence}</span>)}</div> : <p className="text-[11px] text-muted-foreground">Sem evidência vinculada — revise antes de aceitar.</p>}</div><ReviewActions status={item.status} onStatus={(status) => onChange({ status })} onDelete={onDelete} /></div></div>;
}

function PriorityCard({ item, onChange, onDelete }: { item: ClinicalPriority; onChange: (patch: Partial<ClinicalPriority>) => void; onDelete: () => void }) {
  return <div className={`grid gap-2 rounded-md border p-3 sm:grid-cols-[70px_1fr_auto] ${item.status === "rejected" ? "opacity-55" : "border-border"}`}><label className="text-[10px] uppercase tracking-wide text-muted-foreground">Ordem<Input type="number" min={1} max={9} value={item.rank} onChange={(event) => onChange({ rank: Number(event.target.value) || 1, status: "edited" })} className="mt-1" /></label><div className="space-y-2"><Input value={item.title} placeholder="Prioridade" onChange={(event) => onChange({ title: event.target.value, status: "edited" })} /><Textarea value={item.rationale} placeholder="Por que vem primeiro?" onChange={(event) => onChange({ rationale: event.target.value, status: "edited" })} className="min-h-14" /></div><ReviewActions status={item.status} onStatus={(status) => onChange({ status })} onDelete={onDelete} /></div>;
}

function DirectionCard({ item, onChange, onDelete }: { item: ClinicalDirection; onChange: (patch: Partial<ClinicalDirection>) => void; onDelete: () => void }) {
  return <div className={`grid gap-2 rounded-md border p-3 sm:grid-cols-[1fr_auto] ${item.status === "rejected" ? "opacity-55" : "border-border"}`}><div className="space-y-2"><Input value={item.title} placeholder="Objetivo clínico-nutricional" onChange={(event) => onChange({ title: event.target.value, status: "edited" })} /><Textarea value={item.rationale} placeholder="Relação com os achados e prioridades" onChange={(event) => onChange({ rationale: event.target.value, status: "edited" })} className="min-h-14" /></div><ReviewActions status={item.status} onStatus={(status) => onChange({ status })} onDelete={onDelete} /></div>;
}

function ReviewActions({ status, onStatus, onDelete }: { status: ReviewStatus; onStatus: (status: ReviewStatus) => void; onDelete: () => void }) {
  return <div className="flex items-start justify-end gap-1 sm:flex-col"><Button type="button" variant={status === "accepted" ? "secondary" : "ghost"} size="icon" className="size-8" title="Aceitar" onClick={() => onStatus("accepted")}><Check /></Button><Button type="button" variant={status === "edited" ? "secondary" : "ghost"} size="icon" className="size-8" title="Marcar como editado" onClick={() => onStatus("edited")}><Pencil /></Button><Button type="button" variant={status === "rejected" ? "secondary" : "ghost"} size="icon" className="size-8" title="Recusar sugestão" onClick={() => onStatus("rejected")}><X /></Button><Button type="button" variant="ghost" size="icon" className="size-8 text-muted-foreground" title="Excluir" onClick={onDelete}><Trash2 /></Button></div>;
}

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "error") return <button type="button" onClick={onRetry} className="text-xs text-destructive underline-offset-4 hover:underline">Falha ao salvar · tentar novamente</button>;
  if (state === "saving") return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Salvando…</span>;
  if (state === "pending") return <span className="text-xs text-muted-foreground">Alterações pendentes</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Save className="size-3" /> Salvo</span>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-md bg-muted/30 px-3 py-2"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-lg font-semibold tabular-nums">{value}</div></div>; }
function sourceLabel(source: string) { return ({ anamnese: "Anamnese", antropometria: "Antropometria", calculos: "Cálculos", recordatorio: "Recordatório", exames: "Exames", transcricao: "Conversa" } as Record<string, string>)[source] ?? source; }
