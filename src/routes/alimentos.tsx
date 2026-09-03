import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/nutrios/app-shell";
import { FoodLibrary } from "@/components/nutrios/food-library";

export const Route = createFileRoute("/alimentos")({
  head: () => ({
    meta: [
      { title: "Alimentos — Cach AI" },
      {
        name: "description",
        content: "Base clínica de alimentos do Cach AI.",
      },
    ],
  }),
  component: FoodsPage,
});

function FoodsPage() {
  return (
    <AppShell title="Favoritos · Alimentos">
      <FoodLibrary />
    </AppShell>
  );
}
