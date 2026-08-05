/**
 * Motor de regras do plano alimentar.
 *
 * Domínio puro: não conhece banco de dados, rede nem IA. Recebe a base de
 * alimentos cadastrada e os critérios clínicos, e devolve um plano montado
 * exclusivamente com alimentos existentes na base. Nenhum alimento é inventado
 * e nenhuma quantidade vem de modelo de linguagem.
 */
import {
  MEAL_SLOT_LABELS,
  SLOT_TO_FOOD_TAG,
  type ConductInput,
  type Food,
  type Macros,
  type MealPlan,
  type MealPlanItem,
  type MealSlot,
  type PlannedMeal,
  type ShoppingGroup,
} from "@/lib/nutrios/types";

/** Distribuição calórica por número de refeições. */
const DISTRIBUTIONS: Record<number, { slot: MealSlot; share: number }[]> = {
  3: [
    { slot: "cafe", share: 0.3 },
    { slot: "almoco", share: 0.4 },
    { slot: "jantar", share: 0.3 },
  ],
  4: [
    { slot: "cafe", share: 0.25 },
    { slot: "almoco", share: 0.35 },
    { slot: "lanche_tarde", share: 0.15 },
    { slot: "jantar", share: 0.25 },
  ],
  5: [
    { slot: "cafe", share: 0.22 },
    { slot: "lanche_manha", share: 0.1 },
    { slot: "almoco", share: 0.33 },
    { slot: "lanche_tarde", share: 0.12 },
    { slot: "jantar", share: 0.23 },
  ],
  6: [
    { slot: "cafe", share: 0.2 },
    { slot: "lanche_manha", share: 0.1 },
    { slot: "almoco", share: 0.3 },
    { slot: "lanche_tarde", share: 0.12 },
    { slot: "jantar", share: 0.2 },
    { slot: "ceia", share: 0.08 },
  ],
};

/** Composição desejada por refeição, em grupos da base de alimentos. */
const COMPOSITION: Record<MealSlot, string[]> = {
  cafe: ["proteina", "carboidrato", "fruta", "bebida"],
  lanche_manha: ["fruta", "gordura"],
  almoco: ["proteina", "carboidrato", "leguminosa", "vegetal", "gordura"],
  lanche_tarde: ["laticinio", "carboidrato", "gordura"],
  jantar: ["proteina", "carboidrato", "vegetal", "gordura"],
  ceia: ["laticinio", "gordura"],
};

/** Peso relativo de cada grupo dentro das calorias da refeição. */
const GROUP_WEIGHT: Record<string, number> = {
  proteina: 0.4,
  carboidrato: 0.35,
  leguminosa: 0.2,
  vegetal: 0.1,
  fruta: 0.35,
  laticinio: 0.4,
  gordura: 0.2,
  bebida: 0.02,
};

function round(value: number, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function emptyMacros(): Macros {
  return { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 };
}

function addMacros(a: Macros, b: Macros): Macros {
  return {
    kcal: round(a.kcal + b.kcal),
    protein_g: round(a.protein_g + b.protein_g, 1),
    carb_g: round(a.carb_g + b.carb_g, 1),
    fat_g: round(a.fat_g + b.fat_g, 1),
  };
}

/** Um alimento respeita todas as restrições marcadas? */
export function respectsRestrictions(food: Food, restrictions: string[]): boolean {
  return restrictions.every((restriction) => food.tags.includes(restriction));
}

function matchesSlot(food: Food, slot: MealSlot): boolean {
  const tag = SLOT_TO_FOOD_TAG[slot];
  return food.meal_slots.length === 0 || food.meal_slots.includes(tag);
}

/** Pontuação determinística — preferências sobem, custo e preparo longo descem. */
function score(food: Food, preferences: string[]): number {
  const normalized = food.name.toLowerCase();
  const preferred = preferences.some((p) => p.trim() && normalized.includes(p.trim().toLowerCase()));
  return (preferred ? 100 : 0) - food.cost_level * 2 - food.prep_minutes * 0.1;
}

/**
 * Seleção estável: ordena candidatos por pontuação e faz rodízio pelo índice da
 * refeição, garantindo variedade sem aleatoriedade (o mesmo input gera o mesmo
 * plano, o que é essencial para auditar o método clínico).
 */
function pick(
  foods: Food[],
  group: string,
  slot: MealSlot,
  input: ConductInput,
  rotation: number,
): Food | null {
  const candidates = foods
    .filter((f) => f.group_name === group)
    .filter((f) => respectsRestrictions(f, input.restrictions))
    .filter((f) => matchesSlot(f, slot))
    .sort((a, b) => score(b, input.preferences) - score(a, input.preferences) || a.name.localeCompare(b.name));

  if (candidates.length === 0) return null;
  return candidates[rotation % candidates.length] ?? null;
}

function buildItem(food: Food, targetKcal: number, foods: Food[], input: ConductInput): MealPlanItem {
  const baseKcal = food.kcal > 0 ? food.kcal : 1;
  const rawFactor = targetKcal / baseKcal;
  const factor = food.kcal === 0 ? 1 : Math.min(3, Math.max(0.4, rawFactor));
  const grams = Math.max(5, round(food.portion_grams * factor));
  const applied = grams / food.portion_grams;

  const substitutions = foods
    .filter(
      (f) =>
        f.id !== food.id &&
        f.group_name === food.group_name &&
        respectsRestrictions(f, input.restrictions) &&
        f.kcal > 0,
    )
    .sort((a, b) => a.name.localeCompare(b.name))
    .slice(0, 3)
    .map((f) => {
      const targetItemKcal = food.kcal * applied;
      const subFactor = Math.min(3, Math.max(0.4, targetItemKcal / f.kcal));
      return {
        food_id: f.id,
        name: f.name,
        grams: Math.max(5, round(f.portion_grams * subFactor)),
        household_measure: f.household_measure,
      };
    });

  return {
    food_id: food.id,
    name: food.name,
    grams,
    household_measure: food.household_measure,
    category: food.category,
    group_name: food.group_name,
    macros: {
      kcal: round(food.kcal * applied),
      protein_g: round(food.protein_g * applied, 1),
      carb_g: round(food.carb_g * applied, 1),
      fat_g: round(food.fat_g * applied, 1),
    },
    substitutions,
  };
}

/** Agrupa os itens do plano na lista de compras por categoria de mercado. */
export function buildShoppingList(meals: PlannedMeal[]): ShoppingGroup[] {
  const order = ["hortifruti", "carnes", "laticinios", "mercearia", "temperos", "congelados", "bebidas"];
  const map = new Map<string, Map<string, number>>();

  for (const meal of meals) {
    for (const item of meal.items) {
      const category = map.get(item.category) ?? new Map<string, number>();
      category.set(item.name, (category.get(item.name) ?? 0) + item.grams);
      map.set(item.category, category);
    }
  }

  return [...map.entries()]
    .sort((a, b) => {
      const ia = order.indexOf(a[0]);
      const ib = order.indexOf(b[0]);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    })
    .map(([category, items]) => ({
      category,
      items: [...items.entries()]
        .map(([name, grams]) => ({ name, grams: round(grams) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }));
}

/** Monta o plano alimentar completo a partir da base cadastrada. */
export function buildMealPlan(input: ConductInput, foods: Food[]): MealPlan {
  const distribution = DISTRIBUTIONS[input.meals_count] ?? DISTRIBUTIONS[6]!;
  const meals: PlannedMeal[] = [];

  distribution.forEach((entry, index) => {
    const targetKcal = round(input.kcal * entry.share);
    const groups = COMPOSITION[entry.slot];
    const chosen: { food: Food; weight: number }[] = [];

    groups.forEach((group, groupIndex) => {
      const food = pick(foods, group, entry.slot, input, index + groupIndex);
      if (food) chosen.push({ food, weight: GROUP_WEIGHT[group] ?? 0.2 });
    });

    const weightSum = chosen.reduce((sum, c) => sum + c.weight, 0) || 1;
    const items = chosen.map((c) =>
      buildItem(c.food, (targetKcal * c.weight) / weightSum, foods, input),
    );

    meals.push({
      slot: entry.slot,
      label: MEAL_SLOT_LABELS[entry.slot],
      target_kcal: targetKcal,
      items,
      totals: items.reduce((acc, item) => addMacros(acc, item.macros), emptyMacros()),
    });
  });

  const totals = meals.reduce((acc, meal) => addMacros(acc, meal.totals), emptyMacros());

  return { meals, totals, shopping_list: buildShoppingList(meals), recipes: [] };
}

/** Metas padrão de macros quando a nutricionista informa apenas as calorias. */
export function defaultMacros(kcal: number): { protein_g: number; carb_g: number; fat_g: number } {
  return {
    protein_g: Math.round((kcal * 0.25) / 4),
    carb_g: Math.round((kcal * 0.45) / 4),
    fat_g: Math.round((kcal * 0.3) / 9),
  };
}