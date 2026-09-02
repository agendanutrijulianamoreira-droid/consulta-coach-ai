import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Calculator, Check, FileUp, FlaskConical, Loader2, Plus, RefreshCw, Save, Trash2, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { DictationButton } from "@/components/nutrios/dictation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { extractLabsFromFile, extractLabsFromText } from "@/modules/exames/application/lab-extraction.functions";
import {
  calculateDerivedLabResults,
  canonicalAnalyteCode,
  type LabPatientContext,
  type LabResultValue,
} from "@/modules/exames/domain/lab-calculations";
import * as labs from "@/modules/exames/infrastructure/labs-repository";

interface Props {
  consultationId: string;
  patientId: string;
  context: LabPatientContext;
  onCountChange?: (count: number) => void;
}

export function LabAssessmentPanel({ consultationId, patientId, context, onCountChange }: Props) {
  const queryClient = useQueryClient();
  const extractText = useServerFn(extractLabsFromText);
  const extractFile = useServerFn(extractLabsFromFile);
  const assessmentQuery = useQuery({ queryKey: ["lab-assessment", consultationId], queryFn: () => labs.getLabAssessment(consultationId) });
  const resultsQuery = useQuery({ queryKey: ["lab-results", consultationId], queryFn: () => labs.listLabResults(consultationId) });
  const evolutionQuery = useQuery({ queryKey: ["lab-evolution", patientId], queryFn: () => labs.listPatientLabEvolution(patientId) });
  const targetsQuery = useQuery({ queryKey: ["lab-targets"], queryFn: labs.listLabReferenceTargets });
  const [assessment, setAssessment] = useState<labs.LabAssessment>({ consultation_id: consultationId, collection_date: null, laboratory_name: null, notes: null });
  const [manual, setManual] = useState({ name: "", value: "", unit: "", referenceMin: "", referenceMax: "" });
  const [pasteText, setPasteText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [selectedCode, setSelectedCode] = useState<string>("");
  const [targetDraft, setTargetDraft] = useState({ min: "", max: "", source: "", version: "" });
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (assessmentQuery.data) setAssessment(assessmentQuery.data);
  }, [assessmentQuery.data]);

  const current = resultsQuery.data ?? [];
  const measured = current.filter((item) => !item.is_derived && item.review_status === "confirmed");
  const pending = current.filter((item) => !item.is_derived && item.review_status === "pending");
  const derived = current.filter((item) => item.is_derived);

  useEffect(() => onCountChange?.(measured.length + derived.length), [derived.length, measured.length, onCountChange]);

  const evolutionCodes = useMemo(() => {
    const map = new Map<string, string>();
    for (const point of evolutionQuery.data ?? []) map.set(point.analyte_code, point.analyte_name);
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  }, [evolutionQuery.data]);

  useEffect(() => {
    if (!selectedCode && evolutionCodes.length) setSelectedCode(evolutionCodes[0]![0]);
  }, [evolutionCodes, selectedCode]);

  const evolution = useMemo(() => (evolutionQuery.data ?? [])
    .filter((point) => point.analyte_code === selectedCode)
    .sort((a, b) => (a.collection_date ?? a.consultation_date).localeCompare(b.collection_date ?? b.consultation_date)), [evolutionQuery.data, selectedCode]);

  const selectedTarget = useMemo(() => (targetsQuery.data ?? []).find((target) => {
    if (target.analyte_code !== selectedCode || !target.active) return false;
    if (target.sex && target.sex !== context.sex) return false;
    if (target.age_min !== null && (context.age === null || context.age < target.age_min)) return false;
    if (target.age_max !== null && (context.age === null || context.age > target.age_max)) return false;
    return true;
  }), [context.age, context.sex, selectedCode, targetsQuery.data]);

  useEffect(() => {
    setTargetDraft({
      min: selectedTarget?.target_min?.toString() ?? "",
      max: selectedTarget?.target_max?.toString() ?? "",
      source: selectedTarget?.source_label ?? "",
      version: selectedTarget?.source_version ?? "",
    });
  }, [selectedTarget]);

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["lab-results", consultationId] }),
      queryClient.invalidateQueries({ queryKey: ["lab-evolution", patientId] }),
    ]);
  }

  async function recalculate() {
    const fresh = await labs.listLabResults(consultationId);
    const derivedResults = calculateDerivedLabResults(fresh, context);
    await labs.replaceDerivedResults(consultationId, derivedResults);
    await invalidate();
  }

  async function addManual() {
    const value = parseNumber(manual.value);
    if (!manual.name.trim() || value === null) {
      toast.error("Informe o nome do exame e um resultado numérico.");
      return;
    }
    setBusy("manual");
    try {
      await labs.upsertLabResult(consultationId, {
        analyte_code: canonicalAnalyteCode(manual.name),
        analyte_name: manual.name.trim(),
        value,
        value_text: null,
        unit: manual.unit.trim() || null,
        lab_reference_min: parseNumber(manual.referenceMin),
        lab_reference_max: parseNumber(manual.referenceMax),
        lab_reference_text: null,
        input_method: "manual",
        review_status: "confirmed",
        is_derived: false,
      });
      setManual({ name: "", value: "", unit: "", referenceMin: "", referenceMax: "" });
      await recalculate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o exame.");
    } finally {
      setBusy(null);
    }
  }

  async function importExtraction(extraction: Awaited<ReturnType<typeof extractText>>, method: "dictation" | "image" | "pdf") {
    if (extraction.collection_date || extraction.laboratory_name) {
      const nextAssessment = {
        ...assessment,
        collection_date: extraction.collection_date ?? assessment.collection_date,
        laboratory_name: extraction.laboratory_name ?? assessment.laboratory_name,
      };
      setAssessment(nextAssessment);
      await labs.saveLabAssessment(nextAssessment);
    }
    for (const result of extraction.results) {
      await labs.upsertLabResult(consultationId, {
        analyte_code: canonicalAnalyteCode(result.analyte_code || result.analyte_name),
        analyte_name: result.analyte_name,
        value: result.value,
        value_text: result.value_text,
        unit: result.unit,
        lab_reference_min: result.reference_min,
        lab_reference_max: result.reference_max,
        lab_reference_text: result.reference_text,
        input_method: method,
        review_status: "pending",
        is_derived: false,
        source_note: "Extraído automaticamente; exige revisão profissional antes de alimentar cálculos.",
      });
    }
    await invalidate();
    toast.success(`${extraction.results.length} resultado${extraction.results.length === 1 ? "" : "s"} extraído${extraction.results.length === 1 ? "" : "s"} para revisão.`);
  }

  async function handleTextExtraction(text: string, method: "dictation" | "image" | "pdf" = "dictation") {
    if (!text.trim()) return;
    setBusy("extract");
    try {
      const extraction = await extractText({ data: { text } });
      await importExtraction(extraction, method);
      setPasteText("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível extrair os exames.");
    } finally {
      setBusy(null);
    }
  }

  async function handleFile(file: File) {
    if (file.size > 12 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 12 MB.");
      return;
    }
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Use PDF, JPG, PNG ou WEBP.");
      return;
    }
    setBusy("file");
    try {
      const fileBase64 = await fileToBase64(file);
      const extraction = await extractFile({ data: { fileBase64, mimeType: file.type as "application/pdf" | "image/jpeg" | "image/png" | "image/webp", filename: file.name } });
      await importExtraction(extraction, file.type === "application/pdf" ? "pdf" : "image");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível ler o arquivo.");
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function confirm(item: labs.StoredLabResult) {
    setBusy(item.id);
    try {
      await labs.upsertLabResult(consultationId, { ...item, review_status: "confirmed" });
      await recalculate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível confirmar o resultado.");
    } finally {
      setBusy(null);
    }
  }

  async function remove(item: labs.StoredLabResult) {
    setBusy(item.id);
    try {
      await labs.deleteLabResult(item.id);
      await recalculate();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover o resultado.");
    } finally {
      setBusy(null);
    }
  }

  async function saveAssessment() {
    setBusy("assessment");
    try {
      await labs.saveLabAssessment(assessment);
      toast.success("Dados da coleta salvos.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar a coleta.");
    } finally {
      setBusy(null);
    }
  }

  async function saveTarget() {
    if (!selectedCode) return;
    const label = evolutionCodes.find(([code]) => code === selectedCode)?.[1] ?? selectedCode;
    const unit = evolution.find((point) => point.unit)?.unit ?? null;
    setBusy("target");
    try {
      await labs.saveLabReferenceTarget({
        ...(selectedTarget?.id ? { id: selectedTarget.id } : {}),
        analyte_code: selectedCode,
        analyte_name: label,
        unit,
        sex: null,
        age_min: null,
        age_max: null,
        target_min: parseNumber(targetDraft.min),
        target_max: parseNumber(targetDraft.max),
        interpretation_below: null,
        interpretation_in_range: null,
        interpretation_above: null,
        source_label: targetDraft.source.trim() || null,
        source_version: targetDraft.version.trim() || null,
        active: true,
      });
      await queryClient.invalidateQueries({ queryKey: ["lab-targets"] });
      toast.success("Padrão do consultório salvo.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o padrão.");
    } finally {
      setBusy(null);
    }
  }

  return <div className="space-y-5">
    <section className="rounded-md border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><FlaskConical className="size-4" /><h2 className="text-sm font-medium">Avaliação de exames</h2></div>
          <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">Digite, dite ou importe o laudo. Resultados extraídos de imagem/PDF entram pendentes; somente dados confirmados alimentam os cálculos automáticos e a evolução.</p>
        </div>
        <div className="flex gap-2 text-xs text-muted-foreground"><span>{measured.length} confirmados</span><span>·</span><span>{derived.length} calculados</span>{pending.length ? <><span>·</span><span className="text-foreground">{pending.length} para revisar</span></> : null}</div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <label className="text-xs text-muted-foreground">Data da coleta<Input type="date" value={assessment.collection_date ?? ""} onChange={(event) => setAssessment({ ...assessment, collection_date: event.target.value || null })} className="mt-1" /></label>
        <label className="text-xs text-muted-foreground">Laboratório<Input value={assessment.laboratory_name ?? ""} onChange={(event) => setAssessment({ ...assessment, laboratory_name: event.target.value || null })} className="mt-1" /></label>
        <div className="flex items-end"><Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => void saveAssessment()}><Save /> Salvar coleta</Button></div>
      </div>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-md border border-border p-4">
        <h3 className="text-sm font-medium">Entrada rápida</h3>
        <p className="mt-1 text-xs text-muted-foreground">Valor digitado manualmente é considerado revisado por você.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Input placeholder="Exame — ex.: Glicemia" value={manual.name} onChange={(event) => setManual({ ...manual, name: event.target.value })} />
          <div className="grid grid-cols-[1fr_100px] gap-2"><Input inputMode="decimal" placeholder="Resultado" value={manual.value} onChange={(event) => setManual({ ...manual, value: event.target.value })} /><Input placeholder="Unidade" value={manual.unit} onChange={(event) => setManual({ ...manual, unit: event.target.value })} /></div>
          <Input inputMode="decimal" placeholder="Referência mínima (opcional)" value={manual.referenceMin} onChange={(event) => setManual({ ...manual, referenceMin: event.target.value })} />
          <Input inputMode="decimal" placeholder="Referência máxima (opcional)" value={manual.referenceMax} onChange={(event) => setManual({ ...manual, referenceMax: event.target.value })} />
        </div>
        <Button type="button" size="sm" className="mt-3" disabled={busy !== null} onClick={() => void addManual()}>{busy === "manual" ? <Loader2 className="animate-spin" /> : <Plus />} Adicionar resultado</Button>
      </div>

      <div className="rounded-md border border-border p-4">
        <h3 className="text-sm font-medium">Ditado, texto ou arquivo</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <DictationButton label="Ditar exames" onText={(text) => void handleTextExtraction(text)} />
          <input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => { const file = event.target.files?.[0]; if (file) void handleFile(file); }} />
          <Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => fileInput.current?.click()}>{busy === "file" ? <Loader2 className="animate-spin" /> : <FileUp />} Importar imagem/PDF</Button>
        </div>
        <Textarea value={pasteText} onChange={(event) => setPasteText(event.target.value)} placeholder="Ou cole/digite vários resultados de uma vez: Glicemia 97 mg/dL, insulina 14,8 µUI/mL..." className="mt-3 min-h-24" />
        <Button type="button" variant="secondary" size="sm" className="mt-2" disabled={!pasteText.trim() || busy !== null} onClick={() => void handleTextExtraction(pasteText)}>{busy === "extract" ? <Loader2 className="animate-spin" /> : <RefreshCw />} Organizar resultados</Button>
        <p className="mt-2 text-[11px] leading-4 text-muted-foreground">O arquivo original não é salvo nesta versão; apenas os resultados extraídos entram no prontuário após revisão.</p>
      </div>
    </section>

    {pending.length ? <section className="rounded-md border border-border p-4">
      <div className="flex items-center gap-2"><AlertTriangle className="size-4" /><h3 className="text-sm font-medium">Revisar importação</h3></div>
      <p className="mt-1 text-xs text-muted-foreground">Confira valor, unidade e referência. Estes itens ainda não participam de HOMA, clearance ou outros cálculos.</p>
      <div className="mt-3 space-y-2">{pending.map((item) => <ResultRow key={item.id} item={item} target={findTarget(targetsQuery.data ?? [], item, context)} pending busy={busy === item.id} onConfirm={() => void confirm(item)} onDelete={() => void remove(item)} />)}</div>
    </section> : null}

    <section className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
      <div className="rounded-md border border-border p-4">
        <h3 className="text-sm font-medium">Resultados confirmados</h3>
        <div className="mt-3 space-y-2">{measured.length ? measured.map((item) => <ResultRow key={item.id} item={item} target={findTarget(targetsQuery.data ?? [], item, context)} busy={busy === item.id} onDelete={() => void remove(item)} />) : <p className="py-6 text-center text-sm text-muted-foreground">Nenhum resultado confirmado ainda.</p>}</div>
      </div>
      <div className="rounded-md border border-border p-4">
        <div className="flex items-center gap-2"><Calculator className="size-4" /><h3 className="text-sm font-medium">Índices calculados</h3></div>
        <p className="mt-1 text-xs text-muted-foreground">Gerados deterministicamente quando todos os dados necessários estão confirmados.</p>
        <div className="mt-3 space-y-2">{derived.length ? derived.map((item) => <div key={item.id} className="rounded-md bg-muted/40 px-3 py-2"><div className="flex items-start justify-between gap-3"><span className="text-sm">{item.analyte_name}</span><span className="text-sm font-semibold tabular-nums">{formatValue(item.value)} {item.unit ?? ""}</span></div><p className="mt-1 text-[10px] text-muted-foreground">{item.calculation_version}{item.source_note ? ` · ${item.source_note}` : ""}</p></div>) : <p className="py-6 text-center text-sm text-muted-foreground">Os cálculos aparecerão conforme os exames-base forem confirmados.</p>}</div>
      </div>
    </section>

    <section className="rounded-md border border-border p-4">
      <div className="flex items-center gap-2"><TrendingUp className="size-4" /><h3 className="text-sm font-medium">Evolução entre consultas</h3></div>
      <p className="mt-1 text-xs text-muted-foreground">Cada nova consulta é adicionada à linha do tempo do paciente, mantendo exames medidos e índices derivados identificados separadamente.</p>
      {evolutionCodes.length ? <>
        <div className="mt-4 flex flex-wrap gap-2">{evolutionCodes.map(([code, label]) => <Button key={code} type="button" size="sm" variant={selectedCode === code ? "default" : "outline"} onClick={() => setSelectedCode(code)}>{label}</Button>)}</div>
        <div className="mt-4 h-56 w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={evolution.map((point) => ({ date: formatDate(point.collection_date ?? point.consultation_date), value: point.value }))}><XAxis dataKey="date" fontSize={11} /><YAxis fontSize={11} width={54} /><Tooltip /><Line type="monotone" dataKey="value" stroke="currentColor" strokeWidth={2} dot /></LineChart></ResponsiveContainer></div>
        <div className="mt-3 overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th className="py-2">Data</th><th>Resultado</th><th>Origem</th></tr></thead><tbody>{evolution.map((point) => <tr key={`${point.consultation_id}-${point.analyte_code}`} className="border-t border-border"><td className="py-2">{formatDate(point.collection_date ?? point.consultation_date)}</td><td className="font-medium tabular-nums">{point.value} {point.unit ?? ""}</td><td>{point.is_derived ? point.calculation_version ?? "calculado" : "medido"}</td></tr>)}</tbody></table></div>

        <div className="mt-5 rounded-md bg-muted/30 p-3">
          <p className="text-xs font-medium">Padrão nutricional do consultório</p>
          <p className="mt-1 text-[11px] leading-4 text-muted-foreground">Essa faixa é editável e separada do intervalo do laboratório. Registre a fonte/versão para evitar tratar um “ótimo” como valor universal.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-4"><Input inputMode="decimal" placeholder="Mínimo" value={targetDraft.min} onChange={(event) => setTargetDraft({ ...targetDraft, min: event.target.value })} /><Input inputMode="decimal" placeholder="Máximo" value={targetDraft.max} onChange={(event) => setTargetDraft({ ...targetDraft, max: event.target.value })} /><Input placeholder="Fonte" value={targetDraft.source} onChange={(event) => setTargetDraft({ ...targetDraft, source: event.target.value })} /><Input placeholder="Versão/ano" value={targetDraft.version} onChange={(event) => setTargetDraft({ ...targetDraft, version: event.target.value })} /></div>
          <Button type="button" variant="outline" size="sm" className="mt-2" disabled={busy !== null} onClick={() => void saveTarget()}><Save /> Salvar padrão</Button>
        </div>
      </> : <p className="mt-4 py-8 text-center text-sm text-muted-foreground">A evolução aparecerá depois do primeiro resultado confirmado.</p>}
    </section>
  </div>;
}

function ResultRow({ item, target, pending = false, busy = false, onConfirm, onDelete }: { item: labs.StoredLabResult; target?: labs.LabReferenceTarget; pending?: boolean; busy?: boolean; onConfirm?: () => void; onDelete: () => void }) {
  const labStatus = classify(item.value, item.lab_reference_min ?? null, item.lab_reference_max ?? null);
  const targetStatus = classify(item.value, target?.target_min ?? null, target?.target_max ?? null);
  return <div className="grid gap-2 rounded-md bg-muted/30 px-3 py-2 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><div className="text-sm font-medium">{item.analyte_name}</div><div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-muted-foreground">{item.lab_reference_text ? <span>Lab: {item.lab_reference_text}</span> : item.lab_reference_min !== null || item.lab_reference_max !== null ? <span>Lab: {rangeText(item.lab_reference_min ?? null, item.lab_reference_max ?? null)}</span> : null}{labStatus ? <span>{labStatus} pelo laboratório</span> : null}{target ? <span>Alvo: {rangeText(target.target_min, target.target_max)}{targetStatus ? ` · ${targetStatus}` : ""}</span> : null}</div></div><div className="text-right"><div className="text-sm font-semibold tabular-nums">{item.value !== null ? formatValue(item.value) : item.value_text ?? "—"} {item.unit ?? ""}</div><div className="text-[10px] text-muted-foreground">{pending ? "aguardando revisão" : item.input_method === "manual" ? "digitado" : item.input_method}</div></div><div className="flex justify-end gap-1">{pending && onConfirm ? <Button type="button" size="icon" variant="ghost" className="size-7" disabled={busy} title="Confirmar resultado" onClick={onConfirm}>{busy ? <Loader2 className="animate-spin" /> : <Check />}</Button> : null}<Button type="button" size="icon" variant="ghost" className="size-7 text-muted-foreground" disabled={busy} title="Remover resultado" onClick={onDelete}><Trash2 /></Button></div></div>;
}

function findTarget(targets: labs.LabReferenceTarget[], item: LabResultValue, context: LabPatientContext) {
  return targets.find((target) => target.analyte_code === item.analyte_code && target.active && (!target.sex || target.sex === context.sex) && (target.age_min === null || (context.age !== null && context.age >= target.age_min)) && (target.age_max === null || (context.age !== null && context.age <= target.age_max)));
}

function classify(value: number | null, min: number | null, max: number | null) {
  if (value === null || (min === null && max === null)) return null;
  if (min !== null && value < min) return "abaixo";
  if (max !== null && value > max) return "acima";
  return "dentro";
}

function rangeText(min: number | null, max: number | null) {
  if (min !== null && max !== null) return `${min}–${max}`;
  if (min !== null) return `≥ ${min}`;
  if (max !== null) return `≤ ${max}`;
  return "não definido";
}

function parseNumber(value: string) {
  if (!value.trim()) return null;
  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function formatValue(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const comma = dataUrl.indexOf(",");
      if (comma < 0) reject(new Error("Arquivo inválido."));
      else resolve(dataUrl.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}
