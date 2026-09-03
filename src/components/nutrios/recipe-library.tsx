import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { RecipeDialog } from "@/components/nutrios/recipe-dialog";
import { Button } from "@/components/ui/button";
import { deleteRecipe, listRecipes } from "@/lib/nutrios/recipes-repository";
import type { Recipe } from "@/lib/nutrios/types";

export function RecipeLibrary() {
  const queryClient = useQueryClient();
  const recipes = useQuery({ queryKey: ["recipes"], queryFn: listRecipes });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Recipe | null>(null);

  const remove = useMutation({
    mutationFn: deleteRecipe,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast.success("Receita excluída.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (recipe: Recipe) => {
    setEditing(recipe);
    setDialogOpen(true);
  };

  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Receitas</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Receitas próprias prontas para reaproveitamento nos planos alimentares.
          </p>
        </div>
        <Button size="sm" onClick={openNew}>
          <Plus /> Nova receita
        </Button>
      </div>

      {recipes.isLoading ? <p className="text-sm text-muted-foreground">Carregando receitas…</p> : null}
      {recipes.isError ? <p className="text-sm text-destructive">Não foi possível carregar as receitas.</p> : null}

      {!recipes.isLoading && !recipes.data?.length ? (
        <div className="rounded-md border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium">Nenhuma receita cadastrada</p>
          <p className="mt-1 text-sm text-muted-foreground">Comece pelas receitas que você mais usa nas consultas.</p>
          <Button className="mt-4" size="sm" variant="outline" onClick={openNew}>
            <Plus /> Cadastrar primeira receita
          </Button>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {(recipes.data ?? []).map((recipe) => (
          <article key={recipe.id} className="rounded-md border border-border p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-medium">{recipe.name}</h3>
                <div className="mt-1 text-xs text-muted-foreground">
                  {recipe.prep_minutes} min · {recipe.yield_label} · {Math.round(recipe.kcal)} kcal
                </div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button type="button" variant="ghost" size="icon" className="size-8" aria-label={`Editar ${recipe.name}`} onClick={() => openEdit(recipe)}>
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-8 text-destructive"
                  aria-label={`Excluir ${recipe.name}`}
                  disabled={remove.isPending}
                  onClick={() => {
                    if (window.confirm(`Excluir a receita “${recipe.name}”?`)) remove.mutate(recipe.id);
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </div>

            {recipe.ingredients.length ? (
              <div className="mt-3 text-xs text-muted-foreground">
                {recipe.ingredients.slice(0, 4).map((ingredient) => (
                  <div key={`${ingredient.name}-${ingredient.amount}`}>
                    {ingredient.name}{ingredient.amount ? ` — ${ingredient.amount}` : ""}
                  </div>
                ))}
                {recipe.ingredients.length > 4 ? <div>+ {recipe.ingredients.length - 4} ingrediente(s)</div> : null}
              </div>
            ) : null}

            {recipe.steps ? <p className="mt-3 line-clamp-4 whitespace-pre-wrap text-sm text-muted-foreground">{recipe.steps}</p> : null}

            <div className="mt-4 grid grid-cols-4 gap-2 text-center text-xs">
              <Macro label="P" value={recipe.protein_g} />
              <Macro label="C" value={recipe.carb_g} />
              <Macro label="G" value={recipe.fat_g} />
              <Macro label="kcal" value={recipe.kcal} />
            </div>
          </article>
        ))}
      </div>

      <RecipeDialog open={dialogOpen} onOpenChange={setDialogOpen} recipe={editing} />
    </div>
  );
}

function Macro({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-border px-2 py-1.5">
      <div className="text-[10px] uppercase text-muted-foreground">{label}</div>
      <div className="font-medium tabular-nums">{Math.round(value * 10) / 10}</div>
    </div>
  );
}
