import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, Check, Clock3, Loader2, Plus, RefreshCw, Save, Trash2, Utensils } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DictationButton } from "@/components/nutrios/dictation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import * as db from "@/lib/nutrios/repository";
import { structureRecall } from "@/lib/nutrios/ai.functions";
import type { RecallItem } from "@/lib/nutrios/types";
import { analyzeRecall, mergeRecallSuggestions, sortRecall } from "@/modules/consulta/domain/recall";

type SaveState = "saved" | "pending" | "saving" | "error";

export function FoodRecallPanel({
  consultationId,
  items,
  transcript,
  onChange,
}: {
  consultationId: string;
  items: RecallItem[];
  transcript: string;
  onChange: (items: RecallItem[]) => void;
}) {
  const structure = useServerFn(structureRecall);
  const [extracting, setExtracting] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const timers = useRef(new Map<string, number>());
  const pending = useRef(new Map<string, RecallItem>());
  const analysis = useMemo(() => analyzeRecall(items), [items]);

  const persistItem = useCallback(async (item: RecallItem) => {
    setSaveState("saving");
    try {
      await db.upsertRecallItem(consultationId, item);
      pending.current.delete(item.id);
      setLastSavedAt(Date.now());
      setSaveState(pending.current.size ? "pending" : "saved");
    } catch {
      pending.current.set(item.id, item);
      setSaveState("error");
    }
  }, [consultationId]);

  const scheduleSave = useCallback((item: RecallItem) => {
    pending.current.set(item.id, item);
    setSaveState("pending");
    const previous = timers.current.get(item.id);
    if (previous) window.clearTimeout(previous);
    const timer = window.setTimeout(() => {
      timers.current.delete(item.id);
      void persistItem(item);
    }, 650);
    timers.current.set(item.id, timer);
  }, [persistItem]);

  useEffect(() => () => {
    for (const timer of timers.current.values()) window.clearTimeout(timer);
    for (const item of pending.current.values()) void db.upsertRecallItem(consultationId, item);
    timers.current.clear();
  }, [consultationId]);

  const updateItem = (updated: RecallItem) => {
    const next = sortRecall(items.map((item) => item.id === updated.id ? updated : item));
    onChange(next);
    const normalized = next.find((item) => item.id === updated.id) ?? updated;
    scheduleSave(normalized);
  };

  const addItem = (seed?: Partial<RecallItem>) => {
    const created: RecallItem = {
      id: crypto.randomUUID(),
      time_label: seed?.time_label ?? null,
      foods: seed?.foods ?? null,
      amount: seed?.amount ?? null,
      preparation: seed?.preparation ?? null,
      notes: seed?.notes ?? null,
      position: items.length,
    };
    const next = sortRecall([...items, created]);
    onChange(next);
    scheduleSave(next.find((item) => item.id === created.id) ?? created);
  };

  const removeItem = async (id: string) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    pending.current.delete(id);
    onChange(sortRecall(items.filter((item) => item.id !== id)));
    try {
      await db.deleteRecallItem(id);
    } catch {
      toast.error("Não foi possível remover a refeição. Atualize a página antes de continuar.");
    }
  };

  const persistAll = useCallback(async (next: RecallItem[]) => {
    setSaveState("saving");
    try {
      for (const item of next) await db.upsertRecallItem(consultationId, item);
      pending.current.clear();
      setLastSavedAt(Date.now());
      setSaveState("saved");
    } catch {
      for (const item of next) pending.current.set(item.id, item);
      setSaveState("error");
      throw new Error("Não foi possível salvar todo o recordatório.");
    }
  }, [consultationId]);

  const extractFromText = useCallback(async (source: string, successMessage: string) => {
    if (!source.trim() || extracting) return;
    setExtracting(true);
    try {
      const result = await structure({ data: { transcript: source } });
      const merged = mergeRecallSuggestions(items, result.items);
      const added = merged.length - items.length;
      if (added === 0) {
        toast.info("Nenhuma refeição nova foi encontrada. O que já estava revisado foi preservado.");
        return;
      }
      onChange(merged);
      await persistAll(merged);
      toast.success(`${successMessage} ${added} refeição${added === 1 ? "" : "ões"} adicionada${added === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível organizar o recordatório.");
    } finally {
      setExtracting(false);
    }
  }, [extracting, items, onChange, persistAll, structure]);

  const retrySave = async () => {
    const snapshot = sortRecall(items);
    try {
      await persistAll(snapshot);
      toast.success("Recordatório sincronizado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao sincronizar.");
    }
  };

  return (
    <div className="space-y-5">
      <section className="rounded-md border border-border p-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm font-medium">Recordatório alimentar</h2>
              <RecallSaveIndicator state={saveState} onRetry={() => void retrySave()} />
            </div>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">
              Registre o dia alimentar com as palavras do paciente. A IA apenas organiza o relato: uma nova extração acrescenta refeições novas e nunca substitui o que você já revisou.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={!transcript.trim() || extracting} onClick={() => void extractFromText(transcript, "Conversa revisada.")}>
              {extracting ? <Loader2 className="animate-spin" /> : <RefreshCw />} Atualizar da conversa
            </Button>
            <DictationButton
              label="Relatar recordatório"
              disabled={extracting}
              onText={(text) => void extractFromText(text, "Relato organizado.")}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${analysis.completeness}%` }} />
          </div>
          <p className="text-xs tabular-nums text-muted-foreground">{analysis.meals} refeições · {analysis.completeness}% com horário/quantidade</p>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Summary icon={<Utensils className="size-3.5" />} label="Refeições" value={String(analysis.meals)} />
          <Summary icon={<Clock3 className="size-3.5" />} label="Com horário" value={`${analysis.withTime}/${analysis.meals || 0}`} />
          <Summary icon={<Check className="size-3.5" />} label="Com quantidade" value={`${analysis.withAmount}/${analysis.meals || 0}`} />
        </div>
      </section>

      {analysis.issues.length ? (
        <section className="rounded-md border border-border bg-muted/20 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Conferência do relato</p>
          <div className="space-y-1.5">
            {analysis.issues.slice(0, 6).map((issue, index) => (
              <p key={`${issue.itemId ?? "global"}-${index}`} className="flex gap-2 text-xs leading-5 text-muted-foreground">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />{issue.message}
              </p>
            ))}
          </div>
        </section>
      ) : null}

      <div className="space-y-3">
        {items.length ? items.map((item, index) => (
          <article key={item.id} className="rounded-md border border-border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded bg-muted text-[10px] font-medium tabular-nums">{index + 1}</span>
                <span className="text-xs text-muted-foreground">Refeição registrada</span>
              </div>
              <Button type="button" variant="ghost" size="icon" className="size-7 text-muted-foreground" title="Remover refeição" aria-label="Remover refeição" onClick={() => void removeItem(item.id)}><Trash2 /></Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-[130px_1.4fr_1fr]">
              <TextField label="Horário" placeholder="Ex.: 07:30" value={item.time_label} onChange={(time_label) => updateItem({ ...item, time_label })} />
              <TextField label="Alimentos e bebidas" placeholder="Ex.: café com leite, pão, ovos" value={item.foods} onChange={(foods) => updateItem({ ...item, foods })} />
              <TextField label="Quantidade" placeholder="Ex.: 2 fatias, 1 concha" value={item.amount} onChange={(amount) => updateItem({ ...item, amount })} />
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <TextField label="Modo de preparo" placeholder="Ex.: grelhado, com óleo, sem açúcar" value={item.preparation} onChange={(preparation) => updateItem({ ...item, preparation })} />
              <label className="text-xs text-muted-foreground">Observações
                <Textarea value={item.notes ?? ""} onChange={(event) => updateItem({ ...item, notes: event.target.value || null })} placeholder="Contexto útil: fome, local, repetição, marca, fim de semana…" className="mt-1 min-h-9 text-sm" />
              </label>
            </div>
            <div className="mt-3 flex justify-end">
              <DictationButton size="sm" label="Complementar por voz" onText={(text) => updateItem({ ...item, foods: item.foods ? `${item.foods} ${text}` : text })} />
            </div>
          </article>
        )) : (
          <div className="rounded-md border border-dashed border-border px-4 py-10 text-center">
            <Utensils className="mx-auto size-6 text-muted-foreground" />
            <p className="mt-3 text-sm text-muted-foreground">Nenhuma refeição registrada ainda.</p>
            <p className="mt-1 text-xs text-muted-foreground">Use a conversa da consulta, dite o recordatório ou adicione manualmente.</p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button type="button" variant="secondary" size="sm" onClick={() => addItem()}><Plus /> Adicionar refeição</Button>
        <p className="text-[11px] text-muted-foreground">{saveState === "saved" && lastSavedAt ? "Alterações sincronizadas." : "O autosave ocorre após a edição."}</p>
      </div>
    </div>
  );
}

function TextField({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string | null; onChange: (value: string | null) => void }) {
  return <label className="text-xs text-muted-foreground">{label}<Input value={value ?? ""} placeholder={placeholder} onChange={(event) => onChange(event.target.value || null)} className="mt-1 text-sm" /></label>;
}

function Summary({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <div className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-xs"><span className="flex items-center gap-1.5 text-muted-foreground">{icon}{label}</span><span className="font-medium tabular-nums">{value}</span></div>;
}

function RecallSaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === "error") return <button type="button" onClick={onRetry} className="text-xs text-destructive underline-offset-4 hover:underline">Falha ao salvar · tentar novamente</button>;
  if (state === "saving") return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Loader2 className="size-3 animate-spin" /> Salvando…</span>;
  if (state === "pending") return <span className="text-xs text-muted-foreground">Alterações pendentes</span>;
  return <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><Save className="size-3" /> Salvo</span>;
}
