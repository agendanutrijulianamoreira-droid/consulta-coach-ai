import { createFileRoute } from "@tanstack/react-router";
import { Apple, BookOpen, Files, NotebookTabs, Utensils } from "lucide-react";
import type { ComponentType } from "react";
import { AppShell } from "@/components/nutrios/app-shell";
import { FavoriteMaterialsLibrary } from "@/components/nutrios/favorite-materials-library";
import { FoodLibrary } from "@/components/nutrios/food-library";
import { FavoriteMealsLibrary, FavoritePlansLibrary } from "@/components/nutrios/favorites-meals-plans";
import { RecipeLibrary } from "@/components/nutrios/recipe-library";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const FAVORITE_TABS = [
  { value: "alimentos", label: "Alimentos", icon: Apple },
  { value: "receitas", label: "Receitas", icon: BookOpen },
  { value: "refeicoes", label: "Refeições", icon: Utensils },
  { value: "planos", label: "Planos alimentares", icon: NotebookTabs },
  { value: "materiais", label: "Materiais", icon: Files },
] as const satisfies ReadonlyArray<{ value: string; label: string; icon: ComponentType<{ className?: string }> }>;

type FavoriteTab = (typeof FAVORITE_TABS)[number]["value"];

const FAVORITE_TAB_VALUES: readonly string[] = FAVORITE_TABS.map((item) => item.value);
const DEFAULT_TAB: FavoriteTab = "alimentos";

function isFavoriteTab(value: unknown): value is FavoriteTab {
  return typeof value === "string" && FAVORITE_TAB_VALUES.includes(value);
}

export const Route = createFileRoute("/alimentos")({
  validateSearch: (search: Record<string, unknown>): { tab: FavoriteTab } => ({
    tab: isFavoriteTab(search["tab"]) ? search["tab"] : DEFAULT_TAB,
  }),
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

function FavoritesPage() {
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();

  const changeTab = (value: string) => {
    if (isFavoriteTab(value) && value !== tab) void navigate({ search: { tab: value }, replace: true });
  };

  return (
    <AppShell>
      <Tabs value={tab} onValueChange={changeTab}>
        <div className="border-b border-border px-4 pb-4 pt-6 sm:px-6">
          <div className="mx-auto max-w-7xl">
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Biblioteca clínica</p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight">Favoritos</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
              Alimentos, receitas, refeições, planos e materiais prontos para reaproveitar nas consultas.
            </p>
          </div>
        </div>

        <div className="border-b border-border">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <TabsList
              aria-label="Categorias de favoritos"
              className="h-auto w-full flex-nowrap justify-start gap-1 overflow-x-auto rounded-none border-none bg-transparent p-0 py-2"
            >
              {FAVORITE_TABS.map(({ value, label, icon: Icon }) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  className="shrink-0 gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground shadow-none transition-colors hover:bg-accent hover:text-foreground data-[state=active]:bg-secondary data-[state=active]:text-secondary-foreground data-[state=active]:shadow-none"
                >
                  <Icon className="size-3.5" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </div>

        <div className="mx-auto max-w-7xl">
          <TabsContent value="alimentos" className="mt-0">
            <FoodLibrary />
          </TabsContent>
          <TabsContent value="receitas" className="mt-0">
            <RecipeLibrary />
          </TabsContent>
          <TabsContent value="refeicoes" className="mt-0">
            <FavoriteMealsLibrary />
          </TabsContent>
          <TabsContent value="planos" className="mt-0">
            <FavoritePlansLibrary />
          </TabsContent>
          <TabsContent value="materiais" className="mt-0">
            <FavoriteMaterialsLibrary />
          </TabsContent>
        </div>
      </Tabs>
    </AppShell>
  );
}
