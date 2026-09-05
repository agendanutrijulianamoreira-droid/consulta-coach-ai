import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, BookOpen, CheckCircle2, Loader2, Save, Sparkles, WandSparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/nutrios/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listRecipes } from "@/lib/nutrios/repository";
import { generateClinicMethod, type GeneratedMethodDraft } from "@/modules/consultorio/method-generator.functions";
import { newMethod, newPhase, saveMethod, type MethodMaterial } from "@/modules/consultorio/method-store";
import { listFavoriteMaterials, materialCategoryLabel, type FavoriteMaterial } from "@/modules/favoritos/material-store";


export const Route = createFileRoute("/consultorio/metodo/inteligente")({
  head: () => ({ meta: [{ title: "Criar método com IA — Cach AI" }] }),
  component: IntelligentMethodBuilder,
});

type Brief = {
  name: string;
  audience: string;
  objective: string;
  duration: string;
  phaseCount: number;
  priorities: string;
  notes: string;
};

const initialBrief: Brief = {
  name: "",
  audience: "",
  objective: "",
  duration: "",
  phaseCount: 3,
  priorities: "",
  notes: "",
};

function IntelligentMethodBuilder() {
  const generate = useServerFn(generateClinicMethod);
  const recipes = useQuery({ queryKey: ["recipes"], queryFn: listRecipes });
  const [favoriteMaterials] = useState<FavoriteMaterial[]>(() => listFavoriteMaterials());
  const [brief, setBrief] = useState<Brief>(initialBrief);
  const [draft, setDraft] = useState<GeneratedMethodDraft | null>(null);
  const [generating, setGenerating] = useState(false);

  const catalog = useMemo(() => [
    ...(recipes.data ?? []).map((item) => ({
      key: `recipe:${item.id}`,
      id: item.id,
      type: "recipe" as const,
      label: item.name,
    })),
    ...favoriteMaterials
      .filter((item) => item.status === "active" && item.title.trim())
      .map((item) => ({
        key: `material:${item.id}`,
        id: item.id,
        type: "material" as const,
        label: `${materialCategoryLabel(item.category)} · ${item.title}`,
      })),
  ], [favoriteMaterials, recipes.data]);

  const byKey = useMemo(() => new Map(catalog.map((item) => [item.key, item])), [catalog]);

  const handleGenerate = async () => {
    if (!brief.audience.trim() || !brief.objective.trim()) {
      toast.error("Informe pelo menos o público e o objetivo principal do método.");
      return;
    }
    setGenerating(true);
    try {
      const result = await generate({
        data: {
          ...brief,
          name: brief.name.trim(),
          audience: brief.audience.trim(),
          objective: brief.objective.trim(),
          duration: brief.duration.trim(),
          priorities: brief.priorities.trim(),
          notes: brief.notes.trim(),
          catalog: catalog.map(({ key, type, label }) => ({ key, type, label })),
        },
      });
      setDraft(result.draft);
      toast.success("Rascunho do método gerado. Revise antes de salvar.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o método agora.");
    } finally {
      setGenerating(false);
    }
  };

  const saveDraft = () => {
    if (!draft) return;
    const base = newMethod();
    const phases = draft.phases.map((phase, index) => {
      const shell = newPhase(index + 1);
      const materials: MethodMaterial[] = phase.materialKeys
        .map((key) => byKey.get(key))
        .filter((item): item is NonNullable<typeof item> => Boolean(item))
        .map((item) => ({ id: item.id, type: item.type, label: item.label }));
      return {
        ...shell,
        title: phase.title,
        objective: phase.objective,
        goals: phase.goals,
        materials,
      };
    });
    saveMethod({
      ...base,
      name: draft.name.trim() || "Novo método",
      description: draft.description,
      status: "draft",
      phases,
    });
    toast.success("Método salvo como rascunho.");
    window.location.href = "/consultorio";
  };

  return (
    <AppShell title="Criar método com IA">
      <div className="min-h-[calc(100vh-4rem)] bg-muted/20">
        <div className="mx-auto max-w-[1320px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-6 flex flex-col gap-4 border-b border-border/70 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <a href="/consultorio" className="mb-3 inline-flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground">
                <ArrowLeft className="size-3.5" /> Voltar para Meu Consultório
              </a>
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                <WandSparkles className="size-3.5" /> Rota inteligente
              </div>
              <h1 className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">Crie seu método em poucos minutos</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                Dê o contexto estratégico. O Cach AI organiza fases, objetivos e metas e usa apenas receitas e materiais que já existem na sua biblioteca.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-background px-4 py-3 text-xs text-muted-foreground shadow-sm">
              <span className="font-semibold text-foreground">{recipes.data?.length ?? 0}</span> receitas · <span className="font-semibold text-foreground">{favoriteMaterials.filter((item) => item.status === "active").length}</span> materiais disponíveis
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[430px_minmax(0,1fr)]">
            <section className="self-start overflow-hidden rounded-xl border border-border bg-background shadow-sm xl:sticky xl:top-6">
              <div className="border-b border-border px-5 py-4">
                <p className="text-sm font-semibold">Brief rápido</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">Preencha o essencial. Quanto mais clara a intenção, melhor a primeira versão.</p>
              </div>
              <div className="space-y-4 p-5">
                <Field label="Nome ou tema" optional>
                  <Input value={brief.name} onChange={(event) => setBrief({ ...brief, name: event.target.value })} placeholder="Ex.: Método Mulher em Equilíbrio" />
                </Field>
                <Field label="Para quem é este método?">
                  <Textarea rows={3} value={brief.audience} onChange={(event) => setBrief({ ...brief, audience: event.target.value })} placeholder="Ex.: mulheres de 30 a 45 anos com rotina corrida, dificuldade de emagrecimento e sintomas hormonais..." />
                </Field>
                <Field label="Objetivo principal">
                  <Textarea rows={3} value={brief.objective} onChange={(event) => setBrief({ ...brief, objective: event.target.value })} placeholder="Que transformação o acompanhamento precisa organizar?" />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                  <Field label="Duração" optional>
                    <Input value={brief.duration} onChange={(event) => setBrief({ ...brief, duration: event.target.value })} placeholder="Ex.: 12 semanas" />
                  </Field>
                  <Field label="Número de fases">
                    <select value={brief.phaseCount} onChange={(event) => setBrief({ ...brief, phaseCount: Number(event.target.value) })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                      {[1, 2, 3, 4, 5, 6].map((count) => <option key={count} value={count}>{count} fase{count === 1 ? "" : "s"}</option>)}
                    </select>
                  </Field>
                </div>
                <Field label="O que deve ser prioridade?" optional>
                  <Textarea rows={3} value={brief.priorities} onChange={(event) => setBrief({ ...brief, priorities: event.target.value })} placeholder="Ex.: adesão, sono, intestino, rotina alimentar, comportamento..." />
                </Field>
                <Field label="Regras ou observações suas" optional>
                  <Textarea rows={3} value={brief.notes} onChange={(event) => setBrief({ ...brief, notes: event.target.value })} placeholder="Ex.: não quero abordagem restritiva; metas simples; primeira fase mais organizacional..." />
                </Field>
                <Button type="button" className="w-full" size="lg" disabled={generating} onClick={() => void handleGenerate()}>
                  {generating ? <Loader2 className="animate-spin" /> : <Sparkles />} {generating ? "Montando método..." : "Gerar método inteligente"}
                </Button>
                <p className="text-[11px] leading-5 text-muted-foreground">A IA gera um rascunho. Nada é ativado nem enviado a pacientes sem sua revisão.</p>
              </div>
            </section>

            <main className="min-w-0">
              {!draft ? <EmptyPreview /> : (
                <div className="space-y-5">
                  <section className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                    <div className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Rascunho gerado</p>
                        <h2 className="mt-1 text-xl font-semibold">{draft.name}</h2>
                      </div>
                      <Button type="button" onClick={saveDraft}><Save /> Salvar no Método</Button>
                    </div>
                    <div className="space-y-4 px-5 py-5 sm:px-6">
                      <Field label="Nome do método">
                        <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
                      </Field>
                      <Field label="Descrição">
                        <Textarea rows={4} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
                      </Field>
                    </div>
                  </section>

                  <div className="space-y-4">
                    {draft.phases.map((phase, phaseIndex) => (
                      <section key={phaseIndex} className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                        <div className="flex items-center gap-4 border-b border-border px-5 py-4 sm:px-6">
                          <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-sm font-semibold text-background">{phaseIndex + 1}</div>
                          <div className="min-w-0 flex-1">
                            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Fase {phaseIndex + 1}</p>
                            <Input value={phase.title} onChange={(event) => updatePhase(setDraft, draft, phaseIndex, { title: event.target.value })} className="mt-1 h-9 border-0 px-0 text-base font-semibold shadow-none focus-visible:ring-0" />
                          </div>
                        </div>
                        <div className="space-y-5 px-5 py-5 sm:px-6">
                          <Field label="Objetivo">
                            <Textarea rows={3} value={phase.objective} onChange={(event) => updatePhase(setDraft, draft, phaseIndex, { objective: event.target.value })} />
                          </Field>
                          <div className="grid gap-5 lg:grid-cols-2">
                            <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
                              <p className="text-sm font-semibold">Metas sugeridas</p>
                              <div className="mt-3 space-y-2">
                                {phase.goals.map((goal, goalIndex) => (
                                  <div key={goalIndex} className="flex items-start gap-2 rounded-md border border-border/70 bg-background px-3 py-2.5 text-sm">
                                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                    <Textarea rows={2} value={goal} onChange={(event) => updateGoal(setDraft, draft, phaseIndex, goalIndex, event.target.value)} className="min-h-0 border-0 p-0 shadow-none focus-visible:ring-0" />
                                  </div>
                                ))}
                              </div>
                            </div>
                            <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
                              <p className="text-sm font-semibold">Receitas e materiais selecionados</p>
                              <p className="mt-0.5 text-xs text-muted-foreground">Somente itens existentes nos Favoritos.</p>
                              <div className="mt-3 space-y-2">
                                {phase.materialKeys.map((key) => {
                                  const item = byKey.get(key);
                                  return item ? <div key={key} className="flex items-center gap-3 rounded-md border border-border/70 bg-background px-3 py-2.5 text-sm"><BookOpen className="size-4 text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{item.label}</span><span className="text-[10px] font-semibold uppercase text-muted-foreground">{item.type === "recipe" ? "receita" : "material"}</span></div> : null;
                                })}
                                {!phase.materialKeys.length ? <p className="py-4 text-center text-xs text-muted-foreground">A IA não encontrou um item claramente pertinente nesta fase.</p> : null}
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>
                    ))}
                  </div>
                </div>
              )}
            </main>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function EmptyPreview() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-background p-8 text-center shadow-sm sm:p-12">
      <div className="mx-auto flex size-12 items-center justify-center rounded-xl bg-muted"><WandSparkles className="size-5 text-muted-foreground" /></div>
      <h2 className="mt-4 text-lg font-semibold">Seu método vai aparecer aqui</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted-foreground">Preencha o brief ao lado. O Cach AI transforma suas regras em uma estrutura pronta para você revisar e ajustar.</p>
    </div>
  );
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center gap-2 text-sm font-medium">{label}{optional ? <span className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground">opcional</span> : null}</span>
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function updatePhase(
  setDraft: React.Dispatch<React.SetStateAction<GeneratedMethodDraft | null>>,
  draft: GeneratedMethodDraft,
  phaseIndex: number,
  patch: Partial<GeneratedMethodDraft["phases"][number]>,
) {
  setDraft({ ...draft, phases: draft.phases.map((phase, index) => index === phaseIndex ? { ...phase, ...patch } : phase) });
}

function updateGoal(
  setDraft: React.Dispatch<React.SetStateAction<GeneratedMethodDraft | null>>,
  draft: GeneratedMethodDraft,
  phaseIndex: number,
  goalIndex: number,
  value: string,
) {
  const phase = draft.phases[phaseIndex];
  if (!phase) return;
  const goals = phase.goals.map((goal, index) => index === goalIndex ? value : goal);
  updatePhase(setDraft, draft, phaseIndex, { goals });
}
