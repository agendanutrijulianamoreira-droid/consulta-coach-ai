import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Building2,
  CheckCircle2,
  ChevronRight,
  CirclePlus,
  Layers3,
  PackageSearch,
  Plus,
  Save,
  Sparkles,
  Trash2,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/nutrios/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listRecipes } from "@/lib/nutrios/repository";
import {
  listMethods,
  newMethod,
  newPhase,
  removeMethod,
  saveMethod,
  type ClinicMethod,
  type MethodMaterial,
  type MethodPhase,
} from "@/modules/consultorio/method-store";
import { listFavoriteMaterials, materialCategoryLabel, type FavoriteMaterial } from "@/modules/favoritos/material-store";

// routeTree.gen.ts é regenerado pelo plugin durante o build ao detectar este arquivo.
// @ts-expect-error a rota nova ainda não existe no routeTree versionado antes da geração.
export const Route = createFileRoute("/consultorio")({
  head: () => ({ meta: [{ title: "Meu Consultório — Cach AI" }] }),
  component: ClinicOfficePage,
});

type OfficeTab = "metodo" | "produtos" | "financeiro";

const officeSections: Array<{
  id: OfficeTab;
  title: string;
  description: string;
  icon: typeof Layers3;
  available: boolean;
}> = [
  {
    id: "metodo",
    title: "Método",
    description: "Fases, metas, receitas e materiais clínicos.",
    icon: Layers3,
    available: true,
  },
  {
    id: "produtos",
    title: "Escada de produtos",
    description: "Ofertas, acompanhamento e precificação.",
    icon: PackageSearch,
    available: false,
  },
  {
    id: "financeiro",
    title: "Protocolos financeiros",
    description: "Condições, recorrência e regras comerciais.",
    icon: WalletCards,
    available: false,
  },
];

function ClinicOfficePage() {
  const [tab, setTab] = useState<OfficeTab>("metodo");

  return (
    <AppShell title="Meu Consultório">
      <div className="min-h-[calc(100vh-4rem)] bg-muted/20">
        <div className="mx-auto max-w-[1480px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <header className="mb-6 flex flex-col gap-5 border-b border-border/70 pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                <Building2 className="size-3.5" />
                Central de gestão
              </div>
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Meu Consultório</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
                Estruture sua operação clínica em um só lugar. Começamos pelo seu método e, depois, conectaremos produtos e regras financeiras.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 text-xs text-muted-foreground shadow-sm">
              <Sparkles className="size-4" />
              Estrutura clínica em construção
            </div>
          </header>

          <div className="grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="self-start xl:sticky xl:top-6">
              <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                <div className="border-b border-border px-4 py-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Gestão</p>
                  <p className="mt-1 text-sm font-medium">Áreas do consultório</p>
                </div>
                <nav className="p-2" aria-label="Áreas do Meu Consultório">
                  {officeSections.map((section) => {
                    const Icon = section.icon;
                    const active = tab === section.id;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setTab(section.id)}
                        className={`group flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors ${active ? "bg-accent text-accent-foreground" : "hover:bg-muted/60"}`}
                      >
                        <span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border ${active ? "border-border bg-background" : "border-transparent bg-muted/60"}`}>
                          <Icon className="size-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2 text-sm font-medium">
                            {section.title}
                            {!section.available ? <span className="rounded-full bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">Em breve</span> : null}
                          </span>
                          <span className="mt-1 block text-xs leading-4 text-muted-foreground">{section.description}</span>
                        </span>
                        <ChevronRight className={`mt-2 size-4 shrink-0 text-muted-foreground transition-transform ${active ? "translate-x-0.5" : "opacity-0 group-hover:opacity-100"}`} />
                      </button>
                    );
                  })}
                </nav>
              </div>
            </aside>

            <main className="min-w-0">
              {tab === "metodo" ? <MethodWorkspace /> : <ComingSoon tab={tab} />}
            </main>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function MethodWorkspace() {
  const [methods, setMethods] = useState<ClinicMethod[]>([]);
  const [draft, setDraft] = useState<ClinicMethod | null>(null);
  const [favoriteMaterials, setFavoriteMaterials] = useState<FavoriteMaterial[]>(() => listFavoriteMaterials());
  const recipes = useQuery({ queryKey: ["recipes"], queryFn: listRecipes });

  useEffect(() => {
    const stored = listMethods();
    setMethods(stored);
    setDraft(newMethod());
  }, []);

  useEffect(() => {
    const refreshMaterials = () => setFavoriteMaterials(listFavoriteMaterials());
    refreshMaterials();
    window.addEventListener("focus", refreshMaterials);
    window.addEventListener("storage", refreshMaterials);
    return () => {
      window.removeEventListener("focus", refreshMaterials);
      window.removeEventListener("storage", refreshMaterials);
    };
  }, []);

  const materials = useMemo<MethodMaterial[]>(() => [
    ...(recipes.data ?? []).map((item) => ({ id: item.id, type: "recipe" as const, label: item.name })),
    ...favoriteMaterials
      .filter((item) => item.status === "active" && item.title.trim())
      .map((item) => ({ id: item.id, type: "material" as const, label: `${materialCategoryLabel(item.category)} · ${item.title}` })),
  ], [favoriteMaterials, recipes.data]);

  const isSavedMethod = draft ? methods.some((method) => method.id === draft.id) : false;
  const activeMethods = methods.filter((method) => method.status === "active").length;

  const create = () => setDraft(newMethod());
  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      toast.error("Dê um nome ao método.");
      return;
    }
    const next = saveMethod({ ...draft, name: draft.name.trim() });
    setMethods(next);
    setDraft(newMethod());
    toast.success("Método salvo. Um novo cadastro já está pronto.");
  };
  const remove = () => {
    if (!draft) return;
    const next = removeMethod(draft.id);
    setMethods(next);
    setDraft(newMethod());
    toast.success("Método removido.");
  };

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        <div className="flex flex-col gap-5 border-b border-border px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <Layers3 className="size-3.5" />
              Arquitetura clínica
            </div>
            <h2 className="mt-1.5 text-xl font-semibold tracking-tight">Seu método</h2>
            <p className="mt-1 text-sm text-muted-foreground">Construa uma lógica de acompanhamento que possa ser repetida, ajustada e aplicada durante as consultas.</p>
          </div>
          <Button type="button" onClick={create} className="shrink-0">
            <CirclePlus /> Novo método
          </Button>
        </div>
        <div className="grid divide-y divide-border sm:grid-cols-3 sm:divide-x sm:divide-y-0">
          <Metric label="Métodos cadastrados" value={methods.length} />
          <Metric label="Métodos ativos" value={activeMethods} />
          <Metric label="Fases neste método" value={draft?.phases.length ?? 0} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="self-start overflow-hidden rounded-xl border border-border bg-background shadow-sm lg:sticky lg:top-6">
          <div className="flex items-center justify-between border-b border-border px-4 py-3.5">
            <div>
              <p className="text-sm font-semibold">Métodos cadastrados</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Clique para editar</p>
            </div>
            <span className="flex size-7 items-center justify-center rounded-full bg-muted text-xs font-semibold">{methods.length}</span>
          </div>
          <div className="max-h-[520px] overflow-y-auto p-2">
            {methods.map((method) => {
              const selected = draft?.id === method.id;
              return (
                <button
                  key={method.id}
                  type="button"
                  onClick={() => setDraft(structuredClone(method))}
                  className={`mb-1 w-full rounded-lg border px-3 py-3 text-left transition-colors last:mb-0 ${selected ? "border-border bg-accent" : "border-transparent hover:bg-muted/50"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{method.name}</span>
                    <StatusBadge status={method.status} />
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span>{method.phases.length} fase{method.phases.length === 1 ? "" : "s"}</span>
                    <span>•</span>
                    <span>{method.phases.reduce((total, phase) => total + phase.goals.length, 0)} metas</span>
                  </div>
                </button>
              );
            })}
            {!methods.length ? (
              <div className="px-3 py-8 text-center">
                <BookOpen className="mx-auto size-6 text-muted-foreground" />
                <p className="mt-3 text-sm font-medium">Nenhum método salvo</p>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">O primeiro método cadastrado aparecerá aqui.</p>
              </div>
            ) : null}
          </div>
          <div className="border-t border-border p-3">
            <Button type="button" variant="outline" className="w-full justify-start" onClick={create}>
              <Plus /> Cadastrar outro método
            </Button>
          </div>
        </aside>

        <section className="min-w-0 space-y-5">
          {!draft ? <EmptyMethod onCreate={create} /> : (
            <>
              <div className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
                <div className="flex flex-col gap-4 border-b border-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">{isSavedMethod ? "Editando método" : "Novo método"}</p>
                    <h3 className="mt-1 text-lg font-semibold">{draft.name || "Método sem nome"}</h3>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {isSavedMethod ? (
                      <Button type="button" variant="ghost" className="text-destructive hover:text-destructive" onClick={remove}>
                        <Trash2 /> Excluir
                      </Button>
                    ) : null}
                    <Button type="button" onClick={save}>
                      <Save /> {isSavedMethod ? "Salvar alterações" : "Cadastrar método"}
                    </Button>
                  </div>
                </div>

                <div className="grid gap-5 px-5 py-5 sm:px-6 md:grid-cols-[minmax(0,1fr)_210px]">
                  <div className="space-y-5">
                    <Field label="Nome do método" hint="Um nome curto, claro e fácil de reconhecer.">
                      <Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Ex.: Método Mulher em Equilíbrio" className="h-10" />
                    </Field>
                    <Field label="Descrição" hint="Defina a transformação e para quem esse método foi criado.">
                      <Textarea rows={4} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Ex.: acompanhamento estruturado para mulheres com..." />
                    </Field>
                  </div>
                  <Field label="Status" hint="Controle quando o método já pode ser utilizado.">
                    <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ClinicMethod["status"] })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">
                      <option value="draft">Em construção</option>
                      <option value="active">Ativo</option>
                      <option value="archived">Arquivado</option>
                    </select>
                  </Field>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Jornada do paciente</p>
                  <h3 className="mt-1 text-lg font-semibold">Fases do método</h3>
                  <p className="mt-1 text-sm text-muted-foreground">Cada fase concentra um objetivo, metas e os conteúdos que você deseja entregar.</p>
                </div>
                <Button type="button" variant="outline" onClick={() => setDraft({ ...draft, phases: [...draft.phases, newPhase(draft.phases.length + 1)] })}>
                  <Plus /> Adicionar fase
                </Button>
              </div>

              <div className="space-y-4">
                {draft.phases.map((phase, index) => (
                  <PhaseEditor
                    key={phase.id}
                    phase={phase}
                    index={index}
                    total={draft.phases.length}
                    materials={materials}
                    onChange={(nextPhase) => setDraft({ ...draft, phases: draft.phases.map((item) => item.id === phase.id ? nextPhase : item) })}
                    onMove={(direction) => setDraft({ ...draft, phases: movePhase(draft.phases, index, direction) })}
                    onRemove={() => setDraft({ ...draft, phases: draft.phases.filter((item) => item.id !== phase.id) })}
                  />
                ))}
              </div>

              <div className="rounded-xl border border-dashed border-border bg-background/60 px-5 py-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted"><WalletCards className="size-4 text-muted-foreground" /></div>
                  <div>
                    <p className="text-sm font-medium">Protocolos relacionados</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Esta área já está reservada para vincular protocolos clínicos e financeiros ao método quando avançarmos essa etapa.</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function PhaseEditor({ phase, index, total, materials, onChange, onMove, onRemove }: {
  phase: MethodPhase;
  index: number;
  total: number;
  materials: MethodMaterial[];
  onChange: (phase: MethodPhase) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
}) {
  const [goal, setGoal] = useState("");
  const [search, setSearch] = useState("");
  const [isMaterialPickerOpen, setIsMaterialPickerOpen] = useState(false);
  const filtered = materials.filter((item) => item.label.toLowerCase().includes(search.toLowerCase())).slice(0, 24);

  const addGoal = () => {
    const value = goal.trim();
    if (!value) return;
    onChange({ ...phase, goals: [...phase.goals, value] });
    setGoal("");
  };

  const toggleMaterial = (material: MethodMaterial) => {
    const selected = phase.materials.some((item) => item.id === material.id && item.type === material.type);
    onChange({
      ...phase,
      materials: selected
        ? phase.materials.filter((item) => !(item.id === material.id && item.type === material.type))
        : [...phase.materials, material],
    });
  };

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
      <div className="flex items-start gap-4 border-b border-border px-5 py-4 sm:px-6">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-foreground text-sm font-semibold text-background">{index + 1}</div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">Fase {index + 1}</p>
          <Input value={phase.title} onChange={(event) => onChange({ ...phase, title: event.target.value })} className="mt-1 h-9 max-w-lg border-0 px-0 text-base font-semibold shadow-none focus-visible:ring-0" />
        </div>
        <div className="flex shrink-0 gap-1">
          <Button type="button" size="icon" variant="ghost" disabled={index === 0} onClick={() => onMove(-1)} title="Mover fase para cima"><ArrowUp /></Button>
          <Button type="button" size="icon" variant="ghost" disabled={index === total - 1} onClick={() => onMove(1)} title="Mover fase para baixo"><ArrowDown /></Button>
          <Button type="button" size="icon" variant="ghost" className="text-destructive hover:text-destructive" onClick={onRemove} title="Excluir fase"><Trash2 /></Button>
        </div>
      </div>

      <div className="space-y-6 px-5 py-5 sm:px-6">
        <Field label="Objetivo da fase" hint="O que deve mudar ou estar resolvido antes de avançar para a próxima fase?">
          <Textarea rows={3} value={phase.objective} onChange={(event) => onChange({ ...phase, objective: event.target.value })} placeholder="Descreva o objetivo clínico desta fase..." />
        </Field>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Metas</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Ações objetivas para esta fase.</p>
              </div>
              <span className="text-xs font-medium text-muted-foreground">{phase.goals.length}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Input value={goal} onChange={(event) => setGoal(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addGoal(); } }} placeholder="Escreva uma meta" />
              <Button type="button" size="icon" variant="outline" onClick={addGoal}><Plus /></Button>
            </div>
            <div className="mt-3 space-y-2">
              {phase.goals.map((item, goalIndex) => (
                <div key={`${item}-${goalIndex}`} className="flex items-center gap-2 rounded-md border border-border/70 bg-background px-3 py-2.5 text-sm">
                  <CheckCircle2 className="size-4 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">{item}</span>
                  <Button type="button" variant="ghost" size="icon" className="size-7 shrink-0 text-muted-foreground" onClick={() => onChange({ ...phase, goals: phase.goals.filter((_, current) => current !== goalIndex) })}><Trash2 /></Button>
                </div>
              ))}
              {!phase.goals.length ? <p className="py-3 text-center text-xs text-muted-foreground">Nenhuma meta definida ainda.</p> : null}
            </div>
          </div>

          <div className="rounded-lg border border-border/80 bg-muted/20 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Receitas e materiais</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Entregáveis selecionados dos Favoritos.</p>
              </div>
              <span className="text-xs font-medium text-muted-foreground">{phase.materials.length}</span>
            </div>

            {phase.materials.length ? (
              <div className="mt-3 space-y-2">
                {phase.materials.map((material) => (
                  <button
                    key={`${material.type}-${material.id}`}
                    type="button"
                    onClick={() => toggleMaterial(material)}
                    className="flex w-full items-center gap-3 rounded-md border border-border/70 bg-background px-3 py-2.5 text-left text-sm hover:bg-muted/40"
                  >
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-muted"><BookOpen className="size-3.5" /></span>
                    <span className="min-w-0 flex-1 truncate">{material.label}</span>
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{materialTypeLabel(material.type)}</span>
                  </button>
                ))}
              </div>
            ) : <p className="mt-3 py-3 text-center text-xs text-muted-foreground">Nenhuma receita ou material selecionado.</p>}

            <Button type="button" variant="outline" className="mt-3 w-full justify-between" onClick={() => setIsMaterialPickerOpen((open) => !open)}>
              <span className="flex items-center gap-2"><Plus /> {isMaterialPickerOpen ? "Fechar biblioteca" : "Adicionar receitas e materiais"}</span>
              <ChevronRight className={`size-4 transition-transform ${isMaterialPickerOpen ? "rotate-90" : ""}`} />
            </Button>

            {isMaterialPickerOpen ? (
              <div className="mt-3 rounded-lg border border-border bg-background p-3">
                <Input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Escreva para buscar..." />
                <div className="mt-2 max-h-56 overflow-auto">
                  {filtered.map((material) => {
                    const active = phase.materials.some((item) => item.id === material.id && item.type === material.type);
                    return (
                      <button key={`${material.type}-${material.id}`} type="button" onClick={() => toggleMaterial(material)} className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm ${active ? "bg-accent" : "hover:bg-muted/50"}`}>
                        <span className="min-w-0 flex-1 truncate">{material.label}</span>
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{materialTypeLabel(material.type)}</span>
                      </button>
                    );
                  })}
                  {!filtered.length ? <p className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhuma receita ou material encontrado.</p> : null}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="px-5 py-4 sm:px-6">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight">{value}</p>
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      {hint ? <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">{hint}</span> : null}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function StatusBadge({ status }: { status: ClinicMethod["status"] }) {
  const label = statusLabel(status);
  const className = status === "active"
    ? "border-border bg-background text-foreground"
    : status === "archived"
      ? "border-border bg-muted text-muted-foreground"
      : "border-border bg-muted/50 text-muted-foreground";
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${className}`}>{label}</span>;
}

function movePhase(phases: MethodPhase[], index: number, direction: -1 | 1) {
  const target = index + direction;
  if (target < 0 || target >= phases.length) return phases;
  const next = [...phases];
  const current = next[index];
  const swap = next[target];
  if (!current || !swap) return phases;
  next[index] = swap;
  next[target] = current;
  return next;
}

function EmptyMethod({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-background p-12 text-center shadow-sm">
      <Building2 className="mx-auto size-8 text-muted-foreground" />
      <h2 className="mt-4 text-base font-semibold">Construa seu método clínico</h2>
      <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">Organize fases, objetivos, metas e materiais reutilizáveis.</p>
      <Button type="button" className="mt-5" onClick={onCreate}><CirclePlus /> Criar primeiro método</Button>
    </div>
  );
}

function ComingSoon({ tab }: { tab: Exclude<OfficeTab, "metodo"> }) {
  const product = tab === "produtos";
  return (
    <div className="rounded-xl border border-border bg-background p-8 shadow-sm sm:p-10">
      <div className="flex size-11 items-center justify-center rounded-lg bg-muted">
        {product ? <PackageSearch className="size-5" /> : <WalletCards className="size-5" />}
      </div>
      <p className="mt-5 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">Próxima etapa</p>
      <h2 className="mt-1 text-xl font-semibold">{product ? "Escada de produtos e precificação" : "Protocolos financeiros"}</h2>
      <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
        {product
          ? "Aqui vamos organizar ofertas, níveis de acompanhamento, custos, margem e preços com a mesma lógica do seu método clínico."
          : "Aqui vamos organizar condições, recorrência, descontos e regras financeiras do consultório."}
      </p>
    </div>
  );
}

function statusLabel(status: ClinicMethod["status"]) {
  return status === "active" ? "Ativo" : status === "archived" ? "Arquivado" : "Em construção";
}

function materialTypeLabel(type: MethodMaterial["type"]) {
  return type === "recipe" ? "receita" : "material";
}
