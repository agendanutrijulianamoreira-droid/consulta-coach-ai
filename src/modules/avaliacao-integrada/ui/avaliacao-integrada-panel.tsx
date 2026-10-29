import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, ArrowLeft, Check, Loader2, Plus, RefreshCw, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import * as db from "@/lib/nutrios/repository";
import { ANAMNESIS_FIELDS } from "@/lib/nutrios/types";
import * as labDb from "@/modules/exames/infrastructure/labs-repository";
import { describeAiError } from "@/lib/nutrios/ai-error";
import {
  computeFontesReadiness,
  type FonteKey,
} from "@/modules/avaliacao-integrada/domain/fontes-readiness";
import * as avaliacaoDb from "@/modules/avaliacao-integrada/infrastructure/avaliacao-repository";
import {
  generateSintese,
  type SinteseResult,
} from "@/modules/avaliacao-integrada/application/sintese.functions";

type Props = {
  patientId: string;
  rows: db.Consultation[];
};

const EXAM_WINDOWS = [3, 6, 12] as const;
type ExamWindow = (typeof EXAM_WINDOWS)[number];

export function AvaliacaoIntegradaSection({ patientId, rows }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const history = useQuery({
    queryKey: ["avaliacao-integrada-history", patientId],
    queryFn: () => avaliacaoDb.listAvaliacaoHistory(patientId),
  });
  const create = useMutation({
    mutationFn: async () => {
      const attendance = rows.find((row) => row.record_kind === "attendance") ?? rows[0];
      const consultation =
        attendance ??
        (await db.createConsultation(
          patientId,
          new Date().toISOString().slice(0, 10),
          undefined,
          "module",
        ));
      await avaliacaoDb.createAvaliacao(consultation.id);
      return consultation.id;
    },
    onSuccess: async (id) => {
      setSelectedId(id);
      await queryClient.invalidateQueries({ queryKey: ["avaliacao-integrada-history", patientId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (selectedId) {
    return (
      <AvaliacaoEditor
        patientId={patientId}
        consultationId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Avaliação integrada</h2>
          <p className="text-sm text-muted-foreground">
            Reúne as fontes desta consulta (anamnese, transcrição, exames) e gera uma síntese
            preliminar para revisão.
          </p>
        </div>
        <Button type="button" onClick={() => create.mutate()} disabled={create.isPending}>
          {create.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Nova avaliação
        </Button>
      </div>

      <div className="divide-y divide-border rounded-lg border border-border">
        {(history.data ?? []).length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">Nenhuma avaliação integrada ainda.</p>
        ) : (
          history.data!.map((item) => (
            <button
              key={item.consultationId}
              type="button"
              onClick={() => setSelectedId(item.consultationId)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-muted/40"
            >
              <span>{formatConsultationDate(item.date)}</span>
              {item.status ? (
                <Badge variant={item.status === "aprovada" ? "default" : "outline"}>
                  {item.status === "aprovada" ? "Aprovada" : "Rascunho"}
                </Badge>
              ) : (
                <Badge variant="outline">Não iniciada</Badge>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

function formatConsultationDate(value: string): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}

const SOURCE_LABELS: Record<FonteKey, string> = {
  anamnese: "Anamnese",
  transcricao: "Transcrição da consulta",
  exames: "Exames",
  acompanhamento: "Acompanhamento via WhatsApp",
  fotos: "Evolução fotográfica",
};

const SINTESE_FIELD_LABELS: Record<keyof SinteseResult, string> = {
  emUmaFrase: "Em uma frase dela",
  quemEComoVive: "Quem é e como vive",
  queixaPrincipal: "Queixa principal",
  diagnosticosMedicamentos: "Diagnósticos e medicamentos informados",
  objetivo: "Objetivo",
};

function AvaliacaoEditor({
  patientId,
  consultationId,
  onBack,
}: {
  patientId: string;
  consultationId: string;
  onBack: () => void;
}) {
  const [tela, setTela] = useState<"fontes" | "sintese">("fontes");
  const [included, setIncluded] = useState<Set<FonteKey>>(new Set());
  const [examWindow, setExamWindow] = useState<ExamWindow>(6);
  const [instrucaoExtra, setInstrucaoExtra] = useState("");
  const [refazerInstrucao, setRefazerInstrucao] = useState("");
  const [showRefazer, setShowRefazer] = useState(false);
  const [finalText, setFinalText] = useState("");
  const [aiDraft, setAiDraft] = useState<SinteseResult | null>(null);
  const [matchedTerms, setMatchedTerms] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const queryClient = useQueryClient();
  const generate = useServerFn(generateSintese);

  const avaliacaoQuery = useQuery({
    queryKey: ["avaliacao-integrada", consultationId],
    queryFn: () => avaliacaoDb.getAvaliacao(consultationId),
  });
  const anamneseQuery = useQuery({
    queryKey: ["avaliacao-integrada-anamnese", consultationId],
    queryFn: () => db.getAnamnesis(consultationId),
  });
  const segmentsQuery = useQuery({
    queryKey: ["avaliacao-integrada-segments", consultationId],
    queryFn: () => db.listSegments(consultationId),
  });
  const examEvolutionQuery = useQuery({
    queryKey: ["avaliacao-integrada-exames-evolucao", patientId],
    queryFn: () => labDb.listPatientLabEvolution(patientId),
  });
  const telaSinteseQuery = useQuery({
    queryKey: ["avaliacao-integrada-tela", avaliacaoQuery.data?.id, "sintese"],
    queryFn: async () => {
      const telas = await avaliacaoDb.listTelas(avaliacaoQuery.data!.id);
      return telas.find((t) => t.tela === "sintese") ?? null;
    },
    enabled: !!avaliacaoQuery.data,
  });

  useEffect(() => {
    if (!telaSinteseQuery.data) return;
    const saved = telaSinteseQuery.data.final_text as { text?: string } | null;
    if (saved?.text) setFinalText(saved.text);
    const draft = telaSinteseQuery.data.ai_text as SinteseResult | null;
    if (draft?.emUmaFrase) setAiDraft(draft);
  }, [telaSinteseQuery.data]);

  const examesJanela = useMemo(() => {
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - examWindow);
    return (examEvolutionQuery.data ?? []).filter((point) => {
      const date = point.collection_date ?? point.consultation_date;
      return date && new Date(date) >= cutoff;
    });
  }, [examEvolutionQuery.data, examWindow]);

  const readiness = useMemo(
    () =>
      computeFontesReadiness({
        anamnesisFields: anamneseQuery.data ?? {},
        segments: segmentsQuery.data ?? [],
        labResults: examesJanela,
      }),
    [anamneseQuery.data, segmentsQuery.data, examesJanela],
  );

  useEffect(() => {
    const ready = new Set(readiness.filter((f) => f.implemented && f.ready).map((f) => f.key));
    setIncluded((current) => (current.size ? current : ready));
  }, [readiness]);

  const missingSources = useMemo(
    () => readiness.filter((f) => f.implemented && included.has(f.key) && !f.ready),
    [readiness, included],
  );

  const createAvaliacao = useMutation({
    mutationFn: () => avaliacaoDb.createAvaliacao(consultationId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["avaliacao-integrada", consultationId] }),
    onError: (error: Error) => toast.error(error.message),
  });

  const saveTela = useMutation({
    mutationFn: (patch: Parameters<typeof avaliacaoDb.saveTela>[2]) =>
      avaliacaoDb.saveTela(avaliacaoQuery.data!.id, "sintese", patch),
    onSuccess: () => {
      toast.success("Síntese salva.");
      void queryClient.invalidateQueries({
        queryKey: ["avaliacao-integrada-tela", avaliacaoQuery.data?.id, "sintese"],
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function toggleSource(key: FonteKey) {
    setIncluded((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function buildSourcesText(): string {
    const blocks: string[] = [];
    if (included.has("anamnese")) {
      const fields = anamneseQuery.data ?? {};
      const lines = ANAMNESIS_FIELDS.map((f) => {
        const field = fields[f.key];
        return field?.value?.trim() ? `${f.label}: ${field.value.trim()}` : null;
      }).filter((line): line is string => !!line);
      if (lines.length) blocks.push(`ANAMNESE:\n${lines.join("\n")}`);
    }
    if (included.has("transcricao")) {
      const segments = segmentsQuery.data ?? [];
      if (segments.length) {
        blocks.push(
          `TRANSCRIÇÃO DA CONSULTA (marca de tempo entre colchetes):\n${segments
            .map((s) => `[${formatMinuto(s.offset_seconds)}] ${s.speaker}: ${s.content}`)
            .join("\n")}`,
        );
      }
    }
    if (included.has("exames")) {
      if (examesJanela.length) {
        blocks.push(
          `EXAMES (últimos ${examWindow} meses):\n${examesJanela
            .map((r) =>
              `${r.analyte_name}: ${r.value} ${r.unit ?? ""} (coletado em ${formatConsultationDate(r.collection_date ?? r.consultation_date)})`.trim(),
            )
            .join("\n")}`,
        );
      }
    }
    return blocks.join("\n\n");
  }

  async function handleGenerate(instrucao?: string) {
    const sourcesText = buildSourcesText();
    if (!sourcesText.trim()) {
      toast.error("Selecione ao menos uma fonte com conteúdo antes de gerar a síntese.");
      return;
    }
    setGenerating(true);
    setMatchedTerms([]);
    try {
      const result = await generate({
        data: {
          sourcesText,
          instrucaoExtra: (instrucao ?? instrucaoExtra.trim()) || undefined,
        },
      });
      if (result.blocked) {
        setMatchedTerms(result.matchedTerms);
        setAiDraft(null);
        return;
      }
      setAiDraft(result.sintese);
      if (result.sintese) setFinalText(formatSinteseAsText(result.sintese));
      await saveTela.mutateAsync({
        ai_text: result.sintese,
        sources: [...included],
        status: "revisao",
      });
      setShowRefazer(false);
      setRefazerInstrucao("");
    } catch (error) {
      toast.error(describeAiError(error, "Preencha a síntese manualmente enquanto isso."));
    } finally {
      setGenerating(false);
    }
  }

  if (!avaliacaoQuery.data && !avaliacaoQuery.isLoading) {
    return (
      <div className="mx-auto max-w-2xl space-y-4 p-6 text-center">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft /> Voltar
        </Button>
        <p className="text-sm text-muted-foreground">
          Esta consulta ainda não tem uma avaliação integrada.
        </p>
        <Button
          type="button"
          onClick={() => createAvaliacao.mutate()}
          disabled={createAvaliacao.isPending}
        >
          {createAvaliacao.isPending ? <Loader2 className="animate-spin" /> : <Plus />} Iniciar
          avaliação integrada
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <div className="flex items-center justify-between">
        <Button type="button" variant="ghost" onClick={onBack}>
          <ArrowLeft /> Voltar
        </Button>
        <div className="flex gap-1 rounded-lg bg-muted p-1 text-sm">
          <button
            type="button"
            onClick={() => setTela("fontes")}
            className={`rounded-md px-3 py-1.5 ${tela === "fontes" ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
          >
            1. Fontes
          </button>
          <button
            type="button"
            onClick={() => setTela("sintese")}
            className={`rounded-md px-3 py-1.5 ${tela === "sintese" ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
          >
            2. Síntese
          </button>
        </div>
      </div>

      {tela === "fontes" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Selecione quais fontes entram na síntese desta avaliação. Fontes sem dados ainda ficam
            desmarcadas por padrão.
          </p>
          {readiness.map((fonte) => (
            <label
              key={fonte.key}
              className={`flex items-start gap-3 rounded-lg border border-border p-3 text-sm ${fonte.implemented ? "" : "opacity-60"}`}
            >
              <input
                type="checkbox"
                className="mt-1"
                disabled={!fonte.implemented}
                checked={included.has(fonte.key)}
                onChange={() => toggleSource(fonte.key)}
              />
              <span className="flex-1">
                <span className="flex items-center gap-2 font-medium">
                  {SOURCE_LABELS[fonte.key]}
                  {fonte.ready && fonte.implemented ? (
                    <Check className="size-4 text-emerald-600" />
                  ) : null}
                </span>
                <span className="text-xs text-muted-foreground">{fonte.detail}</span>
                {fonte.key === "exames" && fonte.implemented ? (
                  <span className="mt-2 flex items-center gap-2 text-xs">
                    Janela:
                    {EXAM_WINDOWS.map((months) => (
                      <button
                        key={months}
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setExamWindow(months);
                        }}
                        className={`rounded-full border px-2 py-0.5 ${examWindow === months ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground"}`}
                      >
                        {months} meses
                      </button>
                    ))}
                  </span>
                ) : null}
              </span>
            </label>
          ))}

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">
              Instrução extra para a IA (opcional)
            </label>
            <Input
              value={instrucaoExtra}
              onChange={(e) => setInstrucaoExtra(e.target.value)}
              placeholder="Ex.: priorizar intestino"
            />
          </div>

          {missingSources.length > 0 ? (
            <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
              Faltam dados em: {missingSources.map((f) => SOURCE_LABELS[f.key]).join(", ")}. Posso
              gerar mesmo assim; esses pontos aparecem como "sem dado" e não entram na síntese.
            </div>
          ) : null}

          <div className="flex justify-end">
            <Button type="button" onClick={() => setTela("sintese")}>
              Continuar para Síntese
            </Button>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {matchedTerms.length > 0 ? (
            <div className="flex items-start gap-3 rounded-lg border border-warm/30 bg-warm/10 p-3 text-sm text-warm">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Sinais de alerta identificados nas fontes selecionadas:{" "}
                <strong>{matchedTerms.join(", ")}</strong>. A geração automática foi interrompida —
                revise a situação clínica antes de continuar.
              </span>
            </div>
          ) : null}

          <Button type="button" onClick={() => void handleGenerate()} disabled={generating}>
            {generating ? <Loader2 className="animate-spin" /> : <Sparkles />} Gerar rascunho da
            síntese
          </Button>

          {aiDraft ? (
            <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <p className="font-medium">Rascunho gerado pela IA (revisar antes de usar):</p>
              <dl className="space-y-2">
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">
                    {SINTESE_FIELD_LABELS.emUmaFrase}
                  </dt>
                  <dd className="italic">"{aiDraft.emUmaFrase}"</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">
                    {SINTESE_FIELD_LABELS.quemEComoVive}
                  </dt>
                  <dd>{aiDraft.quemEComoVive}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">
                    {SINTESE_FIELD_LABELS.queixaPrincipal}
                  </dt>
                  <dd>{aiDraft.queixaPrincipal}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">
                    {SINTESE_FIELD_LABELS.diagnosticosMedicamentos}
                  </dt>
                  <dd>
                    {aiDraft.diagnosticosMedicamentos.length
                      ? aiDraft.diagnosticosMedicamentos.join(", ")
                      : "sem dado"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted-foreground">
                    {SINTESE_FIELD_LABELS.objetivo}
                  </dt>
                  <dd>{aiDraft.objetivo}</dd>
                </div>
              </dl>

              {showRefazer ? (
                <div className="space-y-2 border-t border-border pt-3">
                  <Input
                    value={refazerInstrucao}
                    onChange={(e) => setRefazerInstrucao(e.target.value)}
                    placeholder="Ex.: focar mais no sono e menos na alimentação"
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={generating || !refazerInstrucao.trim()}
                    onClick={() => void handleGenerate(refazerInstrucao.trim())}
                  >
                    <RefreshCw /> Gerar com esta instrução
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setShowRefazer(true)}
                >
                  <RefreshCw /> Refazer com esta instrução
                </Button>
              )}
            </div>
          ) : null}

          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">Texto final revisado</label>
            <Textarea
              rows={10}
              value={finalText}
              onChange={(e) => setFinalText(e.target.value)}
              placeholder="Edite o rascunho ou escreva a síntese final aqui antes de salvar."
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saveTela.isPending}
              onClick={() =>
                saveTela.mutate({
                  final_text: { text: finalText },
                  sources: [...included],
                  status: "revisao",
                })
              }
            >
              Editar e salvar rascunho
            </Button>
            <Button
              type="button"
              disabled={saveTela.isPending || !finalText.trim()}
              onClick={() =>
                saveTela.mutate({
                  final_text: { text: finalText },
                  sources: [...included],
                  status: "aprovada",
                })
              }
            >
              Aceitar síntese
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function formatSinteseAsText(sintese: SinteseResult): string {
  return [
    `${SINTESE_FIELD_LABELS.emUmaFrase}: "${sintese.emUmaFrase}"`,
    `${SINTESE_FIELD_LABELS.quemEComoVive}: ${sintese.quemEComoVive}`,
    `${SINTESE_FIELD_LABELS.queixaPrincipal}: ${sintese.queixaPrincipal}`,
    `${SINTESE_FIELD_LABELS.diagnosticosMedicamentos}: ${sintese.diagnosticosMedicamentos.join(", ") || "sem dado"}`,
    `${SINTESE_FIELD_LABELS.objetivo}: ${sintese.objetivo}`,
  ].join("\n\n");
}

function formatMinuto(offsetSeconds: number): string {
  const minutes = Math.floor(offsetSeconds / 60);
  const seconds = Math.floor(offsetSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}
