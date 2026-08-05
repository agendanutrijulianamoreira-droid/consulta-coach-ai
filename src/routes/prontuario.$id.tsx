import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/nutrios/app-shell";
import * as db from "@/lib/nutrios/repository";
import { MEAL_SLOT_LABELS } from "@/lib/nutrios/types";

export const Route = createFileRoute("/prontuario/$id")({
  head: () => ({
    meta: [
      { title: "Prontuário da consulta — NutriOS" },
      { name: "description", content: "Prontuário gerado automaticamente a partir da consulta." },
      { property: "og:title", content: "Prontuário da consulta — NutriOS" },
      { property: "og:description", content: "Resumo clínico, conduta e plano alimentar em um só lugar." },
    ],
  }),
  component: RecordPage,
});

function RecordPage() {
  const { id } = Route.useParams();
  const consultation = useQuery({ queryKey: ["consultation", id], queryFn: () => db.getConsultation(id) });
  const plan = useQuery({ queryKey: ["plan", id], queryFn: () => db.getMealPlan(id) });
  const anthropometry = useQuery({ queryKey: ["anthro", id], queryFn: () => db.getAnthropometry(id) });

  return (
    <AppShell title="Prontuário">
      <article className="mx-auto max-w-3xl space-y-8 px-6 py-10 print:py-0">
        <header>
          <h1 className="text-xl font-semibold tracking-tight">
            {consultation.data?.patients?.name ?? "Paciente"}
          </h1>
          <p className="text-xs text-muted-foreground">Documento gerado pelo NutriOS — revisar antes de assinar.</p>
        </header>

        <Section title="Resumo clínico">{consultation.data?.clinical_summary ?? "Ainda não gerado."}</Section>
        <Section title="Antropometria">{anthropometry.data?.interpretation || "Sem interpretação registrada."}</Section>

        <section>
          <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Plano alimentar</h2>
          {plan.data ? (
            <div className="space-y-3">
              {plan.data.plan.meals.map((meal) => (
                <div key={meal.slot} className="rounded-md border border-border p-3 text-sm">
                  <div className="mb-1 font-medium">{MEAL_SLOT_LABELS[meal.slot]}</div>
                  <ul className="text-muted-foreground">
                    {meal.items.map((item) => (
                      <li key={item.food_id}>
                        {item.name} — {item.grams} g ({item.household_measure})
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              <p className="whitespace-pre-wrap text-sm">{plan.data.rationale}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Plano ainda não gerado.</p>
          )}
        </section>

        <button
          onClick={() => window.print()}
          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-accent print:hidden"
        >
          Imprimir / salvar PDF
        </button>
      </article>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="whitespace-pre-wrap text-sm">{children}</div>
    </section>
  );
}