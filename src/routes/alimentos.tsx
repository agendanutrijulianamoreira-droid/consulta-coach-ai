import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/nutrios/app-shell";
import { FoodDialog } from "@/components/nutrios/food-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { deleteFood, listFoods } from "@/lib/nutrios/repository";
import type { Food } from "@/lib/nutrios/types";

export const Route = createFileRoute("/alimentos")({
  head: () => ({
    meta: [
      { title: "Base de alimentos — NutriOS" },
      {
        name: "description",
        content: "Base própria de alimentos usada pelo motor de regras do plano alimentar.",
      },
      { property: "og:title", content: "Base de alimentos — NutriOS" },
      {
        property: "og:description",
        content: "Porções, medidas caseiras e macros da base clínica.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FoodsPage,
});

function FoodsPage() {
  const queryClient = useQueryClient();
  const foods = useQuery({ queryKey: ["foods"], queryFn: listFoods });
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Food | null>(null);
  const [removing, setRemoving] = useState<Food | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (foods.data ?? []).filter(
      (food) =>
        !term ||
        food.name.toLowerCase().includes(term) ||
        food.group_name.toLowerCase().includes(term),
    );
  }, [foods.data, search]);

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
    <AppShell title="Base de alimentos">
      <div className="px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar alimento ou grupo"
              aria-label="Buscar alimento"
              className="h-8 pl-8 text-xs"
            />
          </div>
          <Button
            size="sm"
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          >
            <Plus /> Novo alimento
          </Button>
        </div>

        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-border">
                <th className="px-3 py-2 text-left font-medium">Alimento</th>
                <th className="px-3 py-2 text-left font-medium">Grupo</th>
                <th className="px-3 py-2 text-left font-medium">Porção</th>
                <th className="px-3 py-2 text-right font-medium">kcal</th>
                <th className="px-3 py-2 text-right font-medium">P/C/G</th>
                <th className="px-3 py-2 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.map((food) => (
                <tr key={food.id}>
                  <td className="px-3 py-2">{food.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{food.group_name}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {food.portion_grams} g · {food.household_measure}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{food.kcal}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                    {food.protein_g}/{food.carb_g}/{food.fat_g}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Editar ${food.name}`}
                        onClick={() => {
                          setEditing(food);
                          setDialogOpen(true);
                        }}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        aria-label={`Excluir ${food.name}`}
                        onClick={() => setRemoving(food)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!filtered.length ? (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    {search ? "Nenhum alimento encontrado." : "Nenhum alimento cadastrado ainda."}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <FoodDialog open={dialogOpen} onOpenChange={setDialogOpen} food={editing} />
      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {removing?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. Cardápios já salvos que usam este alimento não são
              afetados retroativamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (removing) removeFood.mutate(removing.id);
              }}
              disabled={removeFood.isPending}
            >
              {removeFood.isPending ? "Excluindo…" : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
