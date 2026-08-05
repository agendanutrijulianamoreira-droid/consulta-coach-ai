import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/nutrios/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createConsultation,
  createPatient,
  listConsultations,
  listPatients,
} from "@/lib/nutrios/repository";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "NutriOS — Consulta nutricional automatizada" },
      {
        name: "description",
        content:
          "Plataforma para nutricionistas: transcrição ao vivo, anamnese automática, plano alimentar por motor de regras e prontuário pronto.",
      },
      { property: "og:title", content: "NutriOS — Consulta nutricional automatizada" },
      {
        property: "og:description",
        content: "Reduza o tempo de documentação clínica e monte o plano alimentar em minutos.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");

  const patients = useQuery({ queryKey: ["patients"], queryFn: listPatients });
  const consultations = useQuery({ queryKey: ["consultations"], queryFn: listConsultations });

  const addPatient = useMutation({
    mutationFn: () => createPatient({ name: name.trim() }),
    onSuccess: () => {
      setName("");
      void queryClient.invalidateQueries({ queryKey: ["patients"] });
      toast.success("Paciente cadastrado.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const startConsultation = useMutation({
    mutationFn: (patientId: string) => createConsultation(patientId),
    onSuccess: (consultation) => navigate({ to: "/consulta/$id", params: { id: consultation.id } }),
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Pacientes</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastre o paciente e inicie a consulta. A gravação, a transcrição e a anamnese acontecem sozinhas.
        </p>

        <form
          className="mt-6 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (name.trim()) addPatient.mutate();
          }}
        >
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Nome do paciente"
            className="max-w-sm"
          />
          <Button type="submit" disabled={!name.trim() || addPatient.isPending}>
            Adicionar
          </Button>
        </form>

        <div className="mt-8 grid gap-8 md:grid-cols-2">
          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cadastrados
            </h2>
            <div className="divide-y divide-border rounded-md border border-border">
              {patients.data?.length ? (
                patients.data.map((patient) => (
                  <div key={patient.id} className="flex items-center justify-between px-3 py-2.5 text-sm">
                    <span>{patient.name}</span>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => startConsultation.mutate(patient.id)}
                      disabled={startConsultation.isPending}
                    >
                      Nova consulta
                    </Button>
                  </div>
                ))
              ) : (
                <p className="px-3 py-6 text-sm text-muted-foreground">Nenhum paciente ainda.</p>
              )}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Consultas recentes
            </h2>
            <div className="divide-y divide-border rounded-md border border-border">
              {consultations.data?.length ? (
                consultations.data.map((consultation) => (
                  <button
                    key={consultation.id}
                    onClick={() => navigate({ to: "/consulta/$id", params: { id: consultation.id } })}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left text-sm hover:bg-accent"
                  >
                    <span>{consultation.patients?.name ?? "Paciente"}</span>
                    <span className="text-xs text-muted-foreground">
                      {consultation.status === "finalizada" ? "Finalizada" : "Em aberto"}
                    </span>
                  </button>
                ))
              ) : (
                <p className="px-3 py-6 text-sm text-muted-foreground">Nenhuma consulta registrada.</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
