import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  FileText,
  Plus,
  Printer,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import * as db from "@/lib/nutrios/repository";
import * as labDb from "@/modules/exames/infrastructure/labs-repository";
import {
  buildReviewableSynthesis,
  convertSpanToCm,
  getDomainStatus,
  type DomainPoint,
  type MetabolicDomain,
  type MetabolicSource,
  type ReviewStatus,
  validateEnergyMeasurement,
  validateGrip,
} from "@/modules/metabolico/domain/metabolic-map";
import * as mapDb from "@/modules/metabolico/infrastructure/metabolic-map-repository";

type Props = {
  patientId: string;
  rows: db.Consultation[];
  onOpenConsultation?: (id: string) => void;
};
const DOMAIN_LABELS: Record<MetabolicDomain, string> = {
  contexto_clinico: "Contexto clínico",
  saude_da_mulher: "Saúde da mulher",
  antropometria: "Antropometria",
  capacidade_fisica: "Capacidade física",
  energia: "Energia",
  exames: "Exames",
  genetica: "Genética",
  rotina: "Rotina",
};
const SOURCE_LABELS: Record<MetabolicSource, string> = {
  manual: "Manual",
  informed: "Informado",
  ai_extracted: "Extraído por IA",
  calculated: "Calculado",
  measured: "Medido",
  imported: "Importado",
};

export function MetabolicMapSection({ patientId, rows }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const history = useQuery({
    queryKey: ["metabolic-history", patientId],
    queryFn: () => mapDb.listMetabolicHistory(patientId),
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
      await mapDb.createMetabolicAssessment(consultation.id);
      return consultation.id;
    },
    onSuccess: async (id) => {
      setSelectedId(id);
      await queryClient.invalidateQueries({ queryKey: ["metabolic-history", patientId] });
    },
    onError: (error: Error) => toast.error(error.message),
  });
  if (selectedId)
    return (
      <MetabolicEditor
        patientId={patientId}
        consultationId={selectedId}
        onBack={() => setSelectedId(null)}
      />
    );
  return (
    <MapOverview
      history={history.data ?? []}
      rows={rows}
      creating={create.isPending}
      onCreate={() => create.mutate()}
      onOpen={setSelectedId}
    />
  );
}

function MapOverview({
  history,
  rows,
  creating,
  onCreate,
  onOpen,
}: {
  history: mapDb.MetabolicHistoryRow[];
  rows: db.Consultation[];
  creating: boolean;
  onCreate: () => void;
  onOpen: (id: string) => void;
}) {
  const latest = history.at(-1);
  return (
    <div className="mx-auto max-w-6xl px-6 py-7 lg:px-10 lg:py-9">
      <header className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            Avaliação longitudinal
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Mapa Metabólico 360°</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Consolide contexto, medidas, energia, exames e rotina sem criar um score único. Cada
            fonte mantém data, método e revisão profissional.
          </p>
        </div>
        <Button size="sm" onClick={onCreate} disabled={creating}>
          <Plus /> {creating ? "Abrindo…" : "Abrir avaliação"}
        </Button>
      </header>
      <div className="mt-6 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
        <div className="flex gap-2 font-medium">
          <ShieldCheck className="size-4 text-primary" /> Copiloto clínico
        </div>
        <p className="mt-1 text-muted-foreground">
          Sugestões e dados extraídos por IA ficam pendentes até confirmação. O mapa não
          diagnostica, não prescreve e não interpreta variante genética isoladamente.
        </p>
      </div>
      {latest ? (
        <div className="mt-6 grid gap-3 sm:grid-cols-4">
          <Metric label="Última avaliação" value={formatDate(latest.date)} />
          <Metric label="Peso atual" value={displayValue(latest.anthropometry["peso"], "kg")} />
          <Metric
            label="Energia registrada"
            value={latest.energyKcal ? `${latest.energyKcal} kcal/dia` : "—"}
          />
          <Metric label="Exames confirmados" value={String(latest.labCount)} />
        </div>
      ) : null}
      {history.length ? (
        <div className="mt-8 overflow-x-auto">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted-foreground">
                <th className="py-2 pr-3">Data</th>
                <th className="py-2 pr-3">Peso</th>
                <th className="py-2 pr-3">Energia</th>
                <th className="py-2 pr-3">Exames</th>
                <th className="py-2 pr-3">Mapa</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history
                .slice()
                .reverse()
                .map((entry) => (
                  <tr key={entry.consultationId}>
                    <td className="py-3 pr-3">{formatDate(entry.date)}</td>
                    <td className="py-3 pr-3">{displayValue(entry.anthropometry["peso"], "kg")}</td>
                    <td className="py-3 pr-3">
                      {entry.energyKcal ? `${entry.energyKcal} kcal/dia` : "—"}
                    </td>
                    <td className="py-3 pr-3">{entry.labCount || "—"}</td>
                    <td className="py-3 pr-3">
                      <Badge variant={entry.mapStatus === "approved" ? "secondary" : "outline"}>
                        {entry.mapStatus === "approved"
                          ? "Aprovado"
                          : entry.mapStatus
                            ? "Em revisão"
                            : "Não iniciado"}
                      </Badge>
                    </td>
                    <td className="py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onOpen(entry.consultationId)}
                      >
                        Abrir
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState onCreate={onCreate} creating={creating} />
      )}
      {!history.length && rows.length ? (
        <p className="mt-4 text-xs text-muted-foreground">
          As consultas existentes permanecem como fontes de dados; abra uma avaliação para
          consolidá-las.
        </p>
      ) : null}
    </div>
  );
}

function MetabolicEditor({
  patientId,
  consultationId,
  onBack,
}: {
  patientId: string;
  consultationId: string;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const map = useQuery({
    queryKey: ["metabolic-map", consultationId],
    queryFn: async () => mapDb.getMetabolicAssessment(consultationId),
  });
  const consultation = useQuery({
    queryKey: ["consultation", consultationId],
    queryFn: () => db.getConsultation(consultationId),
  });
  const anthro = useQuery({
    queryKey: ["anthro", consultationId],
    queryFn: () => db.getAnthropometry(consultationId),
  });
  const anamnesis = useQuery({
    queryKey: ["anamnesis", consultationId],
    queryFn: () => db.getAnamnesis(consultationId),
  });
  const conduct = useQuery({
    queryKey: ["conduct", consultationId],
    queryFn: () => db.getConduct(consultationId),
  });
  const labs = useQuery({
    queryKey: ["lab-results", consultationId],
    queryFn: () => labDb.listLabResults(consultationId),
  });
  const initializing = useRef(false);
  const [context, setContext] = useState({
    domain: "contexto_clinico" as MetabolicDomain,
    label: "Objetivo",
    value: "",
    source_kind: "manual" as MetabolicSource,
    review_status: "confirmed" as ReviewStatus,
  });
  const [capacity, setCapacity] = useState({
    right: "",
    left: "",
    protocol: "",
    date: "",
    span: "",
    spanUnit: "cm" as "cm" | "m" | "in",
    spanMethod: "",
    purpose: "",
    notes: "",
  });
  const [energy, setEnergy] = useState({
    kind: "measured" as "estimated" | "measured",
    kcal: "",
    formula: "",
    equipment: "",
    conditions: "",
    date: "",
  });
  const [genetic, setGenetic] = useState({
    file: "",
    fileObject: null as File | null,
    reference: "",
    laboratory: "",
    date: "",
    variant: "",
    result: "",
    evidence: "",
    source: "",
    notes: "",
  });
  const [clinicalSummary, setClinicalSummary] = useState("");
  const [patientSummary, setPatientSummary] = useState("");
  const assessment = map.data;
  useEffect(() => {
    if (map.isLoading || map.isError || map.data || initializing.current) return;
    initializing.current = true;
    void mapDb
      .createMetabolicAssessment(consultationId)
      .then(() => queryClient.invalidateQueries({ queryKey: ["metabolic-map", consultationId] }))
      .catch((error: Error) => toast.error(error.message));
  }, [consultationId, map.data, map.isError, map.isLoading, queryClient]);
  useEffect(() => {
    if (!assessment) return;
    setClinicalSummary((current) => current || assessment.clinical_summary || "");
    setPatientSummary((current) => current || assessment.patient_summary || "");
  }, [assessment]);
  useEffect(() => {
    const stored = assessment?.capacity;
    if (!stored) return;
    setCapacity((current) => {
      const hasDraft = [
        current.right,
        current.left,
        current.protocol,
        current.date,
        current.span,
        current.spanMethod,
        current.purpose,
        current.notes,
      ].some(Boolean);
      if (hasDraft) return current;
      return {
        right: stored.right_grip_kgf == null ? "" : String(stored.right_grip_kgf),
        left: stored.left_grip_kgf == null ? "" : String(stored.left_grip_kgf),
        protocol: stored.grip_protocol ?? "",
        date: stored.grip_measured_at ?? "",
        span: stored.span_value == null ? "" : String(stored.span_value),
        spanUnit: stored.span_unit ?? "cm",
        spanMethod: stored.span_method ?? "",
        purpose: stored.span_purpose ?? "",
        notes: stored.notes ?? "",
      };
    });
  }, [assessment]);
  useEffect(() => {
    if (!assessment || (!clinicalSummary && !patientSummary)) return;
    const timer = window.setTimeout(
      () =>
        void mapDb.saveMetabolicAssessment(consultationId, {
          review_status: "in_review",
          clinical_summary: clinicalSummary,
          patient_summary: patientSummary,
        }),
      700,
    );
    return () => window.clearTimeout(timer);
  }, [assessment, clinicalSummary, consultationId, patientSummary]);
  const save = async (operation: () => Promise<void>, message: string) => {
    try {
      await operation();
      await queryClient.invalidateQueries({ queryKey: ["metabolic-map", consultationId] });
      await queryClient.invalidateQueries({ queryKey: ["metabolic-history", patientId] });
      toast.success(message);
    } catch (error) {
      toast.error((error as Error).message);
    }
  };
  const sourcePoints = useMemo(
    () => ({
      contexto_clinico: [
        {
          present: Boolean(
            assessment?.context.some((entry) => entry.domain === "contexto_clinico"),
          ),
        },
        { present: Boolean(consultation.data?.patients?.notes) },
        {
          present: Object.values(anamnesis.data ?? {}).some(
            (field) => Boolean(field?.value) && field.status !== "recusado",
          ),
        },
      ],
      saude_da_mulher: [
        {
          present: Boolean(assessment?.context.some((entry) => entry.domain === "saude_da_mulher")),
        },
      ],
      antropometria: [
        {
          present: Object.keys(anthro.data?.data ?? {}).length > 0,
          updatedAt: consultation.data?.consultation_date ?? null,
        },
      ],
      capacidade_fisica: [
        {
          present: Boolean(
            assessment?.capacity &&
            (assessment.capacity.right_grip_kgf ||
              assessment.capacity.left_grip_kgf ||
              assessment.capacity.span_value),
          ),
        },
      ],
      energia: [
        {
          present: Boolean(
            assessment?.energy.length ||
            (conduct.data?.energy && Object.keys(conduct.data.energy).length),
          ),
        },
      ],
      exames: [{ present: Boolean(labs.data?.length) }],
      genetica: [{ present: Boolean(assessment?.genetics.length) }],
      rotina: [
        { present: Boolean(assessment?.context.some((entry) => entry.domain === "rotina")) },
      ],
    }),
    [
      anthro.data?.data,
      anamnesis.data,
      assessment,
      consultation.data?.consultation_date,
      consultation.data?.patients?.notes,
      conduct.data?.energy,
      labs.data?.length,
    ],
  );
  const statuses = Object.keys(DOMAIN_LABELS).map(
    (key) =>
      [key as MetabolicDomain, getDomainStatus(sourcePoints[key as MetabolicDomain])] as const,
  );
  const addContext = () => {
    if (!assessment || !context.value.trim()) return;
    void save(async () => {
      await mapDb.upsertMetabolicContext(assessment.id, {
        ...context,
        value: context.value.trim(),
      });
    }, "Dado contextual salvo.");
  };
  const saveCapacity = () => {
    if (!assessment) return;
    const right = numberOrNull(capacity.right);
    const left = numberOrNull(capacity.left);
    const issue = validateGrip(right) ?? validateGrip(left);
    if (issue) {
      toast.error(issue);
      return;
    }
    void save(
      () =>
        mapDb.saveMetabolicCapacity(assessment.id, {
          right_grip_kgf: right,
          left_grip_kgf: left,
          grip_protocol: capacity.protocol || null,
          grip_measured_at: capacity.date || null,
          span_value: numberOrNull(capacity.span),
          span_unit: capacity.spanUnit,
          span_method: capacity.spanMethod || null,
          span_purpose: capacity.purpose || null,
          notes: capacity.notes || null,
          source_kind: "measured",
          review_status: "confirmed",
        }),
      "Capacidade física salva.",
    );
  };
  const addEnergy = () => {
    if (!assessment) return;
    const kcal = numberOrNull(energy.kcal);
    const issues = validateEnergyMeasurement({
      kind: energy.kind,
      kcal,
      formula: energy.formula,
      equipment: energy.equipment,
      conditions: energy.conditions,
    });
    if (issues.length) {
      toast.error(issues[0]);
      return;
    }
    void save(
      () =>
        mapDb.addMetabolicEnergy(assessment.id, {
          measurement_kind: energy.kind,
          kcal: kcal!,
          unit: "kcal/dia",
          formula: energy.formula || null,
          equipment: energy.equipment || null,
          conditions: energy.conditions || null,
          measured_at: energy.date || null,
          source_kind: energy.kind === "measured" ? "measured" : "calculated",
          review_status: "confirmed",
          evidence_source:
            energy.kind === "estimated" ? "Cálculo energético existente" : "Registro profissional",
          inputs: conduct.data?.energy ?? {},
        }),
      "Energia registrada.",
    );
  };
  const addGenetic = async () => {
    if (!assessment || !genetic.variant.trim()) return;
    try {
      const reportReference = genetic.fileObject
        ? await mapDb.uploadGeneticReport(assessment.id, genetic.fileObject)
        : genetic.reference || null;
      await save(
        () =>
          mapDb.addMetabolicGenetic(assessment.id, {
            report_file_name: genetic.file || null,
            report_reference: reportReference,
            laboratory: genetic.laboratory || null,
            test_date: genetic.date || null,
            variant: genetic.variant,
            result_genotype: genetic.result || null,
            evidence_level: genetic.evidence || null,
            source: genetic.source || null,
            review_status: "pending",
            notes: genetic.notes || null,
          }),
        "Laudo genético registrado como pendente de revisão.",
      );
    } catch (error) {
      toast.error((error as Error).message);
    }
  };
  const saveSummary = () => {
    void save(
      () =>
        mapDb.saveMetabolicAssessment(consultationId, {
          review_status: "in_review",
          clinical_summary: clinicalSummary,
          patient_summary: patientSummary,
        }),
      "Mapa salvo para revisão.",
    );
  };
  const synthesis = buildReviewableSynthesis({
    priorities: [
      assessment?.context.find((entry) => entry.label.toLowerCase().includes("objetivo"))?.value ??
        "Revisar dados pendentes",
    ],
    approaches: ["Definir abordagem após revisão dos dados e preferências"],
    discussWithDoctor: ["Itens clínicos que exigirem avaliação médica"],
    evidence: ["Fontes exibidas por domínio no prontuário"],
  });
  if (map.isLoading) return <p className="p-8 text-sm text-muted-foreground">Carregando mapa…</p>;
  if (map.isError)
    return <p className="p-8 text-sm text-destructive">Não foi possível carregar o mapa.</p>;
  return (
    <div className="mx-auto max-w-6xl px-6 py-7 lg:px-10 lg:py-9">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-5">
        <div>
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft /> Voltar aos mapas
          </Button>
          <h2 className="mt-3 text-xl font-semibold">Mapa Metabólico 360°</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {consultation.data?.patients?.name ?? "Paciente"} ·{" "}
            {formatDate(consultation.data?.consultation_date)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer /> Relatório imprimível
          </Button>
          <Button size="sm" onClick={saveSummary}>
            <Save /> Salvar revisão
          </Button>
        </div>
      </div>
      <div className="mt-6 grid gap-2 sm:grid-cols-4 lg:grid-cols-8">
        {statuses.map(([domain, status]) => (
          <div key={domain} className="rounded-md border border-border p-3">
            <div className="text-xs font-medium">{DOMAIN_LABELS[domain]}</div>
            <Badge
              className="mt-2"
              variant={status.status === "complete" ? "secondary" : "outline"}
            >
              {status.label}
            </Badge>
            {status.pendingReview ? (
              <p className="mt-1 text-[11px] text-amber-700">{status.pendingReview} pendente</p>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-7 grid gap-6 lg:grid-cols-2 print:block">
        <Panel
          title="Contexto clínico, saúde da mulher e rotina"
          description="Registro manual ou informado; itens de IA devem permanecer pendentes até confirmação."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              aria-label="Domínio"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={context.domain}
              onChange={(e) =>
                setContext({ ...context, domain: e.target.value as MetabolicDomain })
              }
            >
              {["contexto_clinico", "saude_da_mulher", "rotina"].map((domain) => (
                <option key={domain} value={domain}>
                  {DOMAIN_LABELS[domain as MetabolicDomain]}
                </option>
              ))}
            </select>
            <Input
              placeholder="Campo (ex.: Objetivo)"
              value={context.label}
              onChange={(e) => setContext({ ...context, label: e.target.value })}
            />
          </div>
          <Textarea
            className="mt-2"
            placeholder="Valor, sintomas, medicamentos, sono, estresse, alimentação…"
            value={context.value}
            onChange={(e) => setContext({ ...context, value: e.target.value })}
          />
          <div className="mt-2 flex gap-2">
            <select
              aria-label="Origem do dado"
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
              value={context.source_kind}
              onChange={(e) =>
                setContext({
                  ...context,
                  source_kind: e.target.value as MetabolicSource,
                  review_status: e.target.value === "ai_extracted" ? "pending" : "confirmed",
                })
              }
            >
              {Object.entries(SOURCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <Button size="sm" onClick={addContext} disabled={!context.value.trim()}>
              <Plus /> Adicionar
            </Button>
          </div>
          <div className="mt-4 space-y-2">
            {assessment?.context.map((entry) => (
              <ReviewRow
                key={entry.id}
                label={entry.label}
                value={entry.value}
                source={entry.source_kind}
                status={entry.review_status}
                onAccept={() =>
                  void save(
                    () => mapDb.updateMetabolicContextReview(entry.id, "confirmed"),
                    "Sugestão confirmada.",
                  )
                }
                onReject={() =>
                  void save(
                    () => mapDb.updateMetabolicContextReview(entry.id, "rejected"),
                    "Sugestão rejeitada.",
                  )
                }
                onDelete={() =>
                  void save(() => mapDb.deleteMetabolicContext(entry.id), "Registro removido.")
                }
              />
            ))}
          </div>
        </Panel>
        <Panel
          title="Capacidade física"
          description="Preensão em kgf e envergadura preservam protocolo, unidade, método e finalidade."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <Input
              type="number"
              min="0"
              placeholder="Preensão direita (kgf)"
              value={capacity.right}
              onChange={(e) => setCapacity({ ...capacity, right: e.target.value })}
            />
            <Input
              type="number"
              min="0"
              placeholder="Preensão esquerda (kgf)"
              value={capacity.left}
              onChange={(e) => setCapacity({ ...capacity, left: e.target.value })}
            />
          </div>
          <Input
            className="mt-2"
            placeholder="Protocolo de preensão"
            value={capacity.protocol}
            onChange={(e) => setCapacity({ ...capacity, protocol: e.target.value })}
          />
          <Input
            className="mt-2"
            type="date"
            aria-label="Data da preensão"
            value={capacity.date}
            onChange={(e) => setCapacity({ ...capacity, date: e.target.value })}
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_90px]">
            <Input
              type="number"
              min="0"
              placeholder="Envergadura"
              value={capacity.span}
              onChange={(e) => setCapacity({ ...capacity, span: e.target.value })}
            />
            <select
              aria-label="Unidade da envergadura"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={capacity.spanUnit}
              onChange={(e) =>
                setCapacity({ ...capacity, spanUnit: e.target.value as "cm" | "m" | "in" })
              }
            >
              <option value="cm">cm</option>
              <option value="m">m</option>
              <option value="in">pol</option>
            </select>
          </div>
          <Input
            className="mt-2"
            placeholder="Método da envergadura"
            value={capacity.spanMethod}
            onChange={(e) => setCapacity({ ...capacity, spanMethod: e.target.value })}
          />
          <Input
            className="mt-2"
            placeholder="Finalidade"
            value={capacity.purpose}
            onChange={(e) => setCapacity({ ...capacity, purpose: e.target.value })}
          />
          <Textarea
            className="mt-2"
            placeholder="Observações"
            value={capacity.notes}
            onChange={(e) => setCapacity({ ...capacity, notes: e.target.value })}
          />
          <Button className="mt-2" size="sm" onClick={saveCapacity}>
            <Save /> Salvar medidas
          </Button>
          {assessment?.capacity?.span_value ? (
            <p className="text-xs text-muted-foreground">
              Envergadura registrada:{" "}
              {convertSpanToCm(
                assessment.capacity.span_value,
                assessment.capacity.span_unit ?? "cm",
              )}{" "}
              cm (conversão apenas para comparação).
            </p>
          ) : null}
        </Panel>
        <Panel
          title="Energia"
          description="Estimativas usam a fórmula existente; calorimetria medida exige equipamento e condições do teste."
        >
          <div className="grid gap-2 sm:grid-cols-2">
            <select
              aria-label="Tipo de energia"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={energy.kind}
              onChange={(e) =>
                setEnergy({ ...energy, kind: e.target.value as "estimated" | "measured" })
              }
            >
              <option value="measured">Medido por equipamento</option>
              <option value="estimated">Estimado por equação</option>
            </select>
            <Input
              type="number"
              min="1"
              placeholder="kcal/dia"
              value={energy.kcal}
              onChange={(e) => setEnergy({ ...energy, kcal: e.target.value })}
            />
          </div>
          <Input
            className="mt-2"
            placeholder="Fórmula (estimado)"
            value={energy.formula}
            onChange={(e) => setEnergy({ ...energy, formula: e.target.value })}
          />
          <Input
            className="mt-2"
            placeholder="Equipamento (medido)"
            value={energy.equipment}
            onChange={(e) => setEnergy({ ...energy, equipment: e.target.value })}
          />
          <Input
            className="mt-2"
            placeholder="Condições do teste"
            value={energy.conditions}
            onChange={(e) => setEnergy({ ...energy, conditions: e.target.value })}
          />
          <Input
            className="mt-2"
            type="date"
            aria-label="Data da energia"
            value={energy.date}
            onChange={(e) => setEnergy({ ...energy, date: e.target.value })}
          />
          <Button className="mt-2" size="sm" onClick={addEnergy}>
            <Plus /> Registrar energia
          </Button>
          <div className="mt-4 space-y-2">
            {assessment?.energy.map((item) => (
              <div key={item.id} className="rounded-md border border-border p-3 text-sm">
                <div className="flex justify-between gap-2 font-medium">
                  <span>
                    {item.measurement_kind === "measured"
                      ? "Medido por equipamento"
                      : "Estimado por equação"}
                  </span>
                  <span>
                    {item.kcal} {item.unit}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {[item.formula, item.equipment, item.conditions, item.measured_at]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            ))}
          </div>
        </Panel>
        <Panel
          title="Genética"
          description="Laudo e evidência ficam explícitos. Nenhuma conduta é inferida da variante isoladamente."
        >
          <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
            <label className="flex cursor-pointer items-center gap-2 font-medium text-foreground">
              <FileText className="size-4" /> Selecionar laudo
              <input
                type="file"
                className="sr-only"
                accept="application/pdf,image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setGenetic({ ...genetic, file: file?.name ?? "", fileObject: file });
                }}
              />
            </label>
            <p className="mt-1">
              O laudo será armazenado em bucket privado e vinculado a esta avaliação; a referência e
              o nome permanecem visíveis para auditoria profissional.
            </p>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <Input
              placeholder="Laboratório"
              value={genetic.laboratory}
              onChange={(e) => setGenetic({ ...genetic, laboratory: e.target.value })}
            />
            <Input
              type="date"
              aria-label="Data do teste"
              value={genetic.date}
              onChange={(e) => setGenetic({ ...genetic, date: e.target.value })}
            />
            <Input
              placeholder="Variante"
              value={genetic.variant}
              onChange={(e) => setGenetic({ ...genetic, variant: e.target.value })}
            />
            <Input
              placeholder="Resultado / genótipo"
              value={genetic.result}
              onChange={(e) => setGenetic({ ...genetic, result: e.target.value })}
            />
            <Input
              placeholder="Nível de evidência"
              value={genetic.evidence}
              onChange={(e) => setGenetic({ ...genetic, evidence: e.target.value })}
            />
            <Input
              placeholder="Fonte / DOI / diretriz"
              value={genetic.source}
              onChange={(e) => setGenetic({ ...genetic, source: e.target.value })}
            />
          </div>
          <Input
            className="mt-2"
            placeholder="Referência do laudo"
            value={genetic.reference}
            onChange={(e) => setGenetic({ ...genetic, reference: e.target.value })}
          />
          <Textarea
            className="mt-2"
            placeholder="Limitações e observações"
            value={genetic.notes}
            onChange={(e) => setGenetic({ ...genetic, notes: e.target.value })}
          />
          <Button
            className="mt-2"
            size="sm"
            onClick={addGenetic}
            disabled={!genetic.variant.trim()}
          >
            <Plus /> Registrar laudo
          </Button>
          <div className="mt-4 space-y-2">
            {assessment?.genetics.map((item) => (
              <ReviewRow
                key={item.id}
                label={item.variant ?? "Variante"}
                value={[item.result_genotype, item.evidence_level, item.source]
                  .filter(Boolean)
                  .join(" · ")}
                source={item.report_file_name ? `Laudo: ${item.report_file_name}` : "Manual"}
                status={item.review_status}
                onAccept={() =>
                  void save(
                    () => mapDb.updateGeneticReview(item.id, "confirmed"),
                    "Laudo confirmado.",
                  )
                }
                onReject={() =>
                  void save(
                    () => mapDb.updateGeneticReview(item.id, "rejected"),
                    "Laudo rejeitado.",
                  )
                }
              />
            ))}
          </div>
        </Panel>
        <Panel title="Síntese revisável" description={synthesis.disclaimer}>
          <Textarea
            className="min-h-32"
            placeholder="Prioridades nutricionais, opções de abordagem e itens para discutir com médico…"
            value={
              clinicalSummary ||
              synthesis.priorities.map((item) => `Prioridade: ${item.value}`).join("\n")
            }
            onChange={(e) => setClinicalSummary(e.target.value)}
          />
          <Textarea
            className="mt-2 min-h-28"
            placeholder="Versão em linguagem simples para o paciente"
            value={patientSummary}
            onChange={(e) => setPatientSummary(e.target.value)}
          />
          <p className="mt-3 text-xs text-muted-foreground">
            Fontes usadas: anamnese{" "}
            {Object.keys(anamnesis.data ?? {}).length ? "disponível" : "pendente"}, antropometria{" "}
            {Object.keys(anthro.data?.data ?? {}).length ? "disponível" : "pendente"}, energia{" "}
            {conduct.data?.energy ? "cálculo existente" : "pendente"}, exames{" "}
            {labs.data?.length ?? 0} resultado(s) confirmado(s).
          </p>
        </Panel>
      </div>
    </div>
  );
}

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border p-5 print:break-inside-avoid">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}
function ReviewRow({
  label,
  value,
  source,
  status,
  onAccept,
  onReject,
  onDelete,
}: {
  label: string;
  value: string;
  source: string;
  status: ReviewStatus;
  onAccept: () => void;
  onReject: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className="rounded-md border border-border p-3 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="font-medium">{label}</div>
          <div className="mt-1 whitespace-pre-wrap text-muted-foreground">{value}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {SOURCE_LABELS[source as MetabolicSource] ?? source} ·{" "}
            {status === "pending"
              ? "Pendente de confirmação"
              : status === "confirmed"
                ? "Confirmado"
                : "Rejeitado"}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          {status === "pending" ? (
            <>
              <Button size="icon" variant="ghost" aria-label="Aceitar sugestão" onClick={onAccept}>
                <Check />
              </Button>
              <Button size="icon" variant="ghost" aria-label="Rejeitar sugestão" onClick={onReject}>
                <X />
              </Button>
            </>
          ) : null}
          {onDelete ? (
            <Button size="icon" variant="ghost" aria-label="Excluir registro" onClick={onDelete}>
              <Trash2 />
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
function EmptyState({ onCreate, creating }: { onCreate: () => void; creating: boolean }) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
      <div className="rounded-full border border-border p-4">
        <FileText className="size-7 text-muted-foreground" />
      </div>
      <h3 className="mt-4 text-lg font-semibold">Nenhum mapa registrado</h3>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        Comece uma avaliação longitudinal usando os dados já existentes no prontuário.
      </p>
      <Button className="mt-5" onClick={onCreate} disabled={creating}>
        <Plus /> Abrir avaliação
      </Button>
    </div>
  );
}
function numberOrNull(value: string) {
  const parsed = Number(value.replace(",", "."));
  return value.trim() && Number.isFinite(parsed) ? parsed : null;
}
function displayValue(value: unknown, unit: string) {
  return value === undefined || value === null || value === "" ? "—" : `${value} ${unit}`;
}
function formatDate(value: string | null | undefined) {
  if (!value) return "Não informado";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isNaN(date.getTime())
    ? "Não informado"
    : new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(
        date,
      );
}
