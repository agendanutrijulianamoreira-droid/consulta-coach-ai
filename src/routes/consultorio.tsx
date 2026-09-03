import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Building2, Layers3, PackageSearch, Plus, Save, Trash2, WalletCards } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/nutrios/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { listFavoriteMeals, listFavoritePlans } from "@/lib/nutrios/favorites-repository";
import * as db from "@/lib/nutrios/repository";
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

export const Route = createFileRoute("/consultorio" as never)({
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
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Gestão do consultório</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">Meu Consultório</h1>
            <p className="mt-1 text-sm text-muted-foreground">Organize seu método, produtos e estrutura financeira sem misturar gestão com o prontuário clínico.</p>
          </div>
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
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ClinicMethod | null>(null);
  const foods = useQuery({ queryKey: ["foods"], queryFn: db.listFoods });
  const recipes = useQuery({ queryKey: ["recipes"], queryFn: db.listRecipes });
  const meals = useQuery({ queryKey: ["favorite-meals"], queryFn: listFavoriteMeals });
  const plans = useQuery({ queryKey: ["favorite-plans"], queryFn: listFavoritePlans });

  useEffect(() => {
    const stored = listMethods();
    setMethods(stored);
    if (stored[0]) {
      setSelectedId(stored[0].id);
      setDraft(stored[0]);
    }
  }, []);

  const materials = useMemo<MethodMaterial[]>(() => [
    ...(foods.data ?? []).map((item) => ({ id: item.id, type: "food" as const, label: item.name })),
    ...(recipes.data ?? []).map((item) => ({ id: item.id, type: "recipe" as const, label: item.name })),
    ...(meals.data ?? []).map((item) => ({ id: item.key, type: "meal" as const, label: item.label })),
    ...(plans.data ?? []).map((item) => ({ id: item.id, type: "plan" as const, label: `Plano · ${item.patientName}` })),
  ], [foods.data, meals.data, plans.data, recipes.data]);

  const selectMethod = (method: ClinicMethod) => { setSelectedId(method.id); setDraft(structuredClone(method)); };
  const create = () => { const method = newMethod(); setSelectedId(method.id); setDraft(method); };
  const save = () => {
    if (!draft) return;
    if (!draft.name.trim()) return toast.error("Dê um nome ao método.");
    const next = saveMethod({ ...draft, name: draft.name.trim() });
    setMethods(next);
    const saved = next.find((item) => item.id === draft.id) ?? draft;
    setDraft(saved);
    toast.success("Método salvo.");
  };
  const remove = () => {
    if (!draft) return;
    const next = removeMethod(draft.id);
    setMethods(next);
    setSelectedId(next[0]?.id ?? null);
    setDraft(next[0] ?? null);
    toast.success("Método removido.");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <Button type="button" className="w-full justify-start" onClick={create}><Plus /> Novo método</Button>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">Seus métodos</div>
          <div className="divide-y divide-border">
            {methods.map((method) => (
              <button key={method.id} type="button" onClick={() => selectMethod(method)} className={`w-full px-3 py-3 text-left ${selectedId === method.id ? "bg-accent" : "hover:bg-muted/40"}`}>
                <span className="block truncate text-sm font-medium">{method.name}</span>
                <span className="mt-1 block text-xs text-muted-foreground">{method.phases.length} fase{method.phases.length === 1 ? "" : "s"} · {statusLabel(method.status)}</span>
              </button>
            ))}
            {!methods.length ? <p className="px-3 py-6 text-center text-xs text-muted-foreground">Nenhum método criado ainda.</p> : null}
          </div>
        </div>
      </aside>

      <main>
        {!draft ? <EmptyMethod onCreate={create} /> : (
          <div className="space-y-5">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estrutura do método</p>
                  <h2 className="mt-1 text-lg font-semibold">{draft.name || "Novo método"}</h2>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="text-destructive" onClick={remove}><Trash2 /> Excluir</Button>
                  <Button type="button" onClick={save}><Save /> Salvar método</Button>
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs text-muted-foreground">Nome do método<Input value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
                <label className="space-y-1.5 text-xs text-muted-foreground">Status<select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value as ClinicMethod["status"] })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="draft">Em construção</option><option value="active">Ativo</option><option value="archived">Arquivado</option></select></label>
              </div>
              <label className="mt-4 block space-y-1.5 text-xs text-muted-foreground">Descrição<Textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Qual transformação este método organiza e para quem ele foi desenhado?" /></label>
            </section>

            <div className="flex items-center justify-between gap-3">
              <div><h3 className="text-sm font-semibold">Fases do método</h3><p className="mt-1 text-xs text-muted-foreground">Cada fase pode ter objetivo, metas e materiais próprios.</p></div>
              <Button type="button" variant="outline" onClick={() => setDraft({ ...draft, phases: [...draft.phases, newPhase(draft.phases.length + 1)] })}><Plus /> Adicionar fase</Button>
            </div>

            <div className="space-y-4">
              {draft.phases.map((phase, index) => (
                <PhaseEditor key={phase.id} phase={phase} index={index} total={draft.phases.length} materials={materials} onChange={(nextPhase) => setDraft({ ...draft, phases: draft.phases.map((item) => item.id === phase.id ? nextPhase : item) })} onMove={(direction) => setDraft({ ...draft, phases: movePhase(draft.phases, index, direction) })} onRemove={() => setDraft({ ...draft, phases: draft.phases.filter((item) => item.id !== phase.id) })} />
              ))}
            </div>

            <section className="rounded-lg border border-dashed border-border p-4">
              <p className="text-sm font-medium">Protocolos relacionados</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">A estrutura está reservada para relacionar protocolos clínicos e, depois, protocolos financeiros ao método sem acoplar essas regras às fases.</p>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}

function PhaseEditor({ phase, index, total, materials, onChange, onMove, onRemove }: { phase: MethodPhase; index: number; total: number; materials: MethodMaterial[]; onChange: (phase: MethodPhase) => void; onMove: (direction: -1 | 1) => void; onRemove: () => void }) {
  const [goal, setGoal] = useState("");
  const [search, setSearch] = useState("");
  const filtered = materials.filter((item) => item.label.toLowerCase().includes(search.toLowerCase())).slice(0, 24);
  const addGoal = () => { if (!goal.trim()) return; onChange({ ...phase, goals: [...phase.goals, goal.trim()] }); setGoal(""); };
  const toggleMaterial = (material: MethodMaterial) => onChange({ ...phase, materials: phase.materials.some((item) => item.id === material.id && item.type === material.type) ? phase.materials.filter((item) => !(item.id === material.id && item.type === material.type)) : [...phase.materials, material] });

  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1"><p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">Fase {index + 1}</p><Input value={phase.title} onChange={(event) => onChange({ ...phase, title: event.target.value })} className="mt-1 max-w-md font-medium" /></div>
        <div className="flex gap-1"><Button type="button" size="icon" variant="ghost" disabled={index === 0} onClick={() => onMove(-1)} aria-label="Mover fase para cima"><ArrowUp /></Button><Button type="button" size="icon" variant="ghost" disabled={index === total - 1} onClick={() => onMove(1)} aria-label="Mover fase para baixo"><ArrowDown /></Button><Button type="button" size="icon" variant="ghost" className="text-destructive" onClick={onRemove} aria-label="Remover fase"><Trash2 /></Button></div>
      </div>
      <label className="mt-4 block space-y-1.5 text-xs text-muted-foreground">Objetivo da fase<Textarea value={phase.objective} onChange={(event) => onChange({ ...phase, objective: event.target.value })} placeholder="O que precisa estar resolvido antes de avançar para a próxima fase?" /></label>

      <div className="mt-4 grid gap-5 xl:grid-cols-2">
        <div>
          <p className="text-xs font-medium">Metas</p>
          <div className="mt-2 flex gap-2"><Input value={goal} onChange={(event) => setGoal(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addGoal(); } }} placeholder="Ex.: atingir 2 L de água/dia" /><Button type="button" variant="outline" onClick={addGoal}><Plus /></Button></div>
          <div className="mt-2 space-y-1">{phase.goals.map((item, goalIndex) => <div key={`${item}-${goalIndex}`} className="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm"><span>{item}</span><Button type="button" variant="ghost" size="icon" className="size-7 text-muted-foreground" onClick={() => onChange({ ...phase, goals: phase.goals.filter((_, current) => current !== goalIndex) })}><Trash2 /></Button></div>)}{!phase.goals.length ? <p className="text-xs text-muted-foreground">Nenhuma meta definida.</p> : null}</div>
        </div>

        <div>
          <div className="flex items-center justify-between gap-2"><p className="text-xs font-medium">Materiais dos Favoritos</p><span className="text-[11px] text-muted-foreground">{phase.materials.length} selecionado{phase.materials.length === 1 ? "" : "s"}</span></div>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar alimento, receita, refeição ou plano" className="mt-2" />
          <div className="mt-2 max-h-56 overflow-auto rounded-md border border-border">
            {filtered.map((material) => {
              const active = phase.materials.some((item) => item.id === material.id && item.type === material.type);
              return <button key={`${material.type}-${material.id}`} type="button" onClick={() => toggleMaterial(material)} className={`flex w-full items-center justify-between gap-3 border-b border-border px-3 py-2 text-left text-sm last:border-b-0 ${active ? "bg-accent" : "hover:bg-muted/40"}`}><span className="truncate">{material.label}</span><span className="shrink-0 text-[10px] uppercase tracking-wide text-muted-foreground">{materialTypeLabel(material.type)}</span></button>;
            })}
            {!filtered.length ? <p className="px-3 py-5 text-center text-xs text-muted-foreground">Nenhum favorito encontrado.</p> : null}
          </div>
          {phase.materials.length ? <div className="mt-2 flex flex-wrap gap-1.5">{phase.materials.map((material) => <button type="button" key={`${material.type}-${material.id}`} onClick={() => toggleMaterial(material)} className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground">{material.label} ×</button>)}</div> : null}
        </div>
      </div>
    </section>
  );
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
  return <div className="rounded-lg border border-dashed border-border p-12 text-center"><Building2 className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-4 text-base font-semibold">Construa seu método clínico</h2><p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">Comece criando a estrutura que organiza sua entrega: fases, objetivos, metas e materiais reutilizáveis.</p><Button type="button" className="mt-5" onClick={onCreate}><Plus /> Criar primeiro método</Button></div>;
}

function ComingSoon({ tab }: { tab: Exclude<OfficeTab, "metodo"> }) {
  const product = tab === "produtos";
  return <div className="rounded-lg border border-dashed border-border p-10"><div className="max-w-xl"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Estrutura reservada</p><h2 className="mt-1 text-lg font-semibold">{product ? "Escada de produtos e precificação" : "Protocolos financeiros"}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{product ? "Aqui vamos organizar ofertas, níveis de acompanhamento, composição de preço, margem, custos e estratégia de upgrade." : "Aqui vamos definir regras financeiras, condições, recorrência, descontos e indicadores ligados aos produtos e métodos."}</p><p className="mt-3 text-xs text-muted-foreground">Nesta etapa o foco está no Método; esta área ainda não salva dados.</p></div></div>;
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Button type="button" variant={active ? "secondary" : "ghost"} className="rounded-b-none" onClick={onClick}>{children}</Button>;
}

function statusLabel(status: ClinicMethod["status"]) { return status === "active" ? "Ativo" : status === "archived" ? "Arquivado" : "Em construção"; }
function materialTypeLabel(type: MethodMaterial["type"]) { return type === "food" ? "alimento" : type === "recipe" ? "receita" : type === "meal" ? "refeição" : "plano"; }
