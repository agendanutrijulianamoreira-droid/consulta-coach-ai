import { createFileRoute } from "@tanstack/react-router";
import { Apple, BookOpen, Files, NotebookTabs, Utensils } from "lucide-react";
import { useState } from "react";
import { AppShell } from "@/components/nutrios/app-shell";
import { FavoriteMaterialsLibrary } from "@/components/nutrios/favorite-materials-library";
import { FoodLibrary } from "@/components/nutrios/food-library";
import { FavoriteMealsLibrary, FavoritePlansLibrary } from "@/components/nutrios/favorites-meals-plans";
import { RecipeLibrary } from "@/components/nutrios/recipe-library";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/alimentos")({
  head: () => ({
    meta: [
      { title: "Favoritos — Cach AI" },
      {
        name: "description",
        content: "Biblioteca clínica reutilizável de alimentos, receitas, refeições, planos alimentares e materiais do Cach AI.",
      },
    ],
  }),
  component: FavoritesPage,
});

type FavoriteTab = "alimentos" | "receitas" | "refeicoes" | "planos" | "materiais";

function FavoritesPage() {
  const [tab, setTab] = useState<FavoriteTab>("alimentos");

  return (
    <AppShell title="Favoritos">
      <div className="border-b border-border px-4 pt-6 sm:px-6">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Biblioteca clínica</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">Favoritos</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Sua biblioteca reutilizável para planos, métodos e acompanhamento: alimentos, receitas, refeições, planos e materiais educativos.
            </p>
          </div>

          <nav className="mt-5 flex flex-wrap gap-1" aria-label="Categorias de favoritos">
            <TabButton active={tab === "alimentos"} onClick={() => setTab("alimentos")}><Apple /> Alimentos</TabButton>
            <TabButton active={tab === "receitas"} onClick={() => setTab("receitas")}><BookOpen /> Receitas</TabButton>
            <TabButton active={tab === "refeicoes"} onClick={() => setTab("refeicoes")}><Utensils /> Refeições</TabButton>
            <TabButton active={tab === "planos"} onClick={() => setTab("planos")}><NotebookTabs /> Planos alimentares</TabButton>
            <TabButton active={tab === "materiais"} onClick={() => setTab("materiais")}><Files /> Materiais</TabButton>
          </nav>
        </div>
      </div>

      <div className="mx-auto w-full max-w-7xl">
        {tab === "alimentos" ? <FoodLibrary /> : null}
        {tab === "receitas" ? <RecipeLibrary /> : null}
        {tab === "refeicoes" ? <FavoriteMealsLibrary /> : null}
        {tab === "planos" ? <FavoritePlansLibrary /> : null}
        {tab === "materiais" ? <FavoriteMaterialsLibrary /> : null}
      </div>
    </AppShell>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <Button type="button" variant={active ? "secondary" : "ghost"} className="rounded-b-none" onClick={onClick}>{children}</Button>;
}
