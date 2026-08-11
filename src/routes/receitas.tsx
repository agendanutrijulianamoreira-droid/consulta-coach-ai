import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/nutrios/app-shell";
import { listRecipes } from "@/lib/nutrios/repository";

export const Route = createFileRoute("/receitas")({
  head: () => ({
    meta: [
      { title: "Receitas — NutriOS" },
      { name: "description", content: "Receitas cadastradas e usadas pelo motor de plano alimentar." },
      { property: "og:title", content: "Receitas — NutriOS" },
      { property: "og:description", content: "Modo de preparo, rendimento e macros por receita." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: RecipesPage,
});

function RecipesPage() {
  const recipes = useQuery({ queryKey: ["recipes"], queryFn: listRecipes });
  return (
    <AppShell title="Receitas">
      <div className="grid gap-3 px-5 py-6 md:grid-cols-2">
        {(recipes.data ?? []).map((recipe) => (
          <div key={recipe.id} className="rounded-md border border-border p-3">
            <div className="text-sm font-medium">{recipe.name}</div>
            <div className="mt-1 text-xs text-muted-foreground">
              {recipe.prep_minutes} min · {recipe.yield_label} · {recipe.kcal} kcal
            </div>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{recipe.steps}</p>
          </div>
        ))}
      </div>
    </AppShell>
  );
}