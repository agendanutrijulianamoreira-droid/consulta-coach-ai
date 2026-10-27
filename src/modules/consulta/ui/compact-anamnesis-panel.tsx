import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, ChevronDown, Heart, Loader2, Plus, RefreshCw, RotateCcw, Sparkles, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import * as db from "@/lib/nutrios/repository";
import { describeAiError } from "@/lib/nutrios/ai-error";
import {
  archiveAnamnesisVersion,
  listAnamnesisVersions,
  listFavoriteAnamneses,
  removeFavoriteAnamnesis,
  saveFavoriteAnamnesis,
  type FavoriteAnamnesis,
} from "@/lib/nutrios/anamnesis-library-repository";
import {
  ANAMNESIS_FIELDS,
  ANAMNESIS_SECTIONS,
  type AnamnesisField,
  type AnamnesisFields,
  type AnamnesisKey,
} from "@/lib/nutrios/types";
import { extractClinicalAnamnesis } from "@/modules/consulta/application/anamnesis.functions";
import { mergeAnamnesisSuggestions } from "@/modules/consulta/domain/anamnesis";

const QUICK_KEYS = [
  "objetivo_consulta",
  "queixa_principal",
  "sintomas",
  "doencas",
  "medicamentos",
  "alergias",
  "intolerancias",
  "rotina",
  "sono",
  "exercicio",
  "agua",
  "evacuacao",
  "refeicoes_padrao",
  "restricoes_alimentares",
  "dificuldades",
] satisfies AnamnesisKey[];
const QUICK_KEY_SET = new Set<AnamnesisKey>(QUICK_KEYS);

export function CompactAnamnesisPanel({
  consultationId,
  fields,
  onChange,
  transcript,
  canAutoExtract,
}: {
  consultationId: string;
  fields: AnamnesisFields;
  onChange: (next: AnamnesisFields) => void;
  transcript: string;
  canAutoExtract: boolean;
}) {
  const extract = useServerFn(extractClinicalAnamnesis);
  const queryClient = useQueryClient();
  const [extracting, setExtracting] = useState(false);
  const [showComplementary, setShowComplementary] = useState(false);
  const [openSection, setOpenSection] = useState<string | null>(null);
  const [favoriteName, setFavoriteName] = useState("Anamnese base");
  const [libraryBusy, setLibraryBusy] = useState(false);
  const lastAutoTranscript = useRef("");

  const favorites = useQuery({ queryKey: ["favorite-anamneses"], queryFn: listFavoriteAnamneses });
  const versions = useQuery({
    queryKey: ["anamnesis-versions", consultationId],
    queryFn: () => listAnamnesisVersions(consultationId),
  });

  const quickDefinitions = useMemo(
    () => QUICK_KEYS.map((key) => ANAMNESIS_FIELDS.find((item) => item.key === key)).filter(Boolean),
    [],
  );

  const apply = useCallback((next: AnamnesisFields) => {
    onChange(next);
  }, [onChange]);

  const update = (key: AnamnesisKey, patch: Partial<AnamnesisField>) => {
    const current = fields[key] ?? { value: "", status: "editado" as const, source: "profissional" };
    apply({ ...fields, [key]: { ...current, ...patch } });
  };

  const extractFromConversation = useCallback(async (silent = false) => {
    if (!transcript.trim() || extracting) return;
    setExtracting(true);
    try {
      const result = await extract({ data: { transcript } });
      const next = mergeAnamnesisSuggestions(fields, result.fields);
      apply(next);
      await db.saveAnamnesis(consultationId, next);
      if (!silent) toast.success("Anamnese atualizada a partir da conversa.");
    } catch (error) {
      if (!silent) toast.error(describeAiError(error, "Preencha os campos manualmente enquanto isso."));
    } finally {
      setExtracting(false);
    }
  }, [apply, consultationId, extract, extracting, fields, transcript]);

  useEffect(() => {
    if (!canAutoExtract || !transcript.trim() || transcript === lastAutoTranscript.current || extracting) return;
    lastAutoTranscript.current = transcript;
    const timer = window.setTimeout(() => void extractFromConversation(true), 350);
    return () => window.clearTimeout(timer);
  }, [canAutoExtract, extractFromConversation, extracting, transcript]);

  const acceptSuggestions = () => {
    const next: AnamnesisFields = { ...fields };
    let changed = false;
    for (const item of ANAMNESIS_FIELDS) {
      const field = fields[item.key];
      if (field?.value.trim() && field.status === "sugerido") {
        next[item.key] = { ...field, status: "aceito" };
        changed = true;
      }
    }
    if (changed) apply(next);
  };

  const newAnamnesis = async () => {
    setLibraryBusy(true);
    try {
      await archiveAnamnesisVersion(consultationId, fields);
      await db.saveAnamnesis(consultationId, {});
      apply({});
      await queryClient.invalidateQueries({ queryKey: ["anamnesis-versions", consultationId] });
      toast.success("Nova anamnese iniciada. A versão anterior foi preservada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível iniciar uma nova anamnese.");
    } finally {
      setLibraryBusy(false);
    }
  };

  const favoriteCurrent = async () => {
    if (!Object.values(fields).some((field) => field?.value.trim())) {
      toast.info("Preencha algum campo antes de favoritar.");
      return;
    }
    setLibraryBusy(true);
    try {
      await saveFavoriteAnamnesis(consultationId, favoriteName, fields);
      await queryClient.invalidateQueries({ queryKey: ["favorite-anamneses"] });
      toast.success("Anamnese salva nos favoritos.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível favoritar a anamnese.");
    } finally {
      setLibraryBusy(false);
    }
  };

  const loadFavorite = async (favorite: FavoriteAnamnesis) => {
    setLibraryBusy(true);
    try {
      await archiveAnamnesisVersion(consultationId, fields);
      apply(favorite.fields);
      await db.saveAnamnesis(consultationId, favorite.fields);
      await queryClient.invalidateQueries({ queryKey: ["anamnesis-versions", consultationId] });
      toast.success(`Modelo “${favorite.name}” carregado.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar o favorito.");
    } finally {
      setLibraryBusy(false);
    }
  };

  const deleteFavorite = async (favorite: FavoriteAnamnesis) => {
    setLibraryBusy(true);
    try {
      await removeFavoriteAnamnesis(favorite);
      await queryClient.invalidateQueries({ queryKey: ["favorite-anamneses"] });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível remover o favorito.");
    } finally {
      setLibraryBusy(false);
    }
  };

  const loadVersion = async (versionFields: AnamnesisFields) => {
    await archiveAnamnesisVersion(consultationId, fields);
    apply(versionFields);
    await db.saveAnamnesis(consultationId, versionFields);
    toast.success("Versão anterior restaurada.");
  };

  const filledQuick = QUICK_KEYS.filter((key) => Boolean(fields[key]?.value.trim())).length;
  const suggested = Object.values(fields).filter((field) => field?.value.trim() && field.status === "sugerido").length;

  return (
    <div className="space-y-4">
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold">Anamnese essencial</h2>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">
              Comece pelo que muda a conduta. Os campos complementares ficam recolhidos e podem ser abertos apenas quando forem necessários.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" disabled={extracting || !transcript.trim()} onClick={() => void extractFromConversation(false)}>
              {extracting ? <Loader2 className="animate-spin" /> : <RefreshCw />} Atualizar da conversa
            </Button>
            <Button type="button" variant="secondary" size="sm" disabled={libraryBusy} onClick={() => void newAnamnesis()}>
              <Plus /> Nova anamnese
            </Button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>{filledQuick}/{QUICK_KEYS.length} campos essenciais preenchidos</span>
          <span>·</span>
          <span>Salvamento automático ativo</span>
          {suggested ? <Button type="button" variant="ghost" size="sm" className="h-7" onClick={acceptSuggestions}><Check /> Aceitar {suggested} sugestão{suggested === 1 ? "" : "ões"}</Button> : null}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        {quickDefinitions.map((definition) => {
          if (!definition) return null;
          const field = fields[definition.key];
          return (
            <label key={definition.key} className="rounded-md border border-border p-3 text-xs text-muted-foreground">
              <span className="flex items-center justify-between gap-2">
                <span>{definition.label}</span>
                {field?.status === "sugerido" && field.value ? <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">IA</span> : null}
              </span>
              <Textarea
                value={field?.value ?? ""}
                onChange={(event) => update(definition.key, { value: event.target.value, status: "editado", source: "profissional" })}
                placeholder="Preencher ou deixar a conversa organizar"
                className="mt-2 min-h-20 text-sm text-foreground"
              />
            </label>
          );
        })}
      </section>

      <section className="rounded-lg border border-border">
        <button type="button" className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left" onClick={() => setShowComplementary((value) => !value)}>
          <span><span className="block text-sm font-medium">Campos complementares</span><span className="mt-0.5 block text-xs text-muted-foreground">Abra somente os blocos relevantes para este paciente.</span></span>
          <ChevronDown className={`size-4 text-muted-foreground transition-transform ${showComplementary ? "rotate-180" : ""}`} />
        </button>
        {showComplementary ? (
          <div className="border-t border-border p-3">
            {ANAMNESIS_SECTIONS.map((section) => {
              const keys = section.fields.filter((key) => !QUICK_KEY_SET.has(key));
              if (!keys.length) return null;
              const isOpen = openSection === section.id;
              return (
                <div key={section.id} className="border-b border-border last:border-b-0">
                  <button type="button" className="flex w-full items-center justify-between py-3 text-left text-sm" onClick={() => setOpenSection(isOpen ? null : section.id)}>
                    <span>{section.title}</span><ChevronDown className={`size-4 text-muted-foreground ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen ? <div className="grid gap-3 pb-4 md:grid-cols-2">{keys.map((key) => {
                    const definition = ANAMNESIS_FIELDS.find((item) => item.key === key);
                    if (!definition) return null;
                    const field = fields[key];
                    return <label key={key} className="text-xs text-muted-foreground">{definition.label}<Textarea value={field?.value ?? ""} onChange={(event) => update(key, { value: event.target.value, status: "editado", source: "profissional" })} className="mt-1 min-h-16 text-sm text-foreground" /></label>;
                  })}</div> : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </section>

      <section className="rounded-lg border border-border p-4">
        <div className="flex flex-wrap items-end gap-2">
          <label className="min-w-[220px] flex-1 text-xs text-muted-foreground">Nome do favorito<Input value={favoriteName} onChange={(event) => setFavoriteName(event.target.value)} className="mt-1" /></label>
          <Button type="button" size="sm" variant="outline" disabled={libraryBusy} onClick={() => void favoriteCurrent()}><Heart /> Favoritar anamnese atual</Button>
        </div>
        <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Pré-carregar dos favoritos</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {favorites.data?.map((favorite) => <div key={favorite.id} className="inline-flex items-center rounded-md border border-border"><Button type="button" size="sm" variant="ghost" disabled={libraryBusy} onClick={() => void loadFavorite(favorite)}><Heart className="fill-current" /> {favorite.name}</Button><Button type="button" size="icon" variant="ghost" className="size-8 text-muted-foreground" disabled={libraryBusy} onClick={() => void deleteFavorite(favorite)} aria-label={`Remover ${favorite.name}`}><Trash2 /></Button></div>)}
            {!favorites.isLoading && !favorites.data?.length ? <span className="text-xs text-muted-foreground">Nenhuma anamnese favorita ainda.</span> : null}
          </div>
        </div>
        {versions.data?.length ? <div className="mt-4 border-t border-border pt-3"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Versões preservadas nesta consulta</p><div className="mt-2 flex flex-wrap gap-2">{versions.data.slice(0, 5).map((version) => <Button key={version.id} type="button" size="sm" variant="ghost" onClick={() => void loadVersion(version.fields)}><RotateCcw /> {formatDateTime(version.savedAt)}</Button>)}</div></div> : null}
      </section>

      {canAutoExtract && transcript.trim() ? <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground"><Sparkles className="size-3.5" /> A anamnese acompanha os trechos transcritos durante a consulta sem sobrescrever campos revisados.</p> : null}
    </div>
  );
}

function formatDateTime(value: string) {
  if (!value) return "versão anterior";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "versão anterior";
  return date.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}
