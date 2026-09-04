import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Building2, Layers3, PackageSearch, Plus, Save, Trash2, WalletCards } from "lucide-react";
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

function ClinicOfficePage() {
  const [tab, setTab] = useState<OfficeTab>("metodo");
  return (
    <AppShell title="Meu Consultório">
      <div className="border-b border-border px-4 pt-6 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Gestão do consultório</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight">Meu Consultório</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Organize o método clínico, produtos e estrutura financeira sem misturar gestão com o prontuário.</p>
          <nav className="mt-5 flex flex-wrap gap-1" aria-label="Áreas do Meu Consultório">
            <Tab active={tab === "metodo"} onClick={() => setTab("metodo")}><Layers3 /> Método</Tab>
            <Tab active={tab === "produtos"} onClick={() => setTab("produtos")}><PackageSearch /> Escada de produtos e precificação</Tab>
            <Tab active={tab === "financeiro"} onClick={() => setTab("financeiro")}><WalletCards /> Protocolos financeiros</Tab>
          </nav>
        </div>
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">
        {tab === "metodo" ? <MethodWorkspace /> : <ComingSoon tab={tab} />}
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
    toast.success("Método salvo. Um novo cadastro já está pronto ao lado.");
  };
  const remove = () => {
    if (!draft) return;
    const next = removeMethod(draft.id);
    setMethods(next);
    setDraft(next[0] ? structuredClone(next[0]) : null);
    toast.success("Método removido.");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[250px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <Button type="button" className="w-full justify-start" onClick={create}><Plus /> Novo método</Button>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">Seus métodos</div>
          <div className="divide-y divide-border">
            {methods.map((method) => <button key={method.id} type="button" onClick={() => setDraft(structuredClone(method))} className={`w-full px-3 py-3 text-left hover:bg-muted/40 ${draft?.id === method.id ? "bg-accent" : ""}`}><span className="block truncate text-sm font-medium">{method.name}</span><span className="mt-1 block text-xs text-muted-foreground">{method.phases.length} fase{method.phases.length === 1 ? "" : "s"} · {statusLabel(method.status)}</span></button>)}
            {!methods.length ? <p className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhum método criado ainda.</p> : null}
          </div>
        </div>
      </aside>

      <main>
        {!draft ? <EmptyMethod onCreate={create} /> : <div className="space-y-5">
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estrutura do método</p><h2 className="mt-1 text-lg font-semibold">{draft.name || "Novo método"}</h2></div>
              <div className="flex gap-2">{isSavedMethod ? <Button type="button" variant="outline" className="text-destructive" onClick={remove}><Trash2 /> Excluir</Button> : null}<Button type="button" onClick={save}><Save /> Salvar método</Button></div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="space-y-1.5 text-xs text-muted-foreground">Nome do método<Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
              <label className="space-y-1.5 text-xs text-muted-foreground">Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ClinicMethod["status"] })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="draft">Em construção</option><option value="active">Ativo</option><option value="archived">Arquivado</option></select></label>
            </div>
            <label className="mt-4 block space-y-1.5 text-xs text-muted-foreground">Descrição<Textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Qual transformação este método organiza e para quem ele foi desenhado?" /></label>
          </section>

          <div className="flex items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Fases do método</h3><p className="mt-1 text-xs text-muted-foreground">Objetivos, metas e materiais podem mudar em cada fase.</p></div><Button type="button" variant="outline" onClick={() => setDraft({ ...draft, phases: [...draft.phases, newPhase(draft.phases.length + 1)] })}><Plus /> Adicionar fase</Button></div>
          <div className="space-y-4">{draft.phases.map((phase, index) => <PhaseEditor key={phase.id} phase={phase} index={index} total={draft.phases.length} materials={materials} onChange={(nextPhase) => setDraft({ ...draft, phases: draft.phases.map((item) => item.id === phase.id ? nextPhase : item) })} onMove={(direction) => setDraft({ ...draft, phases: movePhase(draft.phases, index, direction) })} onRemove={() => setDraft({ ...draft, phases: draft.phases.filter((item) => item.id !== phase.id) })} />)}</div>
          <section className="rounded-lg border border-dashed border-border p-4"><p className="text-sm font-medium">Protocolos relacionados</p><p className="mt-1 text-xs text-muted-foreground">Espaço reservado para vincular protocolos clínicos e financeiros ao método nas próximas etapas.</p></section>
        </div>}
      </main>
    </div>
  );
}

function PhaseEditor({ phase, index, total, materials, onChange, onMove, onRemove }: { phase: MethodPhase; index: number; total: number; materials: MethodMaterial[]; onChange: (phase: MethodPhase) => void; onMove: (direction: -1 | 1) => void; onRemove: () => void }) {
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
    onChange({ ...phase, materials: selected ? phase.materials.filter((item) => !(item.id === material.id && item.type === material.type)) : [...phase.materials, material] });
  };

  return <section className="rounded-lg border border-border bg-card p-4">
    <div className="flex items-start justify-between gap-3"><div className="flex-1"><p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Fase {index + 1}</p><Input value={phase.title} onChange={(event) => onChange({ ...phase, title: event.target.value })} className="mt-1 max-w-md font-medium" /></div><div className="flex gap-1"><Button type="button" size="icon" variant="ghost" disabled={index === 0} onClick={() => onMove(-1)}><ArrowUp /></Button><Button type="button" size="icon" variant="ghost" disabled={index === total - 1} onClick={() => onMove(1)}><ArrowDown /></Button><Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={onRemove}><Trash2 /></Button></div></div>
    <label className="mt-4 block space-y-1.5 text-xs text-muted-foreground">Objetivo da fase<Textarea value={phase.objective} onChange={(event) => onChange({ ...phase, objective: event.target.value })} placeholder="O que precisa estar resolvido antes de avançar?" /></label>
    <div className="mt-4 grid gap-5 xl:grid-cols-2">
      <div><p className="text-xs font-medium">Metas</p><div className="mt-2 flex gap-2"><Input value={goal} onChange={(event) => setGoal(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addGoal(); } }} placeholder="Ex.: atingir 2 L de água/dia" /><Button type="button" variant="outline" onClick={addGoal}><Plus /></Button></div><div className="mt-2 space-y-1">{phase.goals.map((item, goalIndex) => <div key={`${item}-${goalIndex}`} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2 text-sm"><span>{item}</span><Button type="button" variant="ghost" size="icon" className="size-7" onClick={() => onChange({ ...phase, goals: phase.goals.filter((_, current) => current !== goalIndex) })}><Trash2 /></Button></div>)}{!phase.goals.length ? <p className="text-xs text-muted-foreground">Nenhuma meta definida.</p> : null}</div></div>
      <div><div className="flex items-center justify-between"><p className="text-xs font-medium">Receitas e materiais</p><span className="text-[11px] text-muted-foreground">{phase.materials.length} selecionado{phase.materials.length === 1 ? "" : "s"}</span></div>{phase.materials.length ? <div className="mt-2 flex flex-wrap gap-1.5">{phase.materials.map((material) => <button key={`${material.type}-${material.id}`} type="button" onClick={() => toggleMaterial(material)} className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground">{material.label} ×</button>)}</div> : <p className="mt-2 text-xs text-muted-foreground">Nenhuma receita ou material selecionado.</p>}<Button type="button" variant="outline" className="mt-3 w-full justify-start" onClick={() => setIsMaterialPickerOpen((open) => !open)}><Plus /> {isMaterialPickerOpen ? "Fechar seleção" : "Adicionar receitas e materiais"}</Button>{isMaterialPickerOpen ? <div className="mt-2"><Input autoFocus value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Escreva para buscar receitas e materiais" /><div className="mt-2 max-h-56 overflow-auto rounded-md border border-border">{filtered.map((material) => { const active = phase.materials.some((item) => item.id === material.id && item.type === material.type); return <button key={`${material.type}-${material.id}`} type="button" onClick={() => toggleMaterial(material)} className={`flex w-full items-center justify-between border-b border-border px-3 py-2 text-left text-sm last:border-b-0 ${active ? "bg-accent" : "hover:bg-muted/40"}`}><span className="truncate">{material.label}</span><span className="text-[10px] uppercase text-muted-foreground">{materialTypeLabel(material.type)}</span></button>; })}{!filtered.length ? <p className="px-3 py-5 text-center text-xs text-muted-foreground">Nenhuma receita ou material encontrado.</p> : null}</div></div> : null}</div>
    </div>
  </section>;
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

function EmptyMethod({ onCreate }: { onCreate: () => void }) { return <div className="rounded-lg border border-dashed border-border p-12 text-center"><Building2 className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-4 text-base font-semibold">Construa seu método clínico</h2><p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">Organize fases, objetivos, metas e materiais reutilizáveis.</p><Button type="button" className="mt-5" onClick={onCreate}><Plus /> Criar primeiro método</Button></div>; }
function ComingSoon({ tab }: { tab: Exclude<OfficeTab, "metodo"> }) { const product = tab === "produtos"; return <div className="rounded-lg border border-dashed border-border p-10"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estrutura reservada</p><h2 className="mt-1 text-lg font-semibold">{product ? "Escada de produtos e precificação" : "Protocolos financeiros"}</h2><p className="mt-2 max-w-xl text-sm text-muted-foreground">{product ? "Aqui vamos organizar ofertas, níveis de acompanhamento, custos, margem e preços." : "Aqui vamos organizar condições, recorrência, descontos e regras financeiras."}</p></div>; }
function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) { return <Button type="button" variant={active ? "secondary" : "ghost"} className="rounded-b-none" onClick={onClick}>{children}</Button>; }
function statusLabel(status: ClinicMethod["status"]) { return status === "active" ? "Ativo" : status === "archived" ? "Arquivado" : "Em construção"; }
function materialTypeLabel(type: MethodMaterial["type"]) { return type === "recipe" ? "receita" : "material"; }
