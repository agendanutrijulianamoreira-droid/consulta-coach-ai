/**
 * Formulário de cadastro/edição de alimentos da base própria.
 * Reutilizado tanto para criação quanto para edição (mesma superfície de dados).
 */
import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createFood, updateFood } from "@/lib/nutrios/repository";
import { RESTRICTION_OPTIONS, type Food } from "@/lib/nutrios/types";

/** Grupos usados pelo motor de regras do cardápio (COMPOSITION em meal-plan-engine.ts). */
const GROUP_OPTIONS = [
  { value: "proteina", label: "Proteína" },
  { value: "carboidrato", label: "Carboidrato" },
  { value: "leguminosa", label: "Leguminosa" },
  { value: "vegetal", label: "Vegetal" },
  { value: "fruta", label: "Fruta" },
  { value: "laticinio", label: "Laticínio" },
  { value: "gordura", label: "Gordura" },
  { value: "bebida", label: "Bebida" },
];

/** Categorias usadas para agrupar a lista de compras (buildShoppingList). */
const CATEGORY_OPTIONS = [
  "hortifruti",
  "carnes",
  "laticinios",
  "mercearia",
  "temperos",
  "congelados",
  "bebidas",
  "outros",
];

/** Etiquetas de refeição usadas pelo motor (SLOT_TO_FOOD_TAG). Vazio = serve em qualquer refeição. */
const MEAL_SLOT_OPTIONS = [
  { value: "cafe", label: "Café" },
  { value: "lanche", label: "Lanche" },
  { value: "almoco", label: "Almoço" },
  { value: "jantar", label: "Jantar" },
  { value: "ceia", label: "Ceia" },
];

type FoodForm = Omit<Food, "id" | "glycemic_index"> & { glycemic_index: string };

const EMPTY: FoodForm = {
  name: "",
  group_name: "proteina",
  category: "mercearia",
  portion_grams: 100,
  household_measure: "1 porção",
  kcal: 0,
  protein_g: 0,
  carb_g: 0,
  fat_g: 0,
  fiber_g: 0,
  glycemic_index: "",
  cost_level: 2,
  prep_minutes: 5,
  tags: [],
  meal_slots: [],
};

export function FoodDialog({
  open,
  onOpenChange,
  food,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  food?: Food | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<FoodForm>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm(
      food
        ? {
            ...food,
            glycemic_index: food.glycemic_index != null ? String(food.glycemic_index) : "",
          }
        : EMPTY,
    );
  }, [open, food]);

  const num = (key: keyof FoodForm) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: Number(value) || 0 }));

  const toggle = (key: "tags" | "meal_slots", value: string) =>
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }));

  const save = useMutation({
    mutationFn: async () => {
      const payload: Partial<Food> = {
        name: form.name.trim(),
        group_name: form.group_name,
        category: form.category,
        portion_grams: form.portion_grams,
        household_measure: form.household_measure.trim() || "1 porção",
        kcal: form.kcal,
        protein_g: form.protein_g,
        carb_g: form.carb_g,
        fat_g: form.fat_g,
        fiber_g: form.fiber_g,
        glycemic_index: form.glycemic_index.trim() ? Number(form.glycemic_index) : null,
        cost_level: form.cost_level,
        prep_minutes: form.prep_minutes,
        tags: form.tags,
        meal_slots: form.meal_slots,
      };
      return food ? updateFood(food.id, payload) : createFood(payload);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["foods"] });
      toast.success(food ? "Alimento atualizado." : "Alimento cadastrado.");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{food ? "Editar alimento" : "Novo alimento"}</DialogTitle>
          <DialogDescription>
            Estes dados alimentam o motor de regras do cardápio — nenhum alimento fora desta base é
            usado nos planos.
          </DialogDescription>
        </DialogHeader>
        <form
          className="grid max-h-[70vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (form.name.trim()) save.mutate();
          }}
        >
          <Field className="sm:col-span-2" id="food-name" label="Nome">
            <Input
              id="food-name"
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              required
            />
          </Field>
          <Field id="food-group" label="Grupo alimentar">
            <Select
              value={form.group_name}
              onValueChange={(value) => setForm((prev) => ({ ...prev, group_name: value }))}
            >
              <SelectTrigger id="food-group">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {GROUP_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="food-category" label="Categoria (lista de compras)">
            <Select
              value={form.category}
              onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
            >
              <SelectTrigger id="food-category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CATEGORY_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field id="food-portion" label="Porção de referência (g)">
            <Input
              id="food-portion"
              type="number"
              min={1}
              value={form.portion_grams}
              onChange={(e) => num("portion_grams")(e.target.value)}
            />
          </Field>
          <Field id="food-measure" label="Medida caseira">
            <Input
              id="food-measure"
              value={form.household_measure}
              onChange={(e) => setForm((prev) => ({ ...prev, household_measure: e.target.value }))}
              placeholder="ex.: 1 colher de servir"
            />
          </Field>
          <Field id="food-kcal" label="Calorias (kcal) na porção">
            <Input
              id="food-kcal"
              type="number"
              min={0}
              value={form.kcal}
              onChange={(e) => num("kcal")(e.target.value)}
            />
          </Field>
          <Field id="food-protein" label="Proteína (g)">
            <Input
              id="food-protein"
              type="number"
              min={0}
              step={0.1}
              value={form.protein_g}
              onChange={(e) => num("protein_g")(e.target.value)}
            />
          </Field>
          <Field id="food-carb" label="Carboidrato (g)">
            <Input
              id="food-carb"
              type="number"
              min={0}
              step={0.1}
              value={form.carb_g}
              onChange={(e) => num("carb_g")(e.target.value)}
            />
          </Field>
          <Field id="food-fat" label="Gordura (g)">
            <Input
              id="food-fat"
              type="number"
              min={0}
              step={0.1}
              value={form.fat_g}
              onChange={(e) => num("fat_g")(e.target.value)}
            />
          </Field>
          <Field id="food-fiber" label="Fibra (g)">
            <Input
              id="food-fiber"
              type="number"
              min={0}
              step={0.1}
              value={form.fiber_g}
              onChange={(e) => num("fiber_g")(e.target.value)}
            />
          </Field>
          <Field id="food-gi" label="Índice glicêmico (opcional)">
            <Input
              id="food-gi"
              type="number"
              min={0}
              value={form.glycemic_index}
              onChange={(e) => setForm((prev) => ({ ...prev, glycemic_index: e.target.value }))}
            />
          </Field>
          <Field id="food-cost" label="Custo (1 baixo · 3 alto)">
            <Input
              id="food-cost"
              type="number"
              min={1}
              max={3}
              value={form.cost_level}
              onChange={(e) => num("cost_level")(e.target.value)}
            />
          </Field>
          <Field id="food-prep" label="Tempo de preparo (min)">
            <Input
              id="food-prep"
              type="number"
              min={0}
              value={form.prep_minutes}
              onChange={(e) => num("prep_minutes")(e.target.value)}
            />
          </Field>
          <Field
            className="sm:col-span-2"
            id="food-slots"
            label="Refeições em que pode entrar (vazio = qualquer uma)"
          >
            <div className="flex flex-wrap gap-3">
              {MEAL_SLOT_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={form.meal_slots.includes(option.value)}
                    onChange={() => toggle("meal_slots", option.value)}
                    className="size-3.5"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </Field>
          <Field className="sm:col-span-2" id="food-tags" label="Compatível com restrições">
            <div className="flex flex-wrap gap-3">
              {RESTRICTION_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-1.5 text-xs">
                  <input
                    type="checkbox"
                    checked={form.tags.includes(option.value)}
                    onChange={() => toggle("tags", option.value)}
                    className="size-3.5"
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </Field>
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={!form.name.trim() || save.isPending}>
              {save.isPending ? "Salvando…" : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  id,
  label,
  children,
  className,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid gap-1.5 ${className ?? ""}`}>
      <Label htmlFor={id} className="text-xs text-muted-foreground">
        {label}
      </Label>
      {children}
    </div>
  );
}
