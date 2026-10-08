import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/nutrios/app-shell";
import { PatientWorkspaceDialog } from "@/components/nutrios/patient-workspace-dialog";

export const Route = createFileRoute("/paciente/$id")({
  head: () => ({
    meta: [
      { title: "Prontuário do paciente — Cach AI" },
      { name: "description", content: "Prontuário clínico unificado do paciente." },
      { property: "og:title", content: "Prontuário do paciente — Cach AI" },
      {
        property: "og:description",
        content: "Cadastro, consultas e documentação clínica em uma única superfície.",
      },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PatientPage,
});

function PatientPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  return (
    <AppShell>
      <PatientWorkspaceDialog
        open
        patientId={id}
        initialSection="perfil"
        onOpenChange={(open) => {
          if (!open) void navigate({ to: "/" });
        }}
      />
    </AppShell>
  );
}
