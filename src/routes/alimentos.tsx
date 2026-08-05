import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/nutrios/app-shell";
import { listFoods } from "@/lib/nutrios/repository";

export const Route = createFileRoute("/alimentos")({
  head: () => ({
    meta: [
      { title: "Base de alimentos — NutriOS" },
      { name: "description", content: "Base própria de alimentos usada pelo motor de regras do plano alimentar." },
      { property: "og:title", content: "Base de alimentos — NutriOS" },
      { property: "og:description", content: "Porções, medidas caseiras e macros da base clínica." },
    ],
  }),
  component: FoodsPage,
});

function FoodsPage() {
  const foods = useQuery({ queryKey: ["foods"], queryFn: listFoods });
  return (
    <AppShell title="Base de alimentos">
      <div className="px-5 py-6">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b border-border">
              <th className="py-2 text-left font-medium">Alimento</th>
              <th className="py-2 text-left font-medium">Grupo</th>
              <th className="py-2 text-left font-medium">Porção</th>
              <th className="py-2 text-right font-medium">kcal</th>
              <th className="py-2 text-right font-medium">P/C/G</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(foods.data ?? []).map((food) => (
              <tr key={food.id}>
                <td className="py-2">{food.name}</td>
                <td className="py-2 text-muted-foreground">{food.group_name}</td>
                <td className="py-2 text-muted-foreground">
                  {food.portion_grams} g · {food.household_measure}
                </td>
                <td className="py-2 text-right tabular-nums">{food.kcal}</td>
                <td className="py-2 text-right tabular-nums text-muted-foreground">
                  {food.protein_g}/{food.carb_g}/{food.fat_g}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}