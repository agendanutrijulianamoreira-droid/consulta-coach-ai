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
import { calculateDerivedLabResults, canonicalAnalyteCode, type LabPatientContext, type LabResultValue } from "@/modules/exames/domain/lab-calculations";
import * as labs from "@/modules/exames/infrastructure/labs-repository";

interface Props {
  consultationId: string;
  patientId: string;
  context: LabPatientContext;
  onCountChange?: (count: number) => void;
}

type ExtractedLabs = Awaited<ReturnType<ReturnType<typeof useServerFn<typeof extractLabsFromText>>>>;

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
  const [selectedCode, setSelectedCode] = useState("");
  const [targetDraft, setTargetDraft] = useState({ min: "", max: "", source: "", version: "" });
  const fileInput = useRef<HTMLInputElement | null>(null);

  useEffect(() => { if (assessmentQuery.data) setAssessment(assessmentQuery.data); }, [assessmentQuery.data]);

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
  useEffect(() => { if (!selectedCode && evolutionCodes.length) setSelectedCode(evolutionCodes[0]![0]); }, [evolutionCodes, selectedCode]);

  const evolution = useMemo(() => (evolutionQuery.data ?? [])
    .filter((point) => point.analyte_code === selectedCode)
    .sort((a, b) => (a.collection_date ?? a.consultation_date).localeCompare(b.collection_date ?? b.consultation_date)), [evolutionQuery.data, selectedCode]);

  const selectedTarget = useMemo(() => findTarget(targetsQuery.data ?? [], { analyte_code: selectedCode, analyte_name: selectedCode, value: null }, context), [context, selectedCode, targetsQuery.data]);
  useEffect(() => setTargetDraft({ min: selectedTarget?.target_min?.toString() ?? "", max: selectedTarget?.target_max?.toString() ?? "", source: selectedTarget?.source_label ?? "", version: selectedTarget?.source_version ?? "" }), [selectedTarget]);

  async function invalidate() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["lab-results", consultationId] }),
      queryClient.invalidateQueries({ queryKey: ["lab-evolution", patientId] }),
    ]);
  }

  async function recalculate() {
    const fresh = await labs.listLabResults(consultationId);
    await labs.replaceDerivedResults(consultationId, calculateDerivedLabResults(fresh, context));
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
        analyte_code: canonicalAnalyteCode(manual.name), analyte_name: manual.name.trim(), value, value_text: null,
        unit: manual.unit.trim() || null, lab_reference_min: parseNumber(manual.referenceMin), lab_reference_max: parseNumber(manual.referenceMax),
        lab_reference_text: null, input_method: "manual", review_status: "confirmed", is_derived: false,
      });
      setManual({ name: "", value: "", unit: "", referenceMin: "", referenceMax: "" });
      await recalculate();
    } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(null); }
  }

  async function importExtraction(extraction: ExtractedLabs, method: "dictation" | "image" | "pdf") {
    if (extraction.collection_date || extraction.laboratory_name) {
      const next = { ...assessment, collection_date: extraction.collection_date ?? assessment.collection_date, laboratory_name: extraction.laboratory_name ?? assessment.laboratory_name };
      setAssessment(next); await labs.saveLabAssessment(next);
    }
    for (const result of extraction.results) {
      await labs.upsertLabResult(consultationId, {
        analyte_code: canonicalAnalyteCode(result.analyte_code || result.analyte_name), analyte_name: result.analyte_name,
        value: result.value, value_text: result.value_text, unit: result.unit, lab_reference_min: result.reference_min,
        lab_reference_max: result.reference_max, lab_reference_text: result.reference_text, input_method: method,
        review_status: "pending", is_derived: false, source_note: "Extraído automaticamente; exige revisão profissional antes de alimentar cálculos.",
      });
    }
    await invalidate();
    toast.success(`${extraction.results.length} resultado${extraction.results.length === 1 ? "" : "s"} extraído${extraction.results.length === 1 ? "" : "s"} para revisão.`);
  }

  async function extractFromText(text: string) {
    if (!text.trim()) return;
    setBusy("extract");
    try { await importExtraction(await extractText({ data: { text } }), "dictation"); setPasteText(""); }
    catch (error) { toast.error(extractionErrorMessage(error)); } finally { setBusy(null); }
  }

  async function handleFile(file: File) {
    if (file.size > 12 * 1024 * 1024) {
      toast.error("O arquivo deve ter no máximo 12 MB.");
      return;
    }
    const allowed = ["application/pdf", "image/jpeg", "image/png", "image/webp"] as const;
    if (!allowed.includes(file.type as (typeof allowed)[number])) {
      toast.error("Use PDF, JPG, PNG ou WEBP.");
      return;
    }
    setBusy("file");
    try {
      const mimeType = file.type as (typeof allowed)[number];
      const extraction = await extractFile({ data: { fileBase64: await fileToBase64(file), mimeType, filename: file.name } });
      await importExtraction(extraction, mimeType === "application/pdf" ? "pdf" : "image");
    } catch (error) { toast.error(extractionErrorMessage(error)); }
    finally { setBusy(null); if (fileInput.current) fileInput.current.value = ""; }
  }

  async function confirm(item: labs.StoredLabResult) {
    setBusy(item.id);
    try { await labs.upsertLabResult(consultationId, { ...item, review_status: "confirmed" }); await recalculate(); }
    catch (error) { toast.error(errorMessage(error)); } finally { setBusy(null); }
  }

  async function remove(item: labs.StoredLabResult) {
    setBusy(item.id);
    try { await labs.deleteLabResult(item.id); await recalculate(); }
    catch (error) { toast.error(errorMessage(error)); } finally { setBusy(null); }
  }

  async function saveAssessment() {
    setBusy("assessment");
    try { await labs.saveLabAssessment(assessment); toast.success("Dados da coleta salvos."); }
    catch (error) { toast.error(errorMessage(error)); } finally { setBusy(null); }
  }

  async function saveTarget() {
    if (!selectedCode) return;
    const label = evolutionCodes.find(([code]) => code === selectedCode)?.[1] ?? selectedCode;
    const unit = evolution.find((point) => point.unit)?.unit ?? null;
    setBusy("target");
    try {
      await labs.saveLabReferenceTarget({
        ...(selectedTarget?.id ? { id: selectedTarget.id } : {}), analyte_code: selectedCode, analyte_name: label, unit,
        sex: null, age_min: null, age_max: null, target_min: parseNumber(targetDraft.min), target_max: parseNumber(targetDraft.max),
        interpretation_below: null, interpretation_in_range: null, interpretation_above: null,
        source_label: targetDraft.source.trim() || null, source_version: targetDraft.version.trim() || null, active: true,
      });
      await queryClient.invalidateQueries({ queryKey: ["lab-targets"] }); toast.success("Padrão do consultório salvo.");
    } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(null); }
  }

  return <div className="space-y-5">
    <section className="rounded-md border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div><div className="flex items-center gap-2"><FlaskConical className="size-4" /><h2 className="text-sm font-medium">Avaliação de exames</h2></div><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">Digite, dite ou importe o laudo. Resultados extraídos de imagem/PDF entram pendentes; somente dados confirmados alimentam cálculos e evolução.</p></div>
        <div className="flex gap-2 text-xs text-muted-foreground"><span>{measured.length} confirmados</span><span>·</span><span>{derived.length} calculados</span>{pending.length ? <><span>·</span><span className="text-foreground">{pending.length} para revisar</span></> : null}</div>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="Data da coleta"><Input type="date" value={assessment.collection_date ?? ""} onChange={(e) => setAssessment({ ...assessment, collection_date: e.target.value || null })} /></Field>
        <Field label="Laboratório"><Input value={assessment.laboratory_name ?? ""} onChange={(e) => setAssessment({ ...assessment, laboratory_name: e.target.value || null })} /></Field>
        <div className="flex items-end"><Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => void saveAssessment()}><Save /> Salvar coleta</Button></div>
      </div>
    </section>

    <section className="grid gap-4 lg:grid-cols-2">
      <div className="rounded-md border border-border p-4"><h3 className="text-sm font-medium">Entrada rápida</h3><p className="mt-1 text-xs text-muted-foreground">Valor digitado manualmente é considerado revisado por você.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2"><Input placeholder="Exame — ex.: Glicemia" value={manual.name} onChange={(e) => setManual({ ...manual, name: e.target.value })} /><div className="grid grid-cols-[1fr_100px] gap-2"><Input inputMode="decimal" placeholder="Resultado" value={manual.value} onChange={(e) => setManual({ ...manual, value: e.target.value })} /><Input placeholder="Unidade" value={manual.unit} onChange={(e) => setManual({ ...manual, unit: e.target.value })} /></div><Input inputMode="decimal" placeholder="Referência mínima (opcional)" value={manual.referenceMin} onChange={(e) => setManual({ ...manual, referenceMin: e.target.value })} /><Input inputMode="decimal" placeholder="Referência máxima (opcional)" value={manual.referenceMax} onChange={(e) => setManual({ ...manual, referenceMax: e.target.value })} /></div>
        <Button type="button" size="sm" className="mt-3" disabled={busy !== null} onClick={() => void addManual()}>{busy === "manual" ? <Loader2 className="animate-spin" /> : <Plus />} Adicionar resultado</Button>
      </div>
      <div className="rounded-md border border-border p-4"><h3 className="text-sm font-medium">Ditado, texto ou arquivo</h3><div className="mt-3 flex flex-wrap gap-2"><DictationButton label="Ditar exames" onText={(text) => void extractFromText(text)} /><input ref={fileInput} type="file" accept="application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void handleFile(file); }} /><Button type="button" variant="outline" size="sm" disabled={busy !== null} onClick={() => fileInput.current?.click()}>{busy === "file" ? <Loader2 className="animate-spin" /> : <FileUp />} Importar imagem/PDF</Button></div><Textarea value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Ou cole vários resultados: Glicemia 97 mg/dL, insulina 14,8 µUI/mL..." className="mt-3 min-h-24" /><Button type="button" variant="secondary" size="sm" className="mt-2" disabled={!pasteText.trim() || busy !== null} onClick={() => void extractFromText(pasteText)}>{busy === "extract" ? <Loader2 className="animate-spin" /> : <RefreshCw />} Organizar resultados</Button><p className="mt-2 text-[11px] leading-4 text-muted-foreground">Nesta versão o arquivo original não é armazenado; apenas os resultados revisáveis entram no prontuário.</p></div>
    </section>

    {pending.length ? <section className="rounded-md border border-border p-4"><div className="flex items-center gap-2"><AlertTriangle className="size-4" /><h3 className="text-sm font-medium">Revisar importação</h3></div><p className="mt-1 text-xs text-muted-foreground">Confira valor, unidade e referência. Estes itens ainda não participam dos cálculos.</p><div className="mt-3 space-y-2">{pending.map((item) => { const target = findTarget(targetsQuery.data ?? [], item, context); return <ResultRow key={item.id} item={item} target={target} pending busy={busy === item.id} onConfirm={() => void confirm(item)} onDelete={() => void remove(item)} />; })}</div></section> : null}

    <section className="grid gap-5 xl:grid-cols-[1.3fr_0.7fr]">
      <div className="rounded-md border border-border p-4"><h3 className="text-sm font-medium">Resultados confirmados</h3><div className="mt-3 space-y-2">{measured.length ? measured.map((item) => { const target = findTarget(targetsQuery.data ?? [], item, context); return <ResultRow key={item.id} item={item} target={target} busy={busy === item.id} onDelete={() => void remove(item)} />; }) : <Empty text="Nenhum resultado confirmado ainda." />}</div></div>
      <div className="rounded-md border border-border p-4"><div className="flex items-center gap-2"><Calculator className="size-4" /><h3 className="text-sm font-medium">Índices calculados</h3></div><p className="mt-1 text-xs text-muted-foreground">Gerados deterministicamente somente com dados confirmados.</p><div className="mt-3 space-y-2">{derived.length ? derived.map((item) => <div key={item.id} className="rounded-md bg-muted/40 px-3 py-2"><div className="flex items-start justify-between gap-3"><span className="text-sm">{item.analyte_name}</span><span className="text-sm font-semibold tabular-nums">{formatValue(item.value)} {item.unit ?? ""}</span></div><p className="mt-1 text-[10px] text-muted-foreground">{item.calculation_version}{item.source_note ? ` · ${item.source_note}` : ""}</p></div>) : <Empty text="Os cálculos aparecerão conforme os exames-base forem confirmados." />}</div></div>
    </section>

    <section className="rounded-md border border-border p-4"><div className="flex items-center gap-2"><TrendingUp className="size-4" /><h3 className="text-sm font-medium">Evolução entre consultas</h3></div><p className="mt-1 text-xs text-muted-foreground">Cada nova consulta é adicionada à linha do tempo, mantendo medidos e calculados identificados separadamente.</p>
      {evolutionCodes.length ? <><div className="mt-4 flex flex-wrap gap-2">{evolutionCodes.map(([code, label]) => <Button key={code} type="button" size="sm" variant={selectedCode === code ? "default" : "outline"} onClick={() => setSelectedCode(code)}>{label}</Button>)}</div><div className="mt-4 h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={evolution.map((p) => ({ date: formatDate(p.collection_date ?? p.consultation_date), value: p.value }))}><XAxis dataKey="date" fontSize={11} /><YAxis fontSize={11} width={54} /><Tooltip /><Line type="monotone" dataKey="value" stroke="currentColor" strokeWidth={2} dot /></LineChart></ResponsiveContainer></div><div className="mt-3 overflow-x-auto"><table className="w-full text-xs"><thead><tr className="text-left text-muted-foreground"><th className="py-2">Data</th><th>Resultado</th><th>Origem</th></tr></thead><tbody>{evolution.map((p) => <tr key={`${p.consultation_id}-${p.analyte_code}`} className="border-t border-border"><td className="py-2">{formatDate(p.collection_date ?? p.consultation_date)}</td><td className="font-medium tabular-nums">{p.value} {p.unit ?? ""}</td><td>{p.is_derived ? p.calculation_version ?? "calculado" : "medido"}</td></tr>)}</tbody></table></div>
        <div className="mt-5 rounded-md bg-muted/30 p-3"><p className="text-xs font-medium">Padrão nutricional do consultório</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">Faixa editável e separada da referência do laboratório. Registre fonte e versão.</p><div className="mt-3 grid gap-2 sm:grid-cols-4"><Input inputMode="decimal" placeholder="Mínimo" value={targetDraft.min} onChange={(e) => setTargetDraft({ ...targetDraft, min: e.target.value })} /><Input inputMode="decimal" placeholder="Máximo" value={targetDraft.max} onChange={(e) => setTargetDraft({ ...targetDraft, max: e.target.value })} /><Input placeholder="Fonte" value={targetDraft.source} onChange={(e) => setTargetDraft({ ...targetDraft, source: e.target.value })} /><Input placeholder="Versão/ano" value={targetDraft.version} onChange={(e) => setTargetDraft({ ...targetDraft, version: e.target.value })} /></div><Button type="button" variant="outline" size="sm" className="mt-2" disabled={busy !== null} onClick={() => void saveTarget()}><Save /> Salvar padrão</Button></div></> : <Empty text="A evolução aparecerá depois do primeiro resultado confirmado." />}
    </section>
  </div>;
}

function ResultRow({ item, target, pending = false, busy = false, onConfirm, onDelete }: { item: labs.StoredLabResult; target: labs.LabReferenceTarget | undefined; pending?: boolean; busy?: boolean; onConfirm?: () => void; onDelete: () => void }) {
  const labStatus = classify(item.value, item.lab_reference_min ?? null, item.lab_reference_max ?? null);
  const targetStatus = classify(item.value, target?.target_min ?? null, target?.target_max ?? null);
  return <div className="grid gap-2 rounded-md bg-muted/30 px-3 py-2 sm:grid-cols-[1fr_auto_auto] sm:items-center"><div><div className="text-sm font-medium">{item.analyte_name}</div><div className="mt-0.5 flex flex-wrap gap-x-2 text-[10px] text-muted-foreground">{item.lab_reference_text ? <span>Lab: {item.lab_reference_text}</span> : item.lab_reference_min !== null || item.lab_reference_max !== null ? <span>Lab: {rangeText(item.lab_reference_min ?? null, item.lab_reference_max ?? null)}</span> : null}{labStatus ? <span>{labStatus} pelo laboratório</span> : null}{target ? <span>Alvo: {rangeText(target.target_min, target.target_max)}{targetStatus ? ` · ${targetStatus}` : ""}</span> : null}</div></div><div className="text-right"><div className="text-sm font-semibold tabular-nums">{item.value !== null ? formatValue(item.value) : item.value_text ?? "—"} {item.unit ?? ""}</div><div className="text-[10px] text-muted-foreground">{pending ? "aguardando revisão" : item.input_method === "manual" ? "digitado" : item.input_method}</div></div><div className="flex justify-end gap-1">{pending && onConfirm ? <Button type="button" size="icon" variant="ghost" className="size-7" disabled={busy} title="Confirmar resultado" onClick={onConfirm}>{busy ? <Loader2 className="animate-spin" /> : <Check />}</Button> : null}<Button type="button" size="icon" variant="ghost" className="size-7 text-muted-foreground" disabled={busy} title="Remover resultado" onClick={onDelete}><Trash2 /></Button></div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="text-xs text-muted-foreground">{label}<div className="mt-1">{children}</div></label>; }
function Empty({ text }: { text: string }) { return <p className="py-6 text-center text-sm text-muted-foreground">{text}</p>; }
function findTarget(targets: labs.LabReferenceTarget[], item: LabResultValue, context: LabPatientContext) { return targets.find((target) => target.analyte_code === item.analyte_code && target.active && (!target.sex || target.sex === context.sex) && (target.age_min === null || (context.age !== null && context.age >= target.age_min)) && (target.age_max === null || (context.age !== null && context.age <= target.age_max))); }
function classify(value: number | null, min: number | null, max: number | null) { if (value === null || (min === null && max === null)) return null; if (min !== null && value < min) return "abaixo"; if (max !== null && value > max) return "acima"; return "dentro"; }
function rangeText(min: number | null, max: number | null) { if (min !== null && max !== null) return `${min}–${max}`; if (min !== null) return `≥ ${min}`; if (max !== null) return `≤ ${max}`; return "não definido"; }
function parseNumber(value: string) { if (!value.trim()) return null; const parsed = Number(value.replace(",", ".")); return Number.isFinite(parsed) ? parsed : null; }
function formatValue(value: number | null) { return value === null ? "—" : value.toLocaleString("pt-BR", { maximumFractionDigits: 2 }); }
function formatDate(value: string) { if (!value) return "—"; const date = new Date(`${value.slice(0, 10)}T12:00:00`); return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR"); }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : "Não foi possível concluir a operação."; }
/** Leitura automática depende da IA do servidor; quando ela falta, sugere o caminho manual que já funciona. */
function extractionErrorMessage(error: unknown) {
  const message = errorMessage(error);
  if (message.includes("não está configurada no servidor")) {
    return "Leitura automática indisponível neste ambiente. Use \"Entrada rápida\" para digitar os resultados manualmente.";
  }
  return message;
}
function fileToBase64(file: File) { return new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("Não foi possível ler o arquivo.")); reader.onload = () => { const dataUrl = String(reader.result ?? ""); const comma = dataUrl.indexOf(","); if (comma < 0) reject(new Error("Arquivo inválido.")); else resolve(dataUrl.slice(comma + 1)); }; reader.readAsDataURL(file); }); }
