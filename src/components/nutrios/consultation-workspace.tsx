import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, ClipboardList, Cloud, CloudOff, FileText, LoaderCircle, Mic, RefreshCw, Save, Sparkles, Square, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ConsultationAutosave } from "@/components/nutrios/consultation-autosave";
import { ConsultationTimer } from "@/components/nutrios/consultation-timer";
import { DictationField } from "@/components/nutrios/dictation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnthropometryPanel } from "@/modules/consulta/ui/panels";
import { CompactAnamnesisPanel } from "@/modules/consulta/ui/compact-anamnesis-panel";
import { FoodRecallPanel } from "@/modules/consulta/ui/recall-panel";
import { acceptedClinicalContext } from "@/modules/diagnostico/domain/clinical-reasoning";
import * as reasoningDb from "@/modules/diagnostico/infrastructure/reasoning-repository";
import { DiagnosisPanel } from "@/modules/diagnostico/ui/diagnosis-adapter";
import { EnergyPanel } from "@/modules/avaliacao/ui/energy-panel";
import { analyzeAnthropometry, ageFromBirthDate, biologicalSex, type AnthroData, type SkinfoldFormula } from "@/modules/avaliacao/domain/anthropometry";
import { DEFAULT_ENERGY, calculateEnergy, type EnergyInputs } from "@/modules/avaliacao/domain/energy";
import { LabAssessmentPanel } from "@/modules/exames/ui/lab-assessment-panel";
import * as labDb from "@/modules/exames/infrastructure/labs-repository";
import { buildMealPlan, defaultMacros, recalculatePlan, scaleItem } from "@/modules/plano/domain/meal-plan-engine";
import { blobToBase64, startRecording, type AudioRecorder } from "@/modules/transcricao/recorder";
import { countPendingAudioWindows, listPendingAudioWindows, markPendingAudioAttempt, removePendingAudioWindow, savePendingAudioWindow, type PendingAudioWindow } from "@/modules/transcricao/pending-queue";
import * as db from "@/lib/nutrios/repository";
import { describeMealPlan, generateClinicalSummary, generateReport, interpretAnthropometry, transcribeChunk } from "@/lib/nutrios/ai.functions";
import { MEAL_SLOT_LABELS, RESTRICTION_OPTIONS, type AnamnesisFields, type Food, type MealPlan, type RecallItem } from "@/lib/nutrios/types";

export const CONSULTATION_STEPS = ["Consulta", "Anamnese", "Antropometria", "Cálculos", "Recordatório", "Exames", "Diagnóstico", "Cardápio"] as const;

const HINTS: Record<number, string> = {
  0: "Capture a conversa com salvamento local e sincronização automática.",
  1: "Anamnese enxuta: comece pelo essencial e abra os complementares somente quando precisar.",
  2: "Preencha as medidas: os resultados analíticos são calculados na hora.",
  3: "Escolha a fórmula e ajuste os fatores — os cálculos são salvos automaticamente.",
  4: "Organize o dia alimentar pela conversa, por voz ou manualmente e confira as lacunas do relato.",
  5: "Digite, dite ou importe exames; revise a extração e acompanhe cada marcador entre consultas.",
  6: "Organize achados, hipóteses, prioridades e direcionamentos com evidências e validação profissional.",
  7: "O cardápio usa o raciocínio clínico validado como contexto e salva suas edições automaticamente.",
};

type ConsultationWorkspaceProps = {
  consultationId: string;
  activeStep?: number | undefined;
  embedded?: boolean | undefined;
  onOpenReport?: (() => void) | undefined;
  onRecordingChange?: ((recording: boolean) => void) | undefined;
};

export function ConsultationWorkspace({
  consultationId: id,
  activeStep,
  embedded = false,
  onOpenReport,
  onRecordingChange,
}: ConsultationWorkspaceProps) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [step, setStep] = useState(activeStep ?? 0);
  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState(false);
  const [recordingBusy, setRecordingBusy] = useState(false);
  const [finalizingAudio, setFinalizingAudio] = useState(false);
  const [processingCount, setProcessingCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [online, setOnline] = useState(true);
  const recorder = useRef<AudioRecorder | null>(null);
  const secondsRef = useRef(0);
  const transcriptRef = useRef("");
  const syncingRef = useRef(false);
  const transcribe = useServerFn(transcribeChunk);
  const consultation = useQuery({ queryKey: ["consultation", id], queryFn: () => db.getConsultation(id) });
  const segments = useQuery({ queryKey: ["segments", id], queryFn: () => db.listSegments(id), refetchInterval: recording ? 4000 : false });
  const foods = useQuery({ queryKey: ["foods"], queryFn: db.listFoods });
  const labResults = useQuery({ queryKey: ["lab-results", id], queryFn: () => labDb.listLabResults(id) });
  const [anamnesis, setAnamnesis] = useState<AnamnesisFields>({});
  const [anthro, setAnthro] = useState<AnthroData>({});
  const [formula, setFormula] = useState<SkinfoldFormula>("pollock3");
  const [interpretation, setInterpretation] = useState("");
  const [energy, setEnergy] = useState<EnergyInputs>(DEFAULT_ENERGY);
  const [recall, setRecall] = useState<RecallItem[]>([]);
  const [labCount, setLabCount] = useState(0);
  const [hypotheses, setHypotheses] = useState<string[]>([]);
  const [flags, setFlags] = useState<string[]>([]);
  const [conduct, setConduct] = useState<db.ConductRow>({ phase: "adaptacao", kcal: 2000, protein_g: null, carb_g: null, fat_g: null, meals_count: 5, goal: "emagrecimento", preferences: [], restrictions: [], notes: "" });
  const [plan, setPlan] = useState<{ plan: MealPlan; rationale: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (activeStep === undefined) return;
    setStep(activeStep);
  }, [activeStep]);

  useEffect(() => {
    onRecordingChange?.(recording);
    return () => onRecordingChange?.(false);
  }, [onRecordingChange, recording]);

  useEffect(() => () => {
    const activeRecorder = recorder.current;
    recorder.current = null;
    if (activeRecorder) void activeRecorder.stop();
  }, []);

  const patient = consultation.data?.patients;
  const profile = useMemo(() => ({ age: ageFromBirthDate(patient?.birth_date), sex: patient?.sex ?? null }), [patient?.birth_date, patient?.sex]);
  const analysis = useMemo(() => analyzeAnthropometry(anthro, profile, formula), [anthro, profile, formula]);
  const energyResult = useMemo(() => calculateEnergy(energy), [energy]);
  const labContext = useMemo(() => ({
    age: profile.age,
    sex: biologicalSex(profile.sex),
    weightKg: Number(String(anthro["peso"] ?? "").replace(",", ".")) || null,
  }), [anthro, profile.age, profile.sex]);

  useEffect(() => {
    setLoaded(false);
    void (async () => {
      setAnamnesis(await db.getAnamnesis(id));
      const anthropometry = await db.getAnthropometry(id);
      setAnthro(anthropometry.data as AnthroData);
      if (anthropometry.data["formula"]) setFormula(anthropometry.data["formula"] as SkinfoldFormula);
      setInterpretation(anthropometry.interpretation);
      setRecall((await db.listRecall(id)) as RecallItem[]);
      const diagnoses = await db.getDiagnoses(id); setHypotheses(diagnoses.hypotheses); setFlags(diagnoses.recall_flags);
      const saved = await db.getConduct(id);
      if (saved) { setConduct(saved); if (saved.energy && Object.keys(saved.energy).length) setEnergy({ ...DEFAULT_ENERGY, ...(saved.energy as unknown as Partial<EnergyInputs>) }); }
      const savedPlan = await db.getMealPlan(id); if (savedPlan) setPlan({ plan: savedPlan.plan, rationale: savedPlan.rationale });
      setLoaded(true);
    })().catch((error: Error) => toast.error(error.message));
  }, [id]);

  useEffect(() => {
    if (step !== 3) return;
    const sex = biologicalSex(profile.sex);
    setEnergy((current) => ({
      ...current,
      weight: current.weight ?? (Number(String(anthro["peso"] ?? "").replace(",", ".")) || null),
      height: current.height ?? (Number(String(anthro["altura"] ?? "").replace(",", ".")) || null),
      age: current.age ?? profile.age,
      leanMass: current.leanMass ?? analysis.leanMass,
      sex: current.sex ?? sex,
    }));
  }, [step, anthro, profile, analysis.leanMass]);

  useEffect(() => { if (!recording && consultation.data?.duration_seconds) { setSeconds(consultation.data.duration_seconds); secondsRef.current = consultation.data.duration_seconds; } }, [consultation.data?.duration_seconds, recording]);
  useEffect(() => { secondsRef.current = seconds; }, [seconds]);
  useEffect(() => { if (!recording) return; const interval = window.setInterval(() => setSeconds((value) => value + 1), 1000); return () => window.clearInterval(interval); }, [recording]);

  const transcriptText = (segments.data ?? []).map((segment) => `${segment.speaker === "nutricionista" ? "Nutricionista" : "Paciente"}: ${segment.content}`).join("\n");
  const anamnesisText = Object.entries(anamnesis).filter(([, field]) => field?.value && field.status !== "recusado").map(([key, field]) => `${key}: ${field?.value}`).join("\n");
  const analysisText = analysis.groups.map((group) => `${group.title}\n${group.results.map((r) => `- ${r.label}: ${r.value}${r.detail ? ` (${r.detail})` : ""}`).join("\n")}`).join("\n\n");
  const energyText = `Equação: ${energy.formula} | TMB/GER: ${energyResult.bmr ?? "—"} kcal | Manutenção: ${energyResult.maintenanceKcal ?? "—"} kcal | Ajuste clínico: ${energy.manualAdjust} kcal | Meta prescrita: ${energyResult.targetKcal ?? "—"} kcal | Exercício MET líquido: ${energyResult.metKcal} kcal | Gestação/lactação: ${energyResult.pregnancyKcal} kcal`;
  const labText = (labResults.data ?? [])
    .filter((item) => item.review_status === "confirmed" && item.value !== null)
    .map((item) => `${item.analyte_name}: ${item.value} ${item.unit ?? ""}${item.is_derived ? ` [calculado: ${item.calculation_version ?? item.calculation_key ?? "índice derivado"}]` : " [medido]"}`)
    .join("\n");

  const getValidatedClinicalContext = useCallback(async () => {
    const reasoning = await reasoningDb.getClinicalReasoning(id);
    const accepted = acceptedClinicalContext(reasoning);
    const sections = [
      accepted.findings.length ? `Achados objetivos:\n${accepted.findings.map((item) => `- ${item.label}: ${item.detail}`).join("\n")}` : "",
      accepted.flags.length ? `Sinalizações:\n${accepted.flags.map((item) => `- ${item}`).join("\n")}` : "",
      accepted.hypotheses.length ? `Hipóteses nutricionais validadas:\n${accepted.hypotheses.map((item) => `- ${item.title}: ${item.rationale}${item.evidence.length ? ` | Evidências: ${item.evidence.join("; ")}` : ""}`).join("\n")}` : "",
      accepted.priorities.length ? `Prioridades clínicas validadas:\n${accepted.priorities.map((item) => `- ${item.rank}. ${item.title}: ${item.rationale}`).join("\n")}` : "",
      accepted.directions.length ? `Direcionamentos nutricionais validados:\n${accepted.directions.map((item) => `- ${item.title}: ${item.rationale}`).join("\n")}` : "",
    ].filter(Boolean);
    const hasReviewedReasoning = accepted.hypotheses.length > 0 || accepted.priorities.length > 0 || accepted.directions.length > 0;
    if (hasReviewedReasoning) return sections.join("\n\n");
    const legacy = [
      flags.length ? `Sinalizações registradas:\n${flags.map((item) => `- ${item}`).join("\n")}` : "",
      hypotheses.length ? `Hipóteses registradas:\n${hypotheses.map((item) => `- ${item}`).join("\n")}` : "",
    ].filter(Boolean).join("\n\n");
    return sections.length ? `${sections.join("\n\n")}${legacy ? `\n\n${legacy}` : ""}` : legacy;
  }, [flags, hypotheses, id]);

  useEffect(() => { transcriptRef.current = transcriptText; }, [transcriptText]);

  const refreshPendingCount = useCallback(async () => {
    try { setPendingCount(await countPendingAudioWindows(id)); }
    catch { setPendingCount(0); }
  }, [id]);

  const processPendingWindow = useCallback(async (windowItem: PendingAudioWindow) => {
    setProcessingCount((value) => value + 1);
    try {
      await markPendingAudioAttempt(windowItem.id);
      const result = await transcribe({ data: { audioBase64: await blobToBase64(windowItem.audio), context: transcriptRef.current.slice(-1500) } });
      if (result.segments.length) await db.insertSegments(id, result.segments.map((segment, index) => ({ ...segment, offset_seconds: windowItem.offsetSeconds, client_id: `${windowItem.id}-${index}` })));
      await removePendingAudioWindow(windowItem.id);
      await queryClient.invalidateQueries({ queryKey: ["segments", id] });
      return true;
    } catch { return false; }
    finally { setProcessingCount((value) => Math.max(0, value - 1)); void refreshPendingCount(); }
  }, [id, queryClient, refreshPendingCount, transcribe]);

  const syncPending = useCallback(async () => {
    if (syncingRef.current || !navigator.onLine) return;
    syncingRef.current = true;
    try {
      const pending = await listPendingAudioWindows(id);
      for (const item of pending) { if (!navigator.onLine) break; const completed = await processPendingWindow(item); if (!completed) break; }
    } finally { syncingRef.current = false; await refreshPendingCount(); }
  }, [id, processPendingWindow, refreshPendingCount]);

  useEffect(() => {
    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    void refreshPendingCount().then(() => syncPending());
    const handleOnline = () => { setOnline(true); void syncPending(); };
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline); window.addEventListener("offline", handleOffline);
    return () => { window.removeEventListener("online", handleOnline); window.removeEventListener("offline", handleOffline); };
  }, [refreshPendingCount, syncPending]);

  useEffect(() => {
    const shouldWarn = recording || finalizingAudio || pendingCount > 0;
    if (!shouldWarn) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [recording, finalizingAudio, pendingCount]);

  const handleWindow = useCallback(async (wav: Blob, offset: number) => {
    const item: PendingAudioWindow = { id: crypto.randomUUID(), consultationId: id, offsetSeconds: offset, createdAt: Date.now(), attempts: 0, audio: wav };
    await savePendingAudioWindow(item); await refreshPendingCount(); if (navigator.onLine) await processPendingWindow(item);
  }, [id, processPendingWindow, refreshPendingCount]);

  const toggleRecording = async () => {
    if (recordingBusy) return;
    setRecordingBusy(true);
    try {
      if (recording) {
        setFinalizingAudio(true);
        try { await recorder.current?.stop(); } finally { recorder.current = null; setRecording(false); }
        await refreshPendingCount(); if (navigator.onLine) await syncPending();
        await queryClient.invalidateQueries({ queryKey: ["segments", id] });
        await db.updateConsultation(id, { status: "gravada", duration_seconds: secondsRef.current, ended_at: new Date().toISOString() });
        await queryClient.invalidateQueries({ queryKey: ["consultation", id] });
        toast.success("Gravação encerrada. A transcrição será usada para atualizar a anamnese automaticamente."); return;
      }
      if (!navigator.mediaDevices?.getUserMedia) { toast.error("Este navegador não disponibiliza acesso ao microfone. Use uma versão atualizada do Chrome, Edge ou Safari."); return; }
      recorder.current = await startRecording(handleWindow, 6000, secondsRef.current); setRecording(true);
      await db.updateConsultation(id, { status: "em_andamento", started_at: consultation.data?.started_at ?? new Date().toISOString(), ended_at: null });
      await queryClient.invalidateQueries({ queryKey: ["consultation", id] });
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") toast.error("O acesso ao microfone foi bloqueado. Autorize o microfone para este site nas configurações do navegador e tente novamente.");
      else if (name === "NotFoundError" || name === "DevicesNotFoundError") toast.error("Nenhum microfone foi encontrado neste dispositivo.");
      else toast.error(error instanceof Error ? error.message : "Não foi possível iniciar ou encerrar a gravação.");
    } finally { setFinalizingAudio(false); setRecordingBusy(false); }
  };

  const run = async (label: string, action: () => Promise<void>, message = "Alterações salvas.") => {
    setBusy(label); try { await action(); toast.success(message); } catch (error) { toast.error((error as Error).message); } finally { setBusy(null); }
  };

  const generatePlan = async (notify = true) => {
    const targetKcal = energyResult.targetKcal ?? energyResult.tee ?? conduct.kcal ?? 2000;
    await run("plano", async () => {
      const clinicalContext = await getValidatedClinicalContext();
      const macros = defaultMacros(targetKcal);
      const nextConduct: db.ConductRow = { ...conduct, kcal: targetKcal, energy: energy as unknown as Record<string, unknown> };
      const generated = buildMealPlan({ phase: nextConduct.phase, kcal: targetKcal, protein_g: nextConduct.protein_g ?? macros.protein_g, carb_g: nextConduct.carb_g ?? macros.carb_g, fat_g: nextConduct.fat_g ?? macros.fat_g, meals_count: nextConduct.meals_count, goal: nextConduct.goal, preferences: nextConduct.preferences, restrictions: nextConduct.restrictions }, foods.data ?? []);
      const { rationale } = await describeMealPlan({ data: { plan: JSON.stringify(generated.meals), context: `${anamnesisText}\n${analysisText}\n${energyText}\nExames:\n${labText || "Sem exames confirmados"}\n\nRaciocínio clínico validado:\n${clinicalContext || "Sem hipóteses, prioridades ou direcionamentos validados nesta consulta."}\n\nObjetivo: ${nextConduct.goal ?? ""}\nFase: ${nextConduct.phase ?? ""}` } });
      setConduct(nextConduct); setPlan({ plan: generated, rationale }); await db.saveConduct(id, nextConduct); await db.saveMealPlan(id, generated, rationale);
    }, notify ? "Cardápio gerado com o contexto clínico validado." : "Cardápio pré-carregado.");
  };

  const updatePlan = (next: MealPlan) => setPlan((current) => (current ? { ...current, plan: next } : current));
  const savePlan = async () => { if (!plan) return; await run("salvar-plano", async () => { await db.saveConduct(id, { ...conduct, energy: energy as unknown as Record<string, unknown> }); await db.saveMealPlan(id, plan.plan, plan.rationale); }); };

  const finish = async () => {
    await run("parecer", async () => {
      const clinicalContext = await getValidatedClinicalContext();
      const summary = await generateClinicalSummary({ data: { transcript: transcriptText, anamnesis: anamnesisText } });
      const report = await generateReport({ data: {
        patient: `${patient?.name ?? ""} | ${profile.age ?? "?"} anos | ${patient?.sex ?? "não informado"}`,
        anamnesis: anamnesisText,
        anthropometry: `${analysisText}\n\nExames laboratoriais confirmados:\n${labText || "Sem exames confirmados nesta consulta."}`,
        energy: energyText,
        diagnosis: clinicalContext || `Sinalizações: ${flags.join("; ")}\nHipóteses: ${hypotheses.join("; ")}`,
        plan: plan ? `Cardápio estruturado:\n${JSON.stringify(plan.plan.meals)}\n\nJustificativa do plano:\n${plan.rationale}` : "Sem plano gerado.",
      } });
      await db.saveReport(id, report.report);
      await db.updateConsultation(id, { clinical_summary: summary.summary, status: "finalizada" });
      void queryClient.invalidateQueries({ queryKey: ["consultation", id] });
      if (onOpenReport) onOpenReport();
      else void navigate({ to: "/prontuario/$id", params: { id } });
    }, "Parecer gerado com o raciocínio clínico validado.");
  };

  const completed = [
    Boolean(segments.data?.length),
    Object.values(anamnesis).some((field) => field?.value && field.status !== "recusado"),
    Object.values(anthro).some(Boolean),
    Boolean(energyResult.targetKcal ?? energyResult.maintenanceKcal),
    recall.some((item) => Boolean(item.foods?.trim())),
    labCount > 0,
    hypotheses.length > 0 || flags.length > 0,
    Boolean(plan),
  ];
  const goNext = () => setStep((value) => Math.min(CONSULTATION_STEPS.length - 1, value + 1));
  const goPrevious = () => setStep((value) => Math.max(0, value - 1));
  const operationalStatus = finalizingAudio ? "Finalizando áudio…" : recording ? "Gravando" : processingCount > 0 ? "Processando transcrição…" : pendingCount > 0 ? `${pendingCount} trecho${pendingCount === 1 ? "" : "s"} aguardando sincronização` : "Tudo salvo";

  return <div className="min-h-0 bg-background">
    <ConsultationAutosave consultationId={id} loaded={loaded} anamnesis={anamnesis} anthro={anthro} formula={formula} interpretation={interpretation} energy={energy} conduct={conduct} plan={plan} />

    <div className={`${embedded ? "" : "sticky top-0 z-10"} border-b border-border bg-background/95 px-4 py-3 backdrop-blur sm:px-6`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{embedded ? CONSULTATION_STEPS[step] : patient?.name ?? "Consulta"}</div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span className={`size-1.5 rounded-full ${recording ? "bg-destructive" : "bg-muted-foreground"}`} />{!embedded && profile.age !== null ? `${profile.age} anos · ` : ""}<span>{operationalStatus}</span><span aria-hidden="true">·</span><span className="inline-flex items-center gap-1">{online ? <Cloud className="size-3" /> : <CloudOff className="size-3" />}{online ? "Online" : "Offline"}</span></div>
        </div>
        <div className="flex items-center gap-3"><ConsultationTimer seconds={seconds} running={recording} /><Button size="sm" variant={recording ? "destructive" : "default"} disabled={recordingBusy} onClick={() => void toggleRecording()}>{finalizingAudio ? <LoaderCircle className="animate-spin" /> : recording ? <Square /> : <Mic />}{finalizingAudio ? "Finalizando…" : recording ? "Encerrar" : "Iniciar consulta"}</Button>{!embedded ? <Link to="/prontuario/$id" params={{ id }} className="hidden text-xs text-muted-foreground underline-offset-4 hover:underline sm:block">Prontuário</Link> : null}</div>
      </div>
    </div>

    {!embedded ? <div className="border-b border-border px-3 py-3 sm:px-6"><div className="mx-auto flex max-w-6xl items-center gap-1 overflow-x-auto pb-1" role="tablist" aria-label="Etapas da consulta">{CONSULTATION_STEPS.map((label, index) => <Button key={label} type="button" role="tab" aria-selected={step === index} variant={step === index ? "secondary" : "ghost"} size="sm" className="shrink-0" onClick={() => setStep(index)}>{completed[index] ? <Check /> : <span className="text-[10px]">{index + 1}</span>}{label}</Button>)}</div></div> : null}

    <main className={`mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 ${embedded ? "sm:py-6" : "sm:py-8"}`}>
      <div className="mb-6 flex items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Etapa {step + 1} de {CONSULTATION_STEPS.length}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{CONSULTATION_STEPS[step]}</h1><p className="mt-1 text-sm text-muted-foreground">{HINTS[step]}</p></div><div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex"><ClipboardList className="size-4" />{completed.filter(Boolean).length}/{CONSULTATION_STEPS.length} etapas com dados</div></div>

      {step === 0 ? <section className="grid gap-6 lg:grid-cols-[1fr_300px]"><div className="min-h-[360px] rounded-md border border-border"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"><div><h2 className="text-sm font-medium">Transcrição da consulta</h2><p className="mt-0.5 text-xs text-muted-foreground">Cada trecho é preservado localmente antes de ser enviado para transcrição.</p></div><span className="text-xs tabular-nums text-muted-foreground">{segments.data?.length ?? 0} falas</span></div><div className="max-h-[560px] space-y-3 overflow-y-auto p-4" aria-live="polite">{(segments.data ?? []).map((segment) => <p key={segment.id} className="text-sm leading-6"><span className={segment.speaker === "nutricionista" ? "font-medium text-primary" : "font-medium text-muted-foreground"}>{segment.speaker === "nutricionista" ? "Nutricionista" : "Paciente"}:</span>{" "}{segment.content}</p>)}{!segments.data?.length ? <div className="flex min-h-64 flex-col items-center justify-center text-center"><Mic className="size-6 text-muted-foreground" /><p className="mt-3 text-sm text-muted-foreground">Inicie a consulta para capturar a primeira fala.</p><p className="mt-1 max-w-sm text-xs leading-5 text-muted-foreground">Se a conexão cair, o Cach AI continua preservando as janelas de áudio neste dispositivo e tenta sincronizar quando a internet voltar.</p></div> : null}</div></div><aside className="space-y-3"><div className="rounded-md border border-border p-4"><div className="flex items-center justify-between gap-2"><div className="flex items-center gap-2 text-sm font-medium">{online ? <Cloud /> : <CloudOff />}{online ? "Conectado" : "Sem internet"}</div>{processingCount > 0 ? <LoaderCircle className="size-4 animate-spin text-muted-foreground" /> : null}</div><div className="mt-3 space-y-1.5 text-xs leading-5 text-muted-foreground"><p>{recording ? "Microfone ativo e gravação em andamento." : finalizingAudio ? "Aguardando o último trecho ser preservado." : "Gravação parada."}</p><p>{pendingCount > 0 ? `${pendingCount} trecho${pendingCount === 1 ? "" : "s"} salvo${pendingCount === 1 ? "" : "s"} localmente aguardando sincronização.` : "Tudo sincronizado com o prontuário."}</p></div>{pendingCount > 0 && online ? <Button type="button" variant="outline" size="sm" className="mt-3 w-full" disabled={processingCount > 0} onClick={() => void syncPending()}><RefreshCw /> Tentar sincronizar agora</Button> : null}</div><InfoCard icon={<Sparkles />} title="Anamnese em tempo real" text="A cada trecho transcrito, a conversa atualiza sugestões da anamnese sem substituir campos já revisados." /><InfoCard icon={<FileText />} title="Proteção contra perda" text="A gravação continua ao trocar de aba, e as etapas clínicas são salvas automaticamente enquanto você trabalha." /></aside></section> : null}

      <div className={step === 1 ? "" : "hidden"}>
        <CompactAnamnesisPanel consultationId={id} fields={anamnesis} onChange={setAnamnesis} transcript={transcriptText} canAutoExtract={loaded && processingCount === 0 && pendingCount === 0} />
      </div>
      {step === 2 ? <div className="space-y-4"><AnthropometryPanel consultationId={id} data={anthro} interpretation={interpretation} profile={profile} formula={formula} onFormulaChange={setFormula} onChange={setAnthro} /><ActionBar busy={busy === "antro"} disabled={busy !== null} label="Interpretar e salvar avaliação" icon={<Sparkles />} onAction={() => void run("antro", async () => { const result = await interpretAnthropometry({ data: { data: `${JSON.stringify(anthro)}\n\n${analysisText}` } }); setInterpretation(result.interpretation); await db.saveAnthropometry(id, { ...anthro, formula }, result.interpretation); })} secondary={<Button size="sm" variant="outline" onClick={() => void run("save-antro", async () => db.saveAnthropometry(id, { ...anthro, formula }, interpretation))}><Save /> Salvar agora</Button>} /></div> : null}
      {step === 3 ? <div className="space-y-4"><EnergyPanel consultationId={id} value={energy} onChange={setEnergy} /><ActionBar busy={busy === "energia"} disabled={busy !== null} label="Salvar agora" icon={<Save />} onAction={() => void run("energia", async () => db.saveConduct(id, { ...conduct, kcal: energyResult.targetKcal ?? energyResult.maintenanceKcal ?? conduct.kcal, energy: energy as unknown as Record<string, unknown> }))} /></div> : null}
      {step === 4 ? <FoodRecallPanel consultationId={id} items={recall} transcript={transcriptText} onChange={setRecall} /> : null}
      {step === 5 && patient ? <LabAssessmentPanel consultationId={id} patientId={patient.id} context={labContext} onCountChange={setLabCount} /> : null}
      {step === 6 ? <DiagnosisPanel consultationId={id} hypotheses={hypotheses} flags={flags} onChange={(next) => { setHypotheses(next); void db.saveDiagnoses(id, next, flags); }} /> : null}
      {step === 7 ? <MenuStep conduct={conduct} setConduct={setConduct} busy={busy} foods={foods.data ?? []} plan={plan} targetKcal={energyResult.targetKcal ?? energyResult.tee} onGenerate={() => void generatePlan()} onUpdatePlan={updatePlan} onSave={() => void savePlan()} onFinish={() => void finish()} /> : null}

      {!embedded ? <div className="mt-8 flex items-center justify-between border-t border-border pt-4"><Button variant="ghost" size="sm" onClick={goPrevious} disabled={step === 0}><ArrowLeft /> Anterior</Button>{step < CONSULTATION_STEPS.length - 1 ? <Button size="sm" onClick={goNext} disabled={finalizingAudio}>Próxima etapa <ArrowRight /></Button> : <Link to="/prontuario/$id" params={{ id }}><Button size="sm" variant="secondary"><FileText /> Abrir parecer</Button></Link>}</div> : null}
    </main>
  </div>;
}

function InfoCard({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) { return <div className="rounded-md border border-border p-4"><div className="flex items-center gap-2 text-sm font-medium">{icon}{title}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{text}</p></div>; }
function ActionBar({ busy, disabled, label, icon, onAction, secondary }: { busy: boolean; disabled: boolean; label: string; icon: React.ReactNode; onAction: () => void; secondary?: React.ReactNode }) { return <div className="flex flex-wrap items-center gap-2"><Button size="sm" disabled={disabled} onClick={onAction}>{icon}{busy ? "Processando…" : label}</Button>{secondary}</div>; }

function MenuStep({ conduct, setConduct, busy, foods, plan, targetKcal, onGenerate, onUpdatePlan, onSave, onFinish }: {
  conduct: db.ConductRow; setConduct: (value: db.ConductRow) => void; busy: string | null; foods: Food[];
  plan: { plan: MealPlan; rationale: string } | null; targetKcal: number | null;
  onGenerate: () => void; onUpdatePlan: (plan: MealPlan) => void; onSave: () => void; onFinish: () => void;
}) {
  const editGrams = (mealIndex: number, itemIndex: number, grams: number) => { if (!plan) return; const meals = plan.plan.meals.map((meal, mi) => mi !== mealIndex ? meal : { ...meal, items: meal.items.map((item, ii) => ii !== itemIndex ? item : scaleItem(item, grams)) }); onUpdatePlan(recalculatePlan(meals)); };
  const removeItem = (mealIndex: number, itemIndex: number) => { if (!plan) return; const meals = plan.plan.meals.map((meal, mi) => mi !== mealIndex ? meal : { ...meal, items: meal.items.filter((_, ii) => ii !== itemIndex) }); onUpdatePlan(recalculatePlan(meals)); };
  return <div className="space-y-6">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{([["kcal", "Calorias alvo (kcal)"], ["meals_count", "Refeições por dia"], ["goal", "Objetivo"], ["phase", "Fase"]] as const).map(([key, label]) => <label key={key} className="text-xs text-muted-foreground">{label}<Input type={key === "kcal" || key === "meals_count" ? "number" : "text"} min={key === "meals_count" ? 3 : undefined} max={key === "meals_count" ? 6 : undefined} value={conduct[key] ?? ""} onChange={(event) => setConduct({ ...conduct, [key]: key === "kcal" || key === "meals_count" ? Number(event.target.value) || 0 : event.target.value })} className="mt-1 text-sm" /></label>)}</div>
    {targetKcal ? <p className="text-xs text-muted-foreground">Meta calórica definida na aba de cálculos: <span className="font-medium tabular-nums text-foreground">{targetKcal} kcal/dia</span>.</p> : null}
    <div><p className="mb-2 text-xs text-muted-foreground">Restrições alimentares</p><div className="flex flex-wrap gap-2">{RESTRICTION_OPTIONS.map((option) => { const active = conduct.restrictions.includes(option.value); return <Button key={option.value} type="button" size="sm" variant={active ? "default" : "outline"} onClick={() => setConduct({ ...conduct, restrictions: active ? conduct.restrictions.filter((value) => value !== option.value) : [...conduct.restrictions, option.value] })}>{active ? <Check /> : null}{option.label}</Button>; })}</div></div>
    <div className="flex flex-wrap items-center gap-2"><Button size="sm" disabled={busy !== null || !foods.length} onClick={onGenerate}><Sparkles />{busy === "plano" ? "Montando cardápio…" : plan ? "Regenerar cardápio" : "Gerar cardápio"}</Button>{plan ? <Button size="sm" variant="outline" disabled={busy !== null} onClick={onSave}><Save /> Salvar agora</Button> : null}{plan ? <Button size="sm" variant="secondary" disabled={busy !== null} onClick={onFinish}><FileText />{busy === "parecer" ? "Gerando parecer…" : "Gerar parecer e finalizar"}</Button> : null}</div>
    {!foods.length ? <p className="text-sm text-destructive">A base de alimentos ainda não está disponível.</p> : null}
    {plan ? <div className="space-y-4"><div className="grid gap-2 sm:grid-cols-4"><Summary label="Total" value={`${Math.round(plan.plan.totals.kcal)} kcal`} /><Summary label="Proteínas" value={`${plan.plan.totals.protein_g} g`} /><Summary label="Carboidratos" value={`${plan.plan.totals.carb_g} g`} /><Summary label="Gorduras" value={`${plan.plan.totals.fat_g} g`} /></div>{plan.plan.meals.map((meal, mealIndex) => <div key={meal.slot} className="rounded-md border border-border"><div className="flex items-center justify-between border-b border-border px-3 py-2 text-sm font-medium"><span>{MEAL_SLOT_LABELS[meal.slot]}</span><span className="text-xs tabular-nums text-muted-foreground">{Math.round(meal.totals.kcal)} kcal</span></div><ul className="divide-y divide-border text-sm">{meal.items.map((item, itemIndex) => <li key={`${item.food_id}-${itemIndex}`} className="flex items-center justify-between gap-3 px-3 py-2"><span className="min-w-0"><span className="block truncate">{item.name}</span><span className="text-xs text-muted-foreground">{item.household_measure}</span></span><span className="flex shrink-0 items-center gap-2"><Input type="number" min={1} value={item.grams} onChange={(event) => editGrams(mealIndex, itemIndex, Number(event.target.value) || 1)} className="h-8 w-20 text-right text-sm" aria-label={`Quantidade de ${item.name} em gramas`} /><span className="text-xs text-muted-foreground">g</span><span className="w-16 text-right text-xs tabular-nums text-muted-foreground">{Math.round(item.macros.kcal)} kcal</span><Button type="button" variant="ghost" size="icon" className="size-7 text-muted-foreground" title="Remover item" aria-label="Remover item" onClick={() => removeItem(mealIndex, itemIndex)}><Trash2 /></Button></span></li>)}</ul></div>)}<div className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-sm">{plan.rationale}</div><DictationField label="Observações da conduta" value={conduct.notes ?? ""} onChange={(notes) => setConduct({ ...conduct, notes })} /></div> : <div className="flex items-start gap-3 rounded-md border border-dashed border-border p-4 text-sm text-muted-foreground"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{busy === "plano" ? "Montando o cardápio com os dados das abas anteriores…" : "Ajuste os critérios e gere a primeira versão do cardápio."}</div>}
  </div>;
}
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-md border border-border px-3 py-2"><div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-1 text-sm font-semibold tabular-nums">{value}</div></div>; }
