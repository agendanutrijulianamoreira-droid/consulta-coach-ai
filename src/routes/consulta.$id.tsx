import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/nutrios/app-shell";
import { ConsultationWorkspace } from "@/components/nutrios/consultation-workspace";

export const Route = createFileRoute("/consulta/$id")({
  head: () => ({
    meta: [
      { title: "Consulta clínica — Cach AI" },
      { name: "description", content: "Consulta clínica com transcrição, avaliação completa, exames, cálculos energéticos e cardápio." },
      { property: "og:title", content: "Consulta clínica — Cach AI" },
      { property: "og:description", content: "Consulta clínica com avaliação longitudinal e exames laboratoriais." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConsultationPage,
});

function ConsultationPage() {
  const { id } = Route.useParams();
  return (
    <AppShell>
      <ConsultationWorkspace consultationId={id} />
    </AppShell>
  );
}
