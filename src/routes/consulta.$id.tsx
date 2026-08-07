import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ClipboardList, FileText, Mic, Save, Sparkles, Square, Trash2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/nutrios/app-shell";
import { ConsultationTimer } from "@/components/nutrios/consultation-timer";
import { DictationButton, DictationField } from "@/components/nutrios/dictation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnamnesisPanel, AnthropometryPanel, DiagnosisPanel, RecallPanel } from "@/modules/consulta/ui/panels";
import { EnergyPanel } from "@/modules/avaliacao/ui/energy-panel";
import { analyzeAnthropometry, ageFromBirthDate, isMale, type AnthroData, type SkinfoldFormula } from "@/modules/avaliacao/domain/anthropometry";
import { DEFAULT_ENERGY, calculateEnergy, type EnergyInputs } from "@/modules/avaliacao/domain/energy";
import { buildMealPlan, defaultMacros, recalculatePlan, scaleItem } from "@/modules/plano/domain/meal-plan-engine";
import { blobToBase64, startRecording, type AudioRecorder } from "@/modules/transcricao/recorder";
import * as db from "@/lib/nutrios/repository";
import { analyzeConsultation, describeMealPlan, extractAnamnesis, generateClinicalSummary, generateReport, interpretAnthropometry, structureRecall, transcribeChunk } from "@/lib/nutrios/ai.functions";
import { MEAL_SLOT_LABELS, RESTRICTION_OPTIONS, type AnamnesisFields, type Food, type MealPlan, type RecallItem } from "@/lib/nutrios/types";

export const Route = createFileRoute("/consulta/$id")({
  head: () => ({ meta: [
    { title: "Consulta clínica — NutriOS" }, { name: "description", content: "Consulta clínica com transcrição, avaliação completa, cálculos energéticos e cardápio." },
    { property: "og:title", content: "Consulta clínica — NutriOS" }, { property: "og:description", content: "Consulta clínica com transcrição, avaliação completa, cálculos energéticos e cardápio." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: ConsultationPage,
});

const STEPS = ["Consulta", "Anamnese", "Antropometria", "Cálculos", "Recordatório", "Diagnóstico", "Cardápio"] as const;
const HINTS: Record<number, string> = {
  0: "Capture a conversa e acompanhe a transcrição em tempo real.",
  1: "Revise cada sugestão antes de incorporar ao prontuário.",
  2: "Preencha as medidas: os resultados analíticos são calculados na hora.",
  3: "Escolha a fórmula e ajuste os fatores — o GET alimenta o cardápio.",
  4: "Capte o recordatório por voz e edite as linhas enquanto conversam.",
  5: "A hipótese considera toda a consulta e depende da sua validação.",
  6: "O cardápio já vem montado com os dados anteriores — edite e gere o parecer.",
};

function ConsultationPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState(false);
  const recorder = useRef<AudioRecorder | null>(null);
  const secondsRef = useRef(0);
  const transcribe = useServerFn(transcribeChunk);
  const consultation = useQuery({ queryKey: ["consultation", id], queryFn: () => db.getConsultation(id) });
  const segments = useQuery({ queryKey: ["segments", id], queryFn: () => db.listSegments(id), refetchInterval: recording ? 4000 : false });
  const foods = useQuery({ queryKey: ["foods"], queryFn: db.listFoods });
  const [anamnesis, setAnamnesis] = useState<AnamnesisFields>({});
  const [anthro, setAnthro] = useState<AnthroData>({});
  const [formula, setFormula] = useState<SkinfoldFormula>("pollock3");
  const [interpretation, setInterpretation] = useState("");
  const [energy, setEnergy] = useState<EnergyInputs>(DEFAULT_ENERGY);
  const [recall, setRecall] = useState<RecallItem[]>([]);
  const [hypotheses, setHypotheses] = useState<string[]>([]);
  const [flags, setFlags] = useState<string[]>([]);
  const [conduct, setConduct] = useState<db.ConductRow>({ phase: "adaptacao", kcal: 2000, protein_g: null, carb_g: null, fat_g: null, meals_count: 5, goal: "emagrecimento", preferences: [], restrictions: [], notes: "" });
  const [plan, setPlan] = useState<{ plan: MealPlan; rationale: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  const patient = consultation.data?.patients;
  const profile = useMemo(() => ({ age: ageFromBirthDate(patient?.birth_date), sex: patient?.sex ?? null }), [patient?.birth_date, patient?.sex]);
  const analysis = useMemo(() => analyzeAnthropometry(anthro, profile, formula), [anthro, profile, formula]);
  const energyResult = useMemo(() => calculateEnergy(energy), [energy]);

  useEffect(() => {
    void (async () => {
      setAnamnesis(await db.getAnamnesis(id));
      const anthropometry = await db.getAnthropometry(id);
      setAnthro(anthropometry.data as AnthroData);
      if (anthropometry.data["formula"]) setFormula(anthropometry.data["formula"] as SkinfoldFormula);
      setInterpretation(anthropometry.interpretation);
      setRecall((await db.listRecall(id)) as RecallItem[]);
      const diagnoses = await db.getDiagnoses(id); setHypotheses(diagnoses.hypotheses); setFlags(diagnoses.recall_flags);
      const saved = await db.getConduct(id);
      if (saved) { setConduct(saved); if (saved.energy && Object.keys(saved.energy).length) setEnergy({ ...DEFAULT_ENERGY, ...(saved.energy as EnergyInputs) }); }
      const savedPlan = await db.getMealPlan(id); if (savedPlan) setPlan({ plan: savedPlan.plan, rationale: savedPlan.rationale });
      setLoaded(true);
    })().catch((error: Error) => toast.error(error.message));
  }, [id]);

  // Pré-preenchimento dos cálculos com o que já foi medido.
  useEffect(() => {
    if (step !== 3) return;
    setEnergy((current) => ({
      ...current,
      weight: current.weight ?? Number(String(anthro["peso"] ?? "").replace(",", ".")) || null,
      height: current.height ?? Number(String(anthro["altura"] ?? "").replace(",", ".")) || null,
      age: current.age ?? profile.age,
      leanMass: current.leanMass ?? analysis.leanMass,
      male: current.male || isMale(profile.sex),
    }));
  }, [step, anthro, profile, analysis.leanMass]);

  // O cardápio da última aba já chega montado com os dados anteriores.
  useEffect(() => {
    if (step !== 6 || plan || !loaded || !(foods.data?.length) || busy) return;
    void generatePlan(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, plan, loaded, foods.data, busy]);

  useEffect(() => { if (!recording && consultation.data?.duration_seconds) { setSeconds(consultation.data.duration_seconds); secondsRef.current = consultation.data.duration_seconds; } }, [consultation.data?.duration_seconds, recording]);
  useEffect(() => { secondsRef.current = seconds; }, [seconds]);
  useEffect(() => { if (!recording) return; const interval = window.setInterval(() => setSeconds((value) => value + 1), 1000); return () => window.clearInterval(interval); }, [recording]);

  const transcriptText = (segments.data ?? []).map((segment) => `${segment.speaker === "nutricionista" ? "Nutricionista" : "Paciente"}: ${segment.content}`).join("\n");
  const anamnesisText = Object.entries(anamnesis).filter(([, field]) => field?.value && field.status !== "recusado").map(([key, field]) => `${key}: ${field?.value}`).join("\n");
  const analysisText = analysis.groups.map((group) => `${group.title}\n${group.results.map((r) => `- ${r.label}: ${r.value}${r.detail ? ` (${r.detail})` : ""}`).join("\n")}`).join("\n\n");
  const energyText = `TMB (${energy.formula}): ${energyResult.bmr ?? "—"} kcal | Fator atividade: ${energy.activityFactor} | Fator injúria: ${energy.injuryFactor} | MET: ${energyResult.metKcal} kcal | Gestação/lactação: ${energyResult.pregnancyKcal} kcal | GET: ${energyResult.tee ?? "—"} kcal`;

  const handleWindow = async (wav: Blob, offset: number) => {
    try {
      const result = await transcribe({ data: { audioBase64: await blobToBase64(wav), context: transcriptText.slice(-1500) } });
      if (!result.segments.length) return;
      await db.insertSegments(id, result.segments.map((segment, index) => ({ ...segment, offset_seconds: offset, client_id: `${offset}-${index}` })));
      void queryClient.invalidateQueries({ queryKey: ["segments", id] });
    } catch (error) { toast.error((error as Error).message); }
  };
  const toggleRecording = async () => {
    if (recording) {
      await recorder.current?.stop(); recorder.current = null; setRecording(false);
      await db.updateConsultation(id, { status: "gravada", duration_seconds: seconds, ended_at: new Date().toISOString() });
      toast.success("Gravação encerrada."); return;
    }
    try {
      recorder.current = await startRecording((wav) => void handleWindow(wav, secondsRef.current)); setRecording(true);
      await db.updateConsultation(id, { status: "em_andamento", started_at: new Date().toISOString() });
    } catch { toast.error("Não foi possível acessar o microfone."); }
  };
  const run = async (label: string, action: () => Promise<void>, message = "Alterações salvas.") => {
    setBusy(label);
    try { await action(); toast.success(message); }
    catch (error) { toast.error((error as Error).message); }
    finally { setBusy(null); }
  };

  /** Monta o cardápio pelo motor de regras usando o GET e o que foi revisado. */
  const generatePlan = async (notify = true) => {
    const targetKcal = energyResult.tee ?? conduct.kcal ?? 2000;
    await run("plano", async () => {
      const macros = defaultMacros(targetKcal);
      const nextConduct: db.ConductRow = { ...conduct, kcal: targetKcal, energy: energy as unknown as Record<string, unknown> };
      const generated = buildMealPlan({ phase: nextConduct.phase, kcal: targetKcal, protein_g: nextConduct.protein_g ?? macros.protein_g, carb_g: nextConduct.carb_g ?? macros.carb_g, fat_g: nextConduct.fat_g ?? macros.fat_g, meals_count: nextConduct.meals_count, goal: nextConduct.goal, preferences: nextConduct.preferences, restrictions: nextConduct.restrictions }, foods.data ?? []);
      const { rationale } = await describeMealPlan({ data: { plan: JSON.stringify(generated.meals), context: `${anamnesisText}\n${analysisText}\n${energyText}\nObjetivo: ${nextConduct.goal ?? ""}\nFase: ${nextConduct.phase ?? ""}` } });
      setConduct(nextConduct);
      setPlan({ plan: generated, rationale });
      await db.saveConduct(id, nextConduct);
      await db.saveMealPlan(id, generated, rationale);
    }, notify ? "Cardápio gerado." : "Cardápio pré-carregado.");
  };

  const updatePlan = (next: MealPlan) => {
    setPlan((current) => (current ? { ...current, plan: next } : current));
  };
  const savePlan = async () => {
    if (!plan) return;
    await run("salvar-plano", async () => {
      await db.saveConduct(id, { ...conduct, energy: energy as unknown as Record<string, unknown> });
      await db.saveMealPlan(id, plan.plan, plan.rationale);
    });
  };

  /** Fecha a consulta: resumo clínico + parecer completo para o paciente. */
  const finish = async () => {
    await run("parecer", async () => {
      const summary = await generateClinicalSummary({ data: { transcript: transcriptText, anamnesis: anamnesisText } });
      const report = await generateReport({ data: {
        patient: `${patient?.name ?? ""} | ${profile.age ?? "?"} anos | ${patient?.sex ?? "não informado"}`,
        anamnesis: anamnesisText,
        anthropometry: analysisText,
        energy: energyText,
        diagnosis: `Sinalizações: ${flags.join("; ")}\nHipóteses: ${hypotheses.join("; ")}`,
        plan: plan ? JSON.stringify(plan.plan.meals) : "Sem plano gerado.",
      } });
      await db.saveReport(id, report.report);
      await db.updateConsultation(id, { clinical_summary: summary.summary, status: "finalizada" });
      void queryClient.invalidateQueries({ queryKey: ["consultation", id] });
      void navigate({ to: "/prontuario/$id", params: { id } });
    }, "Parecer gerado.");
  };

  const completed = [Boolean(segments.data?.length), Object.values(anamnesis).some((field) => field?.value && field.status !== "recusado"), Object.values(anthro).some(Boolean), Boolean(energyResult.tee), recall.length > 0, hypotheses.length > 0 || flags.length > 0, Boolean(plan)];
  const goNext = () => setStep((value) => Math.min(STEPS.length - 1, value + 1));
  const goPrevious = () => setStep((value) => Math.max(0, value - 1));

  return <AppShell>
    <div className="sticky top-0 z-10 border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6">
      <div className="flex items-center justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-medium">{patient?.name ?? "Consulta"}</div><div className="flex items-center gap-2 text-xs text-muted-foreground"><span className={`size-1.5 rounded-full ${recording ? "bg-destructive" : "bg-muted-foreground"}`} />{profile.age !== null ? `${profile.age} anos · ` : ""}{recording ? "Gravando e transcrevendo" : consultation.data?.status === "finalizada" ? "Consulta finalizada" : "Pronto para iniciar"}</div></div><div className="flex items-center gap-3"><ConsultationTimer seconds={seconds} running={recording} /><Button size="sm" variant={recording ? "destructive" : "default"} onClick={() => void toggleRecording()}>{recording ? <Square /> : <Mic />}{recording ? "Encerrar" : "Iniciar consulta"}</Button><Link to="/prontuario/$id" params={{ id }} className="hidden text-xs text-muted-foreground underline-offset-4 hover:underline sm:block">Prontuário</Link></div></div>
    </div>
    <div className="border-b border-border px-3 py-3 sm:px-6"><div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Etapas da consulta">{STEPS.map((label, index) => <Button key={label} type="button" role="tab" aria-selected={step === index} variant={step === index ? "secondary" : "ghost"} size="sm" className="shrink-0" onClick={() => setStep(index)}>{completed[index] ? <Check /> : <span className="text-[10px]">{index + 1}</span>}{label}</Button>)}</div></div>

    <main className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Etapa {step + 1} de {STEPS.length}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{STEPS[step]}</h1><p className="mt-1 text-sm text-muted-foreground">{HINTS[step]}</p></div><div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><ClipboardList className="size-4" />{completed.filter(Boolean).length}/{STEPS.length} etapas com dados</div></div>

      {step === 0 ? <section className="grid gap-6 lg:grid-cols-[1fr_280px]"><div className="min-h-[360px] rounded-md border border-border"><div className="flex items-center justify-between border-b border-border px-4 py-3"><div><h2 className="text-sm font-medium">Transcrição da consulta</h2><p className="mt-0.5 text-xs text-muted-foreground">As falas aparecem conforme os trechos são processados.</p></div><span className="text-xs tabular-nums text-muted-foreground">{segments.data?.length ?? 0} falas</span></div><div className="space-y-3 p-4" aria-live="polite">{(segments.data ?? []).map((segment) => <p key={segment.id} className="text-sm leading-6"><span className={segment.speaker === "nutricionista" ? "font-medium text-primary" : "font-medium text-muted-foreground"}>{segment.speaker === "nutricionista" ? "Nutricionista" : "Paciente"}:</span>{" "}{segment.content}</p>)}{!segments.data?.length ? <div className="flex min-h-64 flex-col items-center justify-center text-center"><Mic className="size-6 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">Inicie a consulta para capturar a primeira fala.</p></div> : null}</div></div><aside className="space-y-3"><InfoCard icon={<Sparkles />} title="Revisão assistida" text="Use a transcrição para extrair a anamnese e revisar os dados antes de avançar." /><InfoCard icon={<FileText />} title="Ditado disponível" text="Todos os campos aceitam voz: use o botão de microfone ao lado de cada um." /></aside></section> : null}

      {step === 1 ? <div className="space-y-4"><ActionBar busy={busy === "anamnese"} disabled={!transcriptText || busy !== null} label="Extrair anamnese da conversa" icon={<Sparkles />} onAction={() => void run("anamnese", async () => { const result = await extractAnamnesis({ data: { transcript: transcriptText } }); const next: AnamnesisFields = { ...anamnesis }; for (const [key, value] of Object.entries(result.fields)) if (value) next[key as keyof AnamnesisFields] = { value, status: "sugerido", source: "transcrição" }; setAnamnesis(next); await db.saveAnamnesis(id, next); })} secondary={<Button size="sm" variant="outline" onClick={() => void run("save-anamnese", async () => db.saveAnamnesis(id, anamnesis))}><Save /> Salvar revisão</Button>} /><AnamnesisPanel fields={anamnesis} onChange={setAnamnesis} /></div> : null}

      {step === 2 ? <div className="space-y-4">
        <AnthropometryPanel data={anthro} interpretation={interpretation} profile={profile} formula={formula} onFormulaChange={setFormula} onChange={setAnthro} />
        <ActionBar busy={busy === "antro"} disabled={busy !== null} label="Interpretar e salvar avaliação" icon={<Sparkles />} onAction={() => void run("antro", async () => { const result = await interpretAnthropometry({ data: { data: `${JSON.stringify(anthro)}\n\n${analysisText}` } }); setInterpretation(result.interpretation); await db.saveAnthropometry(id, { ...anthro, formula }, result.interpretation); })} secondary={<Button size="sm" variant="outline" onClick={() => void run("save-antro", async () => db.saveAnthropometry(id, { ...anthro, formula }, interpretation))}><Save /> Salvar medidas</Button>} />
      </div> : null}

      {step === 3 ? <div className="space-y-4">
        <EnergyPanel value={energy} onChange={setEnergy} />
        <ActionBar busy={busy === "energia"} disabled={busy !== null} label="Salvar cálculos" icon={<Save />} onAction={() => void run("energia", async () => db.saveConduct(id, { ...conduct, kcal: energyResult.tee ?? conduct.kcal, energy: energy as unknown as Record<string, unknown> }))} />
      </div> : null}

      {step === 4 ? <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-md border border-border p-3">
          <span className="text-sm text-muted-foreground">Captar o relato do paciente por voz:</span>
          <DictationButton label="Gravar recordatório" onText={(text) => void run("recall", async () => {
            const result = await structureRecall({ data: { transcript: text } });
            const created = result.items.map((item, index) => ({ id: crypto.randomUUID(), time_label: item.time_label, foods: item.foods, amount: item.amount, preparation: item.preparation, notes: "", position: recall.length + index }));
            setRecall((items) => [...items, ...created]);
            for (const item of created) await db.upsertRecallItem(id, item);
          }, "Recordatório estruturado.")} />
          {busy === "recall" ? <span className="text-xs text-muted-foreground">Organizando as refeições…</span> : null}
        </div>
        <RecallPanel items={recall} onChange={(item) => { setRecall((items) => items.map((current) => current.id === item.id ? item : current)); void db.upsertRecallItem(id, item); }} onRemove={(itemId) => { setRecall((items) => items.filter((item) => item.id !== itemId)); void db.deleteRecallItem(itemId); }} onAdd={() => { const item: RecallItem = { id: crypto.randomUUID(), time_label: "", foods: "", amount: "", preparation: "", notes: "", position: recall.length }; setRecall((items) => [...items, item]); void db.upsertRecallItem(id, item); }} />
      </div> : null}

      {step === 5 ? <div className="space-y-4"><ActionBar busy={busy === "diag"} disabled={busy !== null} label="Analisar consulta completa" icon={<Sparkles />} onAction={() => void run("diag", async () => { const result = await analyzeConsultation({ data: { anamnesis: `${anamnesisText}\n\nTranscrição:\n${transcriptText.slice(-8000)}`, anthropometry: `${analysisText}\n\n${energyText}`, recall: JSON.stringify(recall) } }); setFlags(result.flags); setHypotheses(result.hypotheses); await db.saveDiagnoses(id, result.hypotheses, result.flags); })} /><DiagnosisPanel hypotheses={hypotheses} flags={flags} onChange={(next) => { setHypotheses(next); void db.saveDiagnoses(id, next, flags); }} /></div> : null}

      {step === 6 ? <MenuStep conduct={conduct} setConduct={setConduct} busy={busy} foods={foods.data ?? []} plan={plan} targetKcal={energyResult.tee} onGenerate={() => void generatePlan()} onUpdatePlan={updatePlan} onSave={() => void savePlan()} onFinish={() => void finish()} /> : null}

      <div className="mt-8 flex items-center justify-between border-t border-border pt-4"><Button variant="ghost" size="sm" onClick={goPrevious} disabled={step === 0}><ArrowLeft /> Anterior</Button>{step < STEPS.length - 1 ? <Button size="sm" onClick={goNext}>Próxima etapa <ArrowRight /></Button> : <Link to="/prontuario/$id" params={{ id }}><Button size="sm" variant="secondary"><FileText /> Abrir parecer</Button></Link>}</div>
    </main>
  </AppShell>;
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="rounded-md border border-border p-4"><div className="flex items-center gap-2 text-sm font-medium">{icon}{title}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p></div>; }
function ActionBar({ busy, disabled, label, icon, onAction, secondary }: { busy: boolean; disabled: boolean; label: string; icon: React.ReactNode; onAction: () => void; secondary?: React.ReactNode }) { return <div className="flex flex-wrap items-center gap-2"><Button size="sm" disabled={disabled} onClick={onAction}>{icon}{busy ? "Processando…" : label}</Button>{secondary}</div>; }

/** Última aba: cardápio pré-carregado, editável, pronto para imprimir/enviar. */
function MenuStep({ conduct, setConduct, busy, foods, plan, targetKcal, onGenerate, onUpdatePlan, onSave, onFinish }: {
  conduct: db.ConductRow; setConduct: (value: db.ConductRow) => void; busy: string | null; foods: Food[];
  plan: { plan: MealPlan; rationale: string } | null; targetKcal: number | null;
  onGenerate: () => void; onUpdatePlan: (plan: MealPlan) => void; onSave: () => void; onFinish: () => void;
}) {
  const editGrams = (mealIndex: number, itemIndex: number, grams: number) => {
    if (!plan) return;
    const meals = plan.plan.meals.map((meal, mi) => mi !== mealIndex ? meal : { ...meal, items: meal.items.map((item, ii) => ii !== itemIndex ? item : scaleItem(item, grams)) });
    onUpdatePlan(recalculatePlan(meals));
  };
  const removeItem = (mealIndex: number, itemIndex: number) => {
    if (!plan) return;
    const meals = plan.plan.meals.map((meal, mi) => mi !== mealIndex ? meal : { ...meal, items: meal.items.filter((_, ii) => ii !== itemIndex) });
    onUpdatePlan(recalculatePlan(meals));
  };

  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{([["kcal", "Calorias alvo (kcal)"], ["meals_count", "Refeições por dia"], ["goal", "Objetivo"], ["phase", "Fase"]] as const).map(([key, label]) => <label key={key} className="text-xs text-muted-foreground">{label}<Input type={key === "kcal" || key === "meals_count" ? "number" : "text"} min={key === "meals_count" ? 3 : undefined} max={key === "meals_count" ? 6 : undefined} value={conduct[key] ?? ""} onChange={(event) => setConduct({ ...conduct, [key]: key === "kcal" || key === "meals_count" ? Number(event.target.value) || 0 : event.target.value })} className="mt-1 text-sm" /></label>)}</div>
    {targetKcal ? <p className="text-xs text-muted-foreground">GET calculado na aba de cálculos: <span className="font-medium tabular-nums text-foreground">{targetKcal} kcal/dia</span>.</p> : null}
    <div><p className="mb-2 text-xs text-muted-foreground">Restrições alimentares</p><div className="flex flex-wrap gap-2">{RESTRICTION_OPTIONS.map((option) => { const active = conduct.restrictions.includes(option.value); return <Button key={option.value} type="button" size="sm" variant={active ? "default" : "outline"} onClick={() => setConduct({ ...conduct, restrictions: active ? conduct.restrictions.filter((value) => value !== option.value) : [...conduct.restrictions, option.value] })}>{active ? <Check /> : null}{option.label}</Button>; })}</div></div>

    <div className="flex flex-wrap items-center gap-2">
      <Button size="sm" disabled={busy !== null || !foods.length} onClick={onGenerate}><Sparkles />{busy === "plano" ? "Montando cardápio…" : plan ? "Regenerar cardápio" : "Gerar cardápio"}</Button>
      {plan ? <Button size="sm" variant="outline" disabled={busy !== null} onClick={onSave}><Save /> Salvar edições</Button> : null}
      {plan ? <Button size="sm" variant="secondary" disabled={busy !== null} onClick={onFinish}><FileText />{busy === "parecer" ? "Gerando parecer…" : "Gerar parecer e finalizar"}</Button> : null}
    </div>
    {!foods.length ? <p className="text-sm text-destructive">A base de alimentos ainda não está disponível.</p> : null}

    {plan ? <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-4"><Summary label="Total" value={`${Math.round(plan.plan.totals.kcal)} kcal`} /><Summary label="Proteínas" value={`${plan.plan.totals.protein_g} g`} /><Summary label="Carboidratos" value={`${plan.plan.totals.carb_g} g`} /><Summary label="Gorduras" value={`${plan.plan.totals.fat_g} g`} /></div>
      {plan.plan.meals.map((meal, mealIndex) => <div key={meal.slot} className="rounded-md border border-border">
        <div className="flex items-center justify-between border-b border-border px-3 py-2 text-sm font-medium"><span>{MEAL_SLOT_LABELS[meal.slot]}</span><span className="text-xs tabular-nums text-muted-foreground">{Math.round(meal.totals.kcal)} kcal</span></div>
        <ul className="divide-y divide-border text-sm">{meal.items.map((item, itemIndex) => <li key={`${item.food_id}-${itemIndex}`} className="flex items-center justify-between gap-3 px-3 py-2">
          <span className="min-w-0"><span className="block truncate">{item.name}</span><span className="text-xs text-muted-foreground">{item.household_measure}</span></span>
          <span className="flex shrink-0 items-center gap-2">
            <Input type="number" min={1} value={item.grams} onChange={(event) => editGrams(mealIndex, itemIndex, Number(event.target.value) || 1)} className="h-8 w-20 text-right text-sm" aria-label={`Quantidade de ${item.name} em gramas`} />
            <span className="text-xs text-muted-foreground">g</span>
            <span className="w-16 text-right text-xs tabular-nums text-muted-foreground">{Math.round(item.macros.kcal)} kcal</span>
            <Button type="button" variant="ghost" size="icon" className="size-7 text-muted-foreground" title="Remover item" aria-label="Remover item" onClick={() => removeItem(mealIndex, itemIndex)}><Trash2 /></Button>
          </span>
        </li>)}</ul>
      </div>)}
      <div className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-sm">{plan.rationale}</div>
      <DictationField label="Observações da conduta" value={conduct.notes ?? ""} onChange={(notes) => setConduct({ ...conduct, notes })} />
    </div> : <div className="flex items-start gap-3 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{busy === "plano" ? "Montando o cardápio com os dados das abas anteriores…" : "Ajuste os critérios e gere a primeira versão do cardápio."}</div>}
  </div>;
}
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-md border border-border px-3 py-2"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-sm font-semibold tabular-nums">{value}</div></div>; }