import { supabase } from "@/integrations/supabase/client";
import type { Recipe } from "./types";

const json = (value: unknown) => value as never;

export type RecipeInput = Omit<Recipe, "id">;

function unwrap<T>(result: { data: T | null; error: { message: string } | null }): T {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export async function listRecipes() {
  return unwrap(await supabase.from("recipes").select("*").order("name")) as unknown as Recipe[];
}

export async function createRecipe(recipe: RecipeInput) {
  return unwrap(
    await supabase.from("recipes").insert(json(recipe)).select().single(),
  ) as unknown as Recipe;
}

export async function updateRecipe(id: string, recipe: RecipeInput) {
  return unwrap(
    await supabase.from("recipes").update(json(recipe)).eq("id", id).select().single(),
  ) as unknown as Recipe;
}

export async function deleteRecipe(id: string) {
  const { error } = await supabase.from("recipes").delete().eq("id", id);
  if (error) throw new Error(error.message);
}
