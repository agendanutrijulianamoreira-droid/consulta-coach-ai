import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Mic, Square } from "lucide-react";
import { AppShell } from "@/components/nutrios/app-shell";
import { ConsultationTimer } from "@/components/nutrios/consultation-timer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AnamnesisPanel, AnthropometryPanel, DiagnosisPanel, RecallPanel } from "@/modules/consulta/ui/panels";
import { buildMealPlan, defaultMacros } from "@/modules/plano/domain/meal-plan-engine";
import { blobToBase64, startRecording, type AudioRecorder } from "@/modules/transcricao/recorder";
import * as db from "@/lib/nutrios/repository";
import {
  analyzeConsultation,
  describeMealPlan,
  extractAnamnesis,
  generateClinicalSummary,
  interpretAnthropometry,
  transcribeChunk,
} from "@/lib/nutrios/ai.functions";
import { MEAL_SLOT_LABELS, RESTRICTION_OPTIONS, type AnamnesisFields, type MealPlan } from "@/lib/nutrios/types";

export const Route = createFileRoute("/consulta/$id")({
  head: () => ({
    meta: [
      { title: "Consulta em andamento — NutriOS" },
      { name: "description", content: "Transcrição ao vivo, anamnese automática e plano alimentar da consulta." },
      { property: "og:title", content: "Consulta em andamento — NutriOS" },
      { property: "og:description", content: "Documentação clínica gerada durante o atendimento." },
    ],
  }),
  component: ConsultationPage,
});

const STEPS = ["Consulta", "Anamnese", "Antropometria", "Recordatório", "Diagnóstico", "Conduta"] as const;

function ConsultationPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [recording, setRecording] = useState(false);
  const recorder = useRef<AudioRecorder | null>(null);
  const transcribe = useServerFn(transcribeChunk);

  const consultation = useQuery({ queryKey: ["consultation", id], queryFn: () => db.getConsultation(id) });
  const segments = useQuery({
    queryKey: ["segments", id],
    queryFn: () => db.listSegments(id),
    refetchInterval: recording ? 4000 : false,
  });
  const foods = useQuery({ queryKey: ["foods"], queryFn: db.listFoods });

  const [anamnesis, setAnamnesis] = useState<AnamnesisFields>({});
  const [anthro, setAnthro] = useState<db.AnthropometryData>({});
  const [interpretation, setInterpretation] = useState("");
  const [recall, setRecall] = useState<db.RecallItemRow[]>([]);
  const [hypotheses, setHypotheses] = useState<string[]>([]);
  const [flags, setFlags] = useState<string[]>([]);
  const [conduct, setConduct] = useState<db.ConductRow>({
    phase: "adaptacao",
    kcal: 2000,
    protein_g: null,
    carb_g: null,
    fat_g: null,
    meals_count: 5,
    goal: "emagrecimento",
    preferences: [],
    restrictions: [],
    notes: "",
  });
  const [plan, setPlan] = useState<{ plan: MealPlan; rationale: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  // Carrega o estado persistido da consulta uma única vez.
  useEffect(() => {
    void (async () => {
      setAnamnesis(await db.getAnamnesis(id));
      const anthropometry = await db.getAnthropometry(id);
      setAnthro(anthropometry.data);
      setInterpretation(anthropometry.interpretation);
      setRecall((await db.listRecall(id)) as db.RecallItemRow[]);
      const diagnoses = await db.getDiagnoses(id);
      setHypotheses(diagnoses.hypotheses);
      setFlags(diagnoses.recall_flags);
      const saved = await db.getConduct(id);
      if (saved) setConduct(saved);
      const savedPlan = await db.getMealPlan(id);
      if (savedPlan) setPlan({ plan: savedPlan.plan, rationale: savedPlan.rationale });
    })().catch((error: Error) => toast.error(error.message));
  }, [id]);

  useEffect(() => {
    if (!recording) return;
    const interval = window.setInterval(() => setSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(interval);
  }, [recording]);

  const transcriptText = (segments.data ?? [])
    .map((segment) => `${segment.speaker === "nutricionista" ? "Nutricionista" : "Paciente"}: ${segment.content}`)
    .join("\n");

  const handleWindow = async (wav: Blob, offset: number) => {
    try {
      const audioBase64 = await blobToBase64(wav);
      const result = await transcribe({ data: { audioBase64, context: transcriptText.slice(-1500) } });
      if (!result.segments.length) return;
      await db.insertSegments(
        id,
        result.segments.map((segment, index) => ({
          ...segment,
          offset_seconds: offset,
          client_id: `${offset}-${index}`,
        })),
      );
      void queryClient.invalidateQueries({ queryKey: ["segments", id] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      await recorder.current?.stop();
      recorder.current = null;
      setRecording(false);
      await db.updateConsultation(id, { status: "gravada", duration_seconds: seconds });
      toast.success("Gravação encerrada.");
      return;
    }
    try {
      recorder.current = await startRecording((wav) => void handleWindow(wav, seconds));
      setRecording(true);
      await db.updateConsultation(id, { status: "em_andamento", started_at: new Date().toISOString() });
    } catch {
      toast.error("Não foi possível acessar o microfone.");
    }
  };

  const run = async (label: string, action: () => Promise<void>) => {
    setBusy(label);
    try {
      await action();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const anamnesisText = Object.entries(anamnesis)
    .filter(([, field]) => field?.value && field.status !== "recusado")
    .map(([key, field]) => `${key}: ${field?.value}`)
    .join("\n");

  return (
    <AppShell>
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-5 py-3 backdrop-blur">
        <div>
          <div className="text-sm font-medium">{consultation.data?.patients?.name ?? "Consulta"}</div>
          <div className="text-xs text-muted-foreground">
            {recording ? "Gravando e transcrevendo" : "Gravação pausada"}
          </div>
        </div>
        <div className="flex items-center gap-4">
          <ConsultationTimer seconds={seconds} running={recording} />
          <Button size="sm" variant={recording ? "destructive" : "default"} onClick={() => void toggleRecording()}>
            {recording ? <Square className="size-3.5" /> : <Mic className="size-3.5" />}
            {recording ? "Encerrar" : "Iniciar consulta"}
          </Button>
          <Link
            to="/prontuario/$id"
            params={{ id }}
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          >
            Prontuário
          </Link>
        </div>
      </div>

      <nav className="flex gap-1 border-b border-border px-4 py-2 text-xs">
        {STEPS.map((label, index) => (
          <button
            key={label}
            onClick={() => setStep(index)}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              step === index ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="px-5 py-6">
        {step === 0 ? (
          <div className="space-y-2">
            {(segments.data ?? []).map((segment) => (
              <p key={segment.id} className="text-sm">
                <span
                  className={
                    segment.speaker === "nutricionista"
                      ? "font-medium text-primary"
                      : "font-medium text-muted-foreground"
                  }
                >
                  {segment.speaker === "nutricionista" ? "Nutricionista" : "Paciente"}:
                </span>{" "}
                {segment.content}
              </p>
            ))}
            {!segments.data?.length ? (
              <p className="text-sm text-muted-foreground">
                Clique em “Iniciar consulta”. A transcrição aparece aqui automaticamente.
              </p>
            ) : null}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!transcriptText || busy !== null}
                onClick={() =>
                  void run("anamnese", async () => {
                    const result = await extractAnamnesis({ data: { transcript: transcriptText } });
                    const next: AnamnesisFields = { ...anamnesis };
                    for (const [key, value] of Object.entries(result.fields)) {
                      if (value) next[key as keyof AnamnesisFields] = { value, status: "sugerido" };
                    }
                    setAnamnesis(next);
                    await db.saveAnamnesis(id, next);
                  })
                }
              >
                {busy === "anamnese" ? "Extraindo…" : "Extrair anamnese da conversa"}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => void db.saveAnamnesis(id, anamnesis)}>
                Salvar
              </Button>
            </div>
            <AnamnesisPanel fields={anamnesis} onChange={setAnamnesis} />
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <AnthropometryPanel data={anthro} interpretation={interpretation} onChange={setAnthro} />
            <Button
              size="sm"
              disabled={busy !== null}
              onClick={() =>
                void run("antro", async () => {
                  const result = await interpretAnthropometry({ data: { data: JSON.stringify(anthro) } });
                  setInterpretation(result.interpretation);
                  await db.saveAnthropometry(id, anthro, result.interpretation);
                })
              }
            >
              {busy === "antro" ? "Analisando…" : "Interpretar e salvar"}
            </Button>
          </div>
        ) : null}

        {step === 3 ? (
          <RecallPanel
            items={recall}
            onChange={(item) => {
              setRecall((items) => items.map((current) => (current.id === item.id ? item : current)));
              void db.upsertRecallItem(id, item);
            }}
            onRemove={(itemId) => {
              setRecall((items) => items.filter((item) => item.id !== itemId));
              void db.deleteRecallItem(itemId);
            }}
            onAdd={() => {
              const item: db.RecallItemRow = {
                id: crypto.randomUUID(),
                time_label: "",
                foods: "",
                amount: "",
                preparation: "",
                notes: "",
                position: recall.length,
              };
              setRecall((items) => [...items, item]);
              void db.upsertRecallItem(id, item);
            }}
          />
        ) : null}

        {step === 4 ? (
          <div className="space-y-4">
            <Button
              size="sm"
              disabled={busy !== null}
              onClick={() =>
                void run("diag", async () => {
                  const result = await analyzeConsultation({
                    data: {
                      anamnesis: anamnesisText,
                      anthropometry: JSON.stringify(anthro),
                      recall: JSON.stringify(recall),
                    },
                  });
                  setFlags(result.flags);
                  setHypotheses(result.hypotheses);
                  await db.saveDiagnoses(id, result.hypotheses, result.flags);
                })
              }
            >
              {busy === "diag" ? "Analisando…" : "Analisar recordatório"}
            </Button>
            <DiagnosisPanel
              hypotheses={hypotheses}
              flags={flags}
              onChange={(next) => {
                setHypotheses(next);
                void db.saveDiagnoses(id, next, flags);
              }}
            />
          </div>
        ) : null}

        {step === 5 ? (
          <div className="space-y-6">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="text-xs text-muted-foreground">
                Calorias alvo (kcal)
                <Input
                  value={conduct.kcal ?? ""}
                  onChange={(event) => setConduct({ ...conduct, kcal: Number(event.target.value) || 0 })}
                  className="mt-1 text-sm"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Refeições por dia
                <Input
                  value={conduct.meals_count}
                  onChange={(event) => setConduct({ ...conduct, meals_count: Number(event.target.value) || 4 })}
                  className="mt-1 text-sm"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Objetivo
                <Input
                  value={conduct.goal ?? ""}
                  onChange={(event) => setConduct({ ...conduct, goal: event.target.value })}
                  className="mt-1 text-sm"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Fase
                <Input
                  value={conduct.phase ?? ""}
                  onChange={(event) => setConduct({ ...conduct, phase: event.target.value })}
                  className="mt-1 text-sm"
                />
              </label>
            </div>

            <div className="flex flex-wrap gap-2">
              {RESTRICTION_OPTIONS.map((option) => {
                const active = conduct.restrictions.includes(option.value);
                return (
                  <button
                    key={option.value}
                    onClick={() =>
                      setConduct({
                        ...conduct,
                        restrictions: active
                          ? conduct.restrictions.filter((value) => value !== option.value)
                          : [...conduct.restrictions, option.value],
                      })
                    }
                    className={`rounded-full border px-3 py-1 text-xs transition-colors ${
                      active ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>

            <Button
              size="sm"
              disabled={busy !== null || !foods.data?.length}
              onClick={() =>
                void run("plano", async () => {
                  const kcal = conduct.kcal ?? 2000;
                  const macros = defaultMacros(kcal);
                  const generated = buildMealPlan(
                    {
                      phase: conduct.phase,
                      kcal,
                      protein_g: conduct.protein_g ?? macros.protein_g,
                      carb_g: conduct.carb_g ?? macros.carb_g,
                      fat_g: conduct.fat_g ?? macros.fat_g,
                      meals_count: conduct.meals_count,
                      goal: conduct.goal,
                      preferences: conduct.preferences,
                      restrictions: conduct.restrictions,
                    },
                    foods.data ?? [],
                  );
                  const { rationale } = await describeMealPlan({
                    data: {
                      plan: JSON.stringify(generated.meals),
                      context: `${anamnesisText}\nObjetivo: ${conduct.goal ?? ""}\nFase: ${conduct.phase ?? ""}`,
                    },
                  });
                  setPlan({ plan: generated, rationale });
                  await db.saveConduct(id, conduct);
                  await db.saveMealPlan(id, generated, rationale);
                  const summary = await generateClinicalSummary({
                    data: { transcript: transcriptText, anamnesis: anamnesisText },
                  });
                  await db.updateConsultation(id, { clinical_summary: summary.summary, status: "finalizada" });
                })
              }
            >
              {busy === "plano" ? "Montando plano…" : "Gerar plano alimentar"}
            </Button>

            {plan ? (
              <div className="space-y-4">
                {plan.plan.meals.map((meal) => (
                  <div key={meal.slot} className="rounded-md border border-border">
                    <div className="flex items-center justify-between border-b border-border px-3 py-2 text-sm font-medium">
                      <span>{MEAL_SLOT_LABELS[meal.slot]}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">
                        {Math.round(meal.totals.kcal)} kcal
                      </span>
                    </div>
                    <ul className="divide-y divide-border text-sm">
                      {meal.items.map((item) => (
                        <li key={item.food_id} className="flex justify-between px-3 py-2">
                          <span>
                            {item.name}
                            <span className="ml-2 text-xs text-muted-foreground">
                              {item.grams} g · {item.household_measure}
                            </span>
                          </span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {Math.round(item.macros.kcal)} kcal
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
                <div className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 p-3 text-sm">
                  {plan.rationale}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </AppShell>
  );
}