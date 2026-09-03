import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/nutrios/app-shell";
import { RecipeLibrary } from "@/components/nutrios/recipe-library";

export const Route = createFileRoute("/receitas")({
  head: () => ({
    meta: [
      { title: "Receitas — Cach AI" },
      {
        name: "description",
        content: "Biblioteca clínica de receitas do Cach AI.",
      },
    ],
  }),
  component: RecipesPage,
});

function RecipesPage() {
  return (
    <AppShell title="Favoritos · Receitas">
      <RecipeLibrary />
    </AppShell>
  );
}
