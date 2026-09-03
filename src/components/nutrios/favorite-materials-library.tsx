import { BookOpenCheck, FileText, Plus, Save, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  listFavoriteMaterials,
  materialCategoryLabel,
  newFavoriteMaterial,
  removeFavoriteMaterial,
  saveFavoriteMaterial,
  type FavoriteMaterial,
  type MaterialCategory,
} from "@/modules/favoritos/material-store";

const categories: MaterialCategory[] = ["lamina", "orientacao", "guia", "ebook"];

export function FavoriteMaterialsLibrary() {
  const [items, setItems] = useState<FavoriteMaterial[]>(() => listFavoriteMaterials());
  const [selectedId, setSelectedId] = useState<string | null>(() => listFavoriteMaterials()[0]?.id ?? null);
  const [draft, setDraft] = useState<FavoriteMaterial | null>(() => listFavoriteMaterials()[0] ?? null);
  const [filter, setFilter] = useState<MaterialCategory | "all">("all");
  const [search, setSearch] = useState("");
  const [tagDraft, setTagDraft] = useState("");

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesCategory = filter === "all" || item.category === filter;
      const matchesSearch = !term || [item.title, item.description, ...item.tags].some((value) => value.toLowerCase().includes(term));
      return matchesCategory && matchesSearch;
    });
  }, [filter, items, search]);

  const open = (material: FavoriteMaterial) => {
    setSelectedId(material.id);
    setDraft(structuredClone(material));
    setTagDraft("");
  };

  const create = (category: MaterialCategory = "orientacao") => {
    const material = newFavoriteMaterial(category);
    setSelectedId(material.id);
    setDraft(material);
    setTagDraft("");
  };

  const save = () => {
    if (!draft) return;
    if (!draft.title.trim()) {
      toast.error("Dê um título ao material.");
      return;
    }
    const next = saveFavoriteMaterial({ ...draft, title: draft.title.trim() });
    setItems(next);
    const saved = next.find((item) => item.id === draft.id) ?? draft;
    setDraft(structuredClone(saved));
    setSelectedId(saved.id);
    toast.success("Material salvo nos Favoritos.");
  };

  const remove = () => {
    if (!draft) return;
    const next = removeFavoriteMaterial(draft.id);
    setItems(next);
    const nextDraft = next[0] ?? null;
    setDraft(nextDraft ? structuredClone(nextDraft) : null);
    setSelectedId(nextDraft?.id ?? null);
    toast.success("Material removido.");
  };

  const addTag = () => {
    if (!draft) return;
    const tag = tagDraft.trim().toLowerCase();
    if (!tag) return;
    setDraft({ ...draft, tags: draft.tags.includes(tag) ? draft.tags : [...draft.tags, tag] });
    setTagDraft("");
  };

  return (
    <div className="grid gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="space-y-3">
        <Button type="button" className="w-full justify-start" onClick={() => create()}><Plus /> Novo material</Button>
        <div className="grid grid-cols-2 gap-1">
          <Button type="button" size="sm" variant={filter === "all" ? "secondary" : "ghost"} onClick={() => setFilter("all")}>Todos</Button>
          {categories.map((category) => <Button key={category} type="button" size="sm" variant={filter === category ? "secondary" : "ghost"} onClick={() => setFilter(category)}>{materialCategoryLabel(category)}</Button>)}
        </div>
        <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar materiais" />
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">Materiais salvos</div>
          <div className="divide-y divide-border">
            {visible.map((item) => <button key={item.id} type="button" className={`w-full px-3 py-3 text-left hover:bg-muted/40 ${selectedId === item.id ? "bg-accent" : ""}`} onClick={() => open(item)}><span className="block truncate text-sm font-medium">{item.title}</span><span className="mt-1 block text-[11px] text-muted-foreground">{materialCategoryLabel(item.category)}{item.fileName ? ` · ${item.fileName}` : ""}</span></button>)}
            {!visible.length ? <p className="px-3 py-8 text-center text-xs text-muted-foreground">Nenhum material cadastrado.</p> : null}
          </div>
        </div>
      </aside>

      <main>
        {!draft ? (
          <div className="rounded-lg border border-dashed border-border p-12 text-center"><BookOpenCheck className="mx-auto size-8 text-muted-foreground" /><h2 className="mt-4 text-base font-semibold">Crie sua biblioteca de materiais</h2><p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">Cadastre lâminas, orientações, guias e e-books para reutilizar nas fases do seu método.</p><Button type="button" className="mt-5" onClick={() => create()}><Plus /> Criar material</Button></div>
        ) : (
          <div className="space-y-5">
            <section className="rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Material favorito</p><h2 className="mt-1 text-lg font-semibold">{draft.title || "Novo material"}</h2></div>
                <div className="flex gap-2"><Button type="button" variant="outline" className="text-destructive" onClick={remove}><Trash2 /> Excluir</Button><Button type="button" onClick={save}><Save /> Salvar</Button></div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs text-muted-foreground">Título<Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ex.: Guia de constipação" /></label>
                <label className="space-y-1.5 text-xs text-muted-foreground">Categoria<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as MaterialCategory })} className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground">{categories.map((category) => <option key={category} value={category}>{materialCategoryLabel(category)}</option>)}</select></label>
              </div>

              <label className="mt-4 block space-y-1.5 text-xs text-muted-foreground">Descrição / finalidade<Textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="Quando usar este material e qual objetivo ele cumpre?" /></label>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5 text-xs text-muted-foreground">Link do material<Input value={draft.link} onChange={(event) => setDraft({ ...draft, link: event.target.value })} placeholder="https://..." /></label>
                <label className="space-y-1.5 text-xs text-muted-foreground">Nome do arquivo<Input value={draft.fileName} onChange={(event) => setDraft({ ...draft, fileName: event.target.value })} placeholder="guia-intestino.pdf" /></label>
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground">Nesta versão, o Cach AI guarda a referência do arquivo/link. O upload binário será conectado ao Storage do Supabase quando o banco de produção estiver validado.</p>

              <label className="mt-4 block space-y-1.5 text-xs text-muted-foreground">Conteúdo / orientação<Textarea rows={8} value={draft.content} onChange={(event) => setDraft({ ...draft, content: event.target.value })} placeholder="Texto que você deseja manter disponível junto ao material..." /></label>

              <div className="mt-4">
                <p className="text-xs text-muted-foreground">Tags</p>
                <div className="mt-1.5 flex gap-2"><Input value={tagDraft} onChange={(event) => setTagDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} placeholder="Ex.: intestino, dm2, menopausa" /><Button type="button" variant="outline" onClick={addTag}><Plus /></Button></div>
                {draft.tags.length ? <div className="mt-2 flex flex-wrap gap-1.5">{draft.tags.map((tag) => <button key={tag} type="button" className="rounded-full border border-border px-2 py-1 text-[11px] text-muted-foreground" onClick={() => setDraft({ ...draft, tags: draft.tags.filter((item) => item !== tag) })}>{tag} ×</button>)}</div> : null}
              </div>
            </section>

            <section className="rounded-lg border border-dashed border-border p-4"><div className="flex items-start gap-3"><FileText className="mt-0.5 size-4 text-muted-foreground" /><div><p className="text-sm font-medium">Uso dentro do Método</p><p className="mt-1 text-xs text-muted-foreground">Depois de salvo, este material fica disponível em Meu Consultório → Método → Materiais dos Favoritos para ser vinculado às fases.</p></div></div></section>
          </div>
        )}
      </main>
    </div>
  );
}
