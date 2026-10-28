import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/nutrios/app-shell";
import { AgendaPage } from "@/modules/agenda/ui/agenda-page";

export const Route = createFileRoute("/agenda")({
  head: () => ({ meta: [{ title: "Agenda — Cach AI" }] }),
  component: AgendaRoute,
});

function AgendaRoute() {
  return (
    <AppShell title="Agenda">
      <AgendaPage />
    </AppShell>
  );
}
