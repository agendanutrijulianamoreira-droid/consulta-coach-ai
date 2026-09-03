import { createFileRoute } from "@tanstack/react-router";
import { Apple, BookOpen } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/nutrios/app-shell";
import { FoodLibrary } from "@/components/nutrios/food-library";
import { RecipeLibrary } from "@/components/nutrios/recipe-library";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/alimentos")({
  head: () => ({
    meta: [
      { title: "Favoritos — Cach AI" },
      {
        name: "description",
        content: "Biblioteca clínica reutilizável de alimentos e receitas do Cach AI.",
      },
    ],
  }),
  component: FavoritesPage,
});

type FavoriteTab = "alimentos" | "receitas";

function FavoritesPage() {
  const [tab, setTab] = useState<FavoriteTab>("alimentos");

  return (
    <AppShell title="Favoritos">
      <div className="border-b border-border px-4 pt-6 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Biblioteca clínica</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">Favoritos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Centralize alimentos e receitas reutilizáveis para montar planos alimentares com mais rapidez.
            </p>
          </div>

          <nav className="mt-5 flex gap-1" aria-label="Categorias de favoritos">
            <Button
              type="button"
              variant={tab === "alimentos" ? "secondary" : "ghost"}
              className="rounded-b-none"
              onClick={() => setTab("alimentos")}
            >
              <Apple /> Alimentos
            </Button>
            <Button
              type="button"
              variant={tab === "receitas" ? "secondary" : "ghost"}
              className="rounded-b-none"
              onClick={() => setTab("receitas")}
            >
              <BookOpen /> Receitas
            </Button>
          </nav>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl">
        {tab === "alimentos" ? <FoodLibrary /> : <RecipeLibrary />}
      </div>
    </AppShell>
  );
}
