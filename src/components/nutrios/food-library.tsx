import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FoodDialog } from "@/components/nutrios/food-dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { deleteFood, listFoods } from "@/lib/nutrios/repository";
import type { Food } from "@/lib/nutrios/types";

/** Rótulos amigáveis apenas para exibição — o valor salvo em group_name não muda. */
const GROUP_LABELS: Record<string, string> = {
  proteina: "Proteína",
  carboidrato: "Carboidrato",
  leguminosa: "Leguminosa",
  vegetal: "Vegetal",
  fruta: "Fruta",
  laticinio: "Laticínio",
  gordura: "Gordura",
  bebida: "Bebida",
};

function groupLabel(value: string): string {
  return GROUP_LABELS[value] ?? (value ? value.charAt(0).toUpperCase() + value.slice(1) : "Sem grupo");
}

type SortMode = "name-asc" | "name-desc" | "kcal-asc" | "kcal-desc";
const DEFAULT_GROUP_FILTER = "all";
const DEFAULT_SORT: SortMode = "name-asc";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "name-asc", label: "Nome (A–Z)" },
  { value: "name-desc", label: "Nome (Z–A)" },
  { value: "kcal-asc", label: "Menor valor energético" },
  { value: "kcal-desc", label: "Maior valor energético" },
];

function sortFoods(list: Food[], mode: SortMode): Food[] {
  const sorted = [...list];
  switch (mode) {
    case "name-asc":
      sorted.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
      break;
    case "name-desc":
      sorted.sort((a, b) => b.name.localeCompare(a.name, "pt-BR"));
      break;
    case "kcal-asc":
      sorted.sort((a, b) => a.kcal - b.kcal);
      break;
    case "kcal-desc":
      sorted.sort((a, b) => b.kcal - a.kcal);
      break;
  }
  return sorted;
}

export function FoodLibrary() {
  const queryClient = useQueryClient();
  const foods = useQuery({ queryKey: ["foods"], queryFn: listFoods });
  const [search, setSearch] = useState("");
  const [groupFilter, setGroupFilter] = useState(DEFAULT_GROUP_FILTER);
  const [sortMode, setSortMode] = useState<SortMode>(DEFAULT_SORT);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Food | null>(null);
  const [removing, setRemoving] = useState<Food | null>(null);

  const groups = useMemo(() => {
    const values = new Set((foods.data ?? []).map((food) => food.group_name));
    return Array.from(values).sort((a, b) => groupLabel(a).localeCompare(groupLabel(b), "pt-BR"));
  }, [foods.data]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    const base = (foods.data ?? []).filter((food) => {
      const matchesTerm = !term || food.name.toLowerCase().includes(term) || food.group_name.toLowerCase().includes(term);
      const matchesGroup = groupFilter === DEFAULT_GROUP_FILTER || food.group_name === groupFilter;
      return matchesTerm && matchesGroup;
    });
    return sortFoods(base, sortMode);
  }, [foods.data, search, groupFilter, sortMode]);

  const total = foods.data?.length ?? 0;
  const hasActiveFilters = search.trim() !== "" || groupFilter !== DEFAULT_GROUP_FILTER || sortMode !== DEFAULT_SORT;

  const clearFilters = () => {
    setSearch("");
    setGroupFilter(DEFAULT_GROUP_FILTER);
    setSortMode(DEFAULT_SORT);
  };

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (food: Food) => {
    setEditing(food);
    setDialogOpen(true);
  };

  const removeFood = useMutation({
    mutationFn: (id: string) => deleteFood(id),
    onSuccess: () => {
      setRemoving(null);
      void queryClient.invalidateQueries({ queryKey: ["foods"] });
      toast.success("Alimento excluído.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Alimentos</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Base clínica usada nos planos alimentares, com porções, medidas caseiras e macros.
          </p>
          {!foods.isLoading && !foods.isError ? (
            <p className="mt-1 text-xs text-muted-foreground">
              {total} {total === 1 ? "alimento cadastrado" : "alimentos cadastrados"}
            </p>
          ) : null}
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus /> Novo alimento
        </Button>
      </div>

      {foods.isLoading ? <FoodLibrarySkeleton /> : null}

      {foods.isError ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center">
          <AlertTriangle className="mx-auto size-6 text-destructive" />
          <p className="mt-3 text-sm font-medium">Não foi possível carregar os alimentos.</p>
          <p className="mt-1 text-sm text-muted-foreground">Verifique sua conexão e tente novamente.</p>
          <Button size="sm" variant="outline" className="mt-4" onClick={() => void foods.refetch()}>
            <RefreshCw /> Tentar novamente
          </Button>
        </div>
      ) : null}

      {!foods.isLoading && !foods.isError && total === 0 ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium">Nenhum alimento cadastrado</p>
          <p className="mt-1 text-sm text-muted-foreground">Comece pelos alimentos que você mais usa nos planos.</p>
          <Button className="mt-4" size="sm" variant="outline" onClick={openNew}>
            <Plus /> Cadastrar primeiro alimento
          </Button>
        </div>
      ) : null}

      {!foods.isLoading && !foods.isError && total > 0 ? (
        <>
          <div className="mb-4 flex flex-col gap-3 border-b border-border pb-4 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative sm:w-64">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar alimento ou grupo"
                aria-label="Buscar alimento ou grupo"
                className="h-8 pl-8 pr-8 text-xs"
              />
              {search ? (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  aria-label="Limpar busca"
                  className="absolute right-1.5 top-1.5 rounded-sm p-0.5 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>

            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger aria-label="Filtrar por grupo" className="h-8 w-full text-xs sm:w-44">
                <SelectValue placeholder="Grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={DEFAULT_GROUP_FILTER}>Todos os grupos</SelectItem>
                {groups.map((group) => (
                  <SelectItem key={group} value={group}>
                    {groupLabel(group)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
              <SelectTrigger aria-label="Ordenar por" className="h-8 w-full text-xs sm:w-52">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex flex-1 items-center justify-between gap-2 sm:justify-end">
              <span className="text-xs text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "resultado" : "resultados"}
              </span>
              {hasActiveFilters ? (
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              ) : null}
            </div>
          </div>

          <TooltipProvider delayDuration={200}>
            {filtered.length === 0 ? (
              <div className="rounded-md border border-dashed border-border p-8 text-center">
                <p className="text-sm font-medium">
                  {search ? <>Nenhum alimento encontrado para "{search}".</> : "Nenhum alimento encontrado com os filtros aplicados."}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">Ajuste a busca ou remova os filtros para ver mais resultados.</p>
                <Button className="mt-4" size="sm" variant="outline" onClick={clearFilters}>
                  Limpar filtros
                </Button>
              </div>
            ) : (
              <>
                <div className="hidden overflow-hidden rounded-md border border-border md:block">
                  <div className="max-h-[65vh] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 z-10 bg-muted text-xs text-muted-foreground">
                        <tr className="border-b border-border">
                          <th className="px-3 py-2 text-left font-medium">Alimento</th>
                          <th className="px-3 py-2 text-left font-medium">Grupo</th>
                          <th className="px-3 py-2 text-left font-medium">Porção</th>
                          <th className="px-3 py-2 text-right font-medium">kcal</th>
                          <th className="px-3 py-2 text-right font-medium">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <abbr tabIndex={0} title="Proteína, carboidrato e gordura (g)" className="cursor-help no-underline decoration-dotted">
                                  P/C/G
                                </abbr>
                              </TooltipTrigger>
                              <TooltipContent>Proteína / Carboidrato / Gordura (g)</TooltipContent>
                            </Tooltip>
                          </th>
                          <th className="px-3 py-2 text-right font-medium">
                            <span className="sr-only">Ações</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filtered.map((food) => (
                          <tr key={food.id} className="transition-colors hover:bg-muted/40">
                            <td className="px-3 py-2 font-medium text-foreground">{food.name}</td>
                            <td className="px-3 py-2">
                              <Badge variant="outline" className="font-normal text-muted-foreground">
                                {groupLabel(food.group_name)}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-muted-foreground">
                              {food.portion_grams} g · {food.household_measure}
                            </td>
                            <td className="px-3 py-2 text-right font-medium tabular-nums text-foreground">{food.kcal}</td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {food.protein_g}/{food.carb_g}/{food.fat_g}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="flex justify-end gap-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      aria-label={`Editar ${food.name}`}
                                      onClick={() => openEdit(food)}
                                    >
                                      <Pencil />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Editar</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="icon"
                                      variant="ghost"
                                      aria-label={`Excluir ${food.name}`}
                                      className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive"
                                      onClick={() => setRemoving(food)}
                                    >
                                      <Trash2 />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Excluir</TooltipContent>
                                </Tooltip>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="grid gap-3 md:hidden">
                  {filtered.map((food) => (
                    <article key={food.id} className="rounded-md border border-border p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{food.name}</p>
                          <Badge variant="outline" className="mt-1.5 font-normal text-muted-foreground">
                            {groupLabel(food.group_name)}
                          </Badge>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8"
                            aria-label={`Editar ${food.name}`}
                            onClick={() => openEdit(food)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:bg-destructive/10 focus-visible:text-destructive"
                            aria-label={`Excluir ${food.name}`}
                            onClick={() => setRemoving(food)}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>
                      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
                        <div>
                          <dt className="inline">Porção: </dt>
                          <dd className="inline">
                            {food.portion_grams} g · {food.household_measure}
                          </dd>
                        </div>
                        <div className="text-right">
                          <dt className="inline">kcal: </dt>
                          <dd className="inline tabular-nums text-foreground">{food.kcal}</dd>
                        </div>
                        <div className="col-span-2">
                          <dt className="inline">
                            <abbr title="Proteína, carboidrato e gordura (g)" className="no-underline decoration-dotted">
                              P/C/G
                            </abbr>
                            :{" "}
                          </dt>
                          <dd className="inline tabular-nums">
                            {food.protein_g}/{food.carb_g}/{food.fat_g}
                          </dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              </>
            )}
          </TooltipProvider>
        </>
      ) : null}

      <FoodDialog open={dialogOpen} onOpenChange={setDialogOpen} food={editing} />
      <AlertDialog
        open={!!removing}
        onOpenChange={(open) => {
          if (removeFood.isPending) return;
          if (!open) setRemoving(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Planos já salvos que usam este alimento não são afetados retroativamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={removeFood.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (removing && !removeFood.isPending) removeFood.mutate(removing.id);
              }}
              disabled={removeFood.isPending}
            >
              {removeFood.isPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function FoodLibrarySkeleton() {
  return (
    <div aria-hidden="true">
      <div className="hidden overflow-hidden rounded-md border border-border md:block">
        <div className="divide-y divide-border">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 px-3 py-3">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="ml-auto h-4 w-10" />
              <Skeleton className="h-4 w-14" />
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:hidden">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="rounded-md border border-border p-4">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="mt-2 h-4 w-16" />
            <Skeleton className="mt-3 h-3 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
