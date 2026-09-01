import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  createRecipe,
  updateRecipe,
  type RecipeInput,
} from "@/lib/nutrios/recipes-repository";
import type { Recipe } from "@/lib/nutrios/types";

const EMPTY: RecipeInput = {
  name: "",
  meal_slots: [],
  ingredients: [{ name: "", amount: "" }],
  steps: "",
  prep_minutes: 15,
  yield_label: "1 porção",
  kcal: 0,
  protein_g: 0,
  carb_g: 0,
  fat_g: 0,
  tags: [],
};

const MEAL_SLOTS = [
  ["cafe", "Café da manhã"],
  ["lanche", "Lanches"],
  ["almoco", "Almoço"],
  ["jantar", "Jantar"],
  ["ceia", "Ceia"],
] as const;

export function RecipeDialog({
  open,
  onOpenChange,
  recipe,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recipe?: Recipe | null;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<RecipeInput>(EMPTY);

  useEffect(() => {
    if (!open) return;
    setForm(recipe ? { ...recipe, ingredients: recipe.ingredients.length ? recipe.ingredients : [{ name: "", amount: "" }] } : EMPTY);
  }, [open, recipe]);

  const save = useMutation({
    mutationFn: () => (recipe ? updateRecipe(recipe.id, form) : createRecipe(form)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["recipes"] });
      toast.success(recipe ? "Receita atualizada." : "Receita cadastrada.");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const setNumber = (key: "prep_minutes" | "kcal" | "protein_g" | "carb_g" | "fat_g", value: string) =>
    setForm((current) => ({ ...current, [key]: Number(value) || 0 }));

  const toggleSlot = (slot: string) =>
    setForm((current) => ({
      ...current,
      meal_slots: current.meal_slots.includes(slot)
        ? current.meal_slots.filter((item) => item !== slot)
        : [...current.meal_slots, slot],
    }));

  const updateIngredient = (index: number, key: "name" | "amount", value: string) =>
    setForm((current) => ({
      ...current,
      ingredients: current.ingredients.map((ingredient, ingredientIndex) =>
        ingredientIndex === index ? { ...ingredient, [key]: value } : ingredient,
      ),
    }));

  const removeIngredient = (index: number) =>
    setForm((current) => ({
      ...current,
      ingredients: current.ingredients.filter((_, ingredientIndex) => ingredientIndex !== index),
    }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{recipe ? "Editar receita" : "Nova receita"}</DialogTitle>
          <DialogDescription>
            Cadastre receitas próprias para reutilização clínica e futura integração ao motor de cardápio.
          </DialogDescription>
        </DialogHeader>

        <form
          className="max-h-[72vh] space-y-5 overflow-y-auto pr-1"
          onSubmit={(event) => {
            event.preventDefault();
            if (!form.name.trim()) return;
            save.mutate();
          }}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome" htmlFor="recipe-name" className="sm:col-span-2">
              <Input
                id="recipe-name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                required
              />
            </Field>
            <Field label="Tempo de preparo (min)" htmlFor="recipe-time">
              <Input
                id="recipe-time"
                type="number"
                min={0}
                value={form.prep_minutes}
                onChange={(event) => setNumber("prep_minutes", event.target.value)}
              />
            </Field>
            <Field label="Rendimento" htmlFor="recipe-yield">
              <Input
                id="recipe-yield"
                value={form.yield_label}
                onChange={(event) => setForm((current) => ({ ...current, yield_label: event.target.value }))}
              />
            </Field>
          </div>

          <div>
            <Label className="mb-2 block">Refeições compatíveis</Label>
            <div className="flex flex-wrap gap-2">
              {MEAL_SLOTS.map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={form.meal_slots.includes(value) ? "default" : "outline"}
                  onClick={() => toggleSlot(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Ingredientes</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    ingredients: [...current.ingredients, { name: "", amount: "" }],
                  }))
                }
              >
                <Plus /> Adicionar
              </Button>
            </div>
            {form.ingredients.map((ingredient, index) => (
              <div key={index} className="grid grid-cols-[1fr_160px_auto] gap-2">
                <Input
                  value={ingredient.name}
                  placeholder="Ingrediente"
                  onChange={(event) => updateIngredient(index, "name", event.target.value)}
                />
                <Input
                  value={ingredient.amount}
                  placeholder="Quantidade"
                  onChange={(event) => updateIngredient(index, "amount", event.target.value)}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label="Remover ingrediente"
                  onClick={() => removeIngredient(index)}
                  disabled={form.ingredients.length === 1}
                >
                  <Trash2 />
                </Button>
              </div>
            ))}
          </div>

          <Field label="Modo de preparo" htmlFor="recipe-steps">
            <Textarea
              id="recipe-steps"
              rows={5}
              value={form.steps}
              onChange={(event) => setForm((current) => ({ ...current, steps: event.target.value }))}
            />
          </Field>

          <div className="grid gap-3 sm:grid-cols-4">
            <NumberField label="kcal" value={form.kcal} onChange={(value) => setNumber("kcal", value)} />
            <NumberField label="Proteína (g)" value={form.protein_g} onChange={(value) => setNumber("protein_g", value)} />
            <NumberField label="Carboidrato (g)" value={form.carb_g} onChange={(value) => setNumber("carb_g", value)} />
            <NumberField label="Gordura (g)" value={form.fat_g} onChange={(value) => setNumber("fat_g", value)} />
          </div>

          <Field label="Tags" htmlFor="recipe-tags">
            <Input
              id="recipe-tags"
              value={form.tags.join(", ")}
              placeholder="ex.: low carb, rápido, sem lactose"
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  tags: event.target.value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                }))
              }
            />
          </Field>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={save.isPending || !form.name.trim()}>
              {save.isPending ? "Salvando…" : "Salvar receita"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  htmlFor,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label htmlFor={htmlFor} className="mb-1.5 block">
        {label}
      </Label>
      {children}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <Label className="mb-1.5 block">{label}</Label>
      <Input type="number" min={0} step="0.1" value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
