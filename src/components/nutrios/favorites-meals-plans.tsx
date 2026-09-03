import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus, Heart, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  listFavoriteMeals,
  listFavoritePlans,
  removeFavoriteMeal,
  saveFavoriteMeal,
  type FavoriteMeal,
  type FavoritePlan,
} from "@/lib/nutrios/favorites-repository";

export function FavoritePlansLibrary() {
  const queryClient = useQueryClient();
  const plans = useQuery({ queryKey: ["favorite-plans"], queryFn: listFavoritePlans });
  const saveMeal = useMutation({
    mutationFn: ({ plan, meal }: { plan: FavoritePlan; meal: FavoritePlan["meals"][number] }) =>
      saveFavoriteMeal(plan, meal),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["favorite-meals"] });
      toast.success("Refeição salva nos favoritos.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (plans.isLoading) return <Status>Carregando planos favoritos…</Status>;
  if (plans.isError) return <Status error>Não foi possível carregar os planos favoritos.</Status>;
  if (!plans.data?.length) {
    return (
      <EmptyState
        title="Nenhum plano alimentar favorito"
        description="No prontuário do paciente, marque um plano alimentar como favorito. Ele passará a aparecer aqui para reutilização rápida."
      />
    );
  }

  return (
    <div className="space-y-4 px-4 py-6 sm:px-6">
      <div>
        <h2 className="text-sm font-semibold">Planos alimentares favoritos</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Planos marcados como favoritos no prontuário. Você também pode salvar refeições individuais de cada plano.
        </p>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {plans.data.map((plan) => (
          <article key={plan.id} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium">
                  <Heart className="size-4 fill-current" /> {plan.patientName}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">Consulta de {formatDate(plan.consultationDate)}</p>
              </div>
              <MacroSummary totals={plan.totals} />
            </div>
            {plan.rationale ? (
              <p className="mt-3 line-clamp-3 text-xs text-muted-foreground">{plan.rationale}</p>
            ) : null}
            <div className="mt-4 space-y-2">
              {plan.meals.map((meal) => (
                <div key={meal.slot} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{meal.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {meal.items.map((item) => item.name).join(" · ") || "Sem itens"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={saveMeal.isPending}
                    onClick={() => saveMeal.mutate({ plan, meal })}
                  >
                    <BookmarkPlus className="size-3.5" /> Salvar refeição
                  </Button>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

export function FavoriteMealsLibrary() {
  const queryClient = useQueryClient();
  const meals = useQuery({ queryKey: ["favorite-meals"], queryFn: listFavoriteMeals });
  const remove = useMutation({
    mutationFn: (meal: FavoriteMeal) => removeFavoriteMeal(meal),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["favorite-meals"] });
      toast.success("Refeição removida dos favoritos.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (meals.isLoading) return <Status>Carregando refeições favoritas…</Status>;
  if (meals.isError) return <Status error>Não foi possível carregar as refeições favoritas.</Status>;
  if (!meals.data?.length) {
    return (
      <EmptyState
        title="Nenhuma refeição favorita"
        description="Abra a aba Planos alimentares e salve as refeições que você deseja reutilizar em outros planos."
      />
    );
  }

  return (
    <div className="space-y-4 px-4 py-6 sm:px-6">
      <div>
        <h2 className="text-sm font-semibold">Refeições favoritas</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Combinações completas salvas a partir dos seus planos alimentares favoritos.
        </p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {meals.data.map((meal) => (
          <article key={`${meal.sourceConsultationId}-${meal.key}`} className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-sm font-medium">{meal.label}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {meal.patientName ?? "Paciente"}{meal.consultationDate ? ` · ${formatDate(meal.consultationDate)}` : ""}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-8 text-destructive"
                aria-label={`Remover ${meal.label} dos favoritos`}
                disabled={remove.isPending}
                onClick={() => remove.mutate(meal)}
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              {meal.items.map((item, index) => (
                <div key={`${item.name}-${index}`}>
                  {item.name}
                  {item.grams ? ` · ${Math.round(item.grams)} g` : item.household_measure ? ` · ${item.household_measure}` : ""}
                </div>
              ))}
            </div>
            <div className="mt-4">
              <MacroSummary totals={meal.totals} />
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function MacroSummary({ totals }: { totals: Record<string, number> }) {
  const kcal = totals["kcal"];
  const protein = totals["protein_g"];
  const carb = totals["carb_g"];
  const fat = totals["fat_g"];
  return (
    <div className="text-right text-[11px] tabular-nums text-muted-foreground">
      {Number.isFinite(kcal) ? <div className="font-medium text-foreground">{Math.round(kcal ?? 0)} kcal</div> : null}
      {[protein, carb, fat].some((value) => Number.isFinite(value)) ? (
        <div>P {round(protein)} · C {round(carb)} · G {round(fat)}</div>
      ) : null}
    </div>
  );
}

function round(value: number | undefined) {
  return Number.isFinite(value) ? Math.round((value ?? 0) * 10) / 10 : "—";
}

function formatDate(value: string) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

function Status({ children, error = false }: { children: React.ReactNode; error?: boolean }) {
  return <p className={`px-4 py-8 text-sm sm:px-6 ${error ? "text-destructive" : "text-muted-foreground"}`}>{children}</p>;
}

function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-4 py-6 sm:px-6">
      <div className="rounded-lg border border-dashed border-border p-10 text-center">
        <p className="text-sm font-medium">{title}</p>
        <p className="mx-auto mt-2 max-w-xl text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
