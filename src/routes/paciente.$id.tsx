/**
 * Ficha personalizada do paciente: cadastro, histórico de consultas,
 * evolução antropométrica e materiais gerados (parecer e cardápio).
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CalendarDays,
  FileText,
  Pencil,
  Plus,
  Ruler,
  Utensils,
} from "lucide-react";
import { AppShell } from "@/components/nutrios/app-shell";
import { PatientDialog } from "@/components/nutrios/patient-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import * as db from "@/lib/nutrios/repository";

export const Route = createFileRoute("/paciente/$id")({
  head: () => ({
    meta: [
      { title: "Ficha do paciente — NutriOS" },
      { name: "description", content: "Histórico de consultas, evolução antropométrica e materiais clínicos do paciente." },
      { property: "og:title", content: "Ficha do paciente — NutriOS" },
      { property: "og:description", content: "Tudo do paciente em um só lugar: consultas, avaliação, parecer e cardápio." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PatientPage,
});

function PatientPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));

  const patient = useQuery({ queryKey: ["patient", id], queryFn: () => db.getPatient(id) });
  const dossier = useQuery({ queryKey: ["patient-dossier", id], queryFn: () => db.getPatientDossier(id) });

  const start = useMutation({
    mutationFn: () => db.createConsultation(id, date),
    onSuccess: (consultation) => {
      void queryClient.invalidateQueries({ queryKey: ["consultations"] });
      void queryClient.invalidateQueries({ queryKey: ["consultation-dates"] });
      void navigate({ to: "/consulta/$id", params: { id: consultation.id } });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const p = patient.data;
  const rows = dossier.data?.consultations ?? [];

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-10">
        <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Pacientes
        </Link>

        <header className="mt-4 flex flex-col justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Ficha do paciente</p>
            <h1 className="mt-2 truncate text-2xl font-semibold tracking-tight sm:text-3xl">{p?.name ?? "Carregando…"}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{p ? describe(p) : ""}</p>
            {p?.tags?.length ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {p.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
              </div>
            ) : null}
          </div>
          <Button variant="secondary" onClick={() => setEditing(true)} disabled={!p}><Pencil /> Editar cadastro</Button>
        </header>

        <section className="mt-6 grid gap-3 rounded-md border border-border p-4 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-1.5 sm:max-w-56">
            <Label htmlFor="new-consult" className="text-xs text-muted-foreground">Data da nova consulta</Label>
            <Input id="new-consult" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <Button onClick={() => start.mutate()} disabled={start.isPending}>
            <Plus /> {start.isPending ? "Abrindo…" : "Registrar consulta"}
          </Button>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section aria-labelledby="history-heading">
            <h2 id="history-heading" className="text-sm font-semibold">Consultas</h2>
            <p className="mt-1 text-xs text-muted-foreground">Histórico completo com os materiais gerados em cada atendimento.</p>
            <div className="mt-3 divide-y divide-border rounded-md border border-border">
              {rows.length ? rows.map((consultation) => {
                const anthro = dossier.data?.anthro[consultation.id] ?? {};
                const plan = dossier.data?.plans[consultation.id];
                const hasReport = !!dossier.data?.reports[consultation.id];
                return (
                  <div key={consultation.id} className="grid gap-2 px-3 py-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-medium">
                        <CalendarDays className="size-3.5 text-muted-foreground" />
                        {formatDate(consultation.consultation_date ?? consultation.created_at)}
                      </span>
                      <span className="text-xs text-muted-foreground">{consultation.status === "finalizada" ? "Finalizada" : "Em aberto"}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
                      {anthro["peso"] ? <Badge variant="outline"><Ruler className="mr-1 size-3" />{anthro["peso"]} kg{bmiLabel(anthro)}</Badge> : null}
                      {plan?.kcal ? <Badge variant="outline"><Utensils className="mr-1 size-3" />{Math.round(plan.kcal)} kcal</Badge> : null}
                      {hasReport ? <Badge variant="secondary"><FileText className="mr-1 size-3" />Parecer</Badge> : null}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" variant="secondary" onClick={() => navigate({ to: "/consulta/$id", params: { id: consultation.id } })}>Abrir consulta</Button>
                      <Button size="sm" variant="ghost" onClick={() => navigate({ to: "/prontuario/$id", params: { id: consultation.id } })}>Parecer / PDF</Button>
                    </div>
                  </div>
                );
              }) : <p className="px-3 py-8 text-sm text-muted-foreground">Nenhuma consulta registrada para este paciente.</p>}
            </div>
          </section>

          <aside className="grid gap-6">
            <section aria-labelledby="data-heading">
              <h2 id="data-heading" className="text-sm font-semibold">Dados cadastrais</h2>
              <dl className="mt-3 grid gap-2 rounded-md border border-border p-3 text-sm">
                <Row label="CPF" value={p?.cpf} />
                <Row label="Nascimento" value={p?.birth_date ? formatDate(p.birth_date) : null} />
                <Row label="Sexo" value={p?.sex ? (p.sex === "feminino" ? "Feminino" : "Masculino") : null} />
                <Row label="Telefone" value={p?.phone} />
                <Row label="E-mail" value={p?.email} />
                <Row label="Gestante" value={p?.is_pregnant ? (p.pregnancy_weeks ? `Sim · ${p.pregnancy_weeks} sem` : "Sim") : null} />
              </dl>
            </section>
            <section aria-labelledby="evolution-heading">
              <h2 id="evolution-heading" className="text-sm font-semibold">Evolução de peso</h2>
              <div className="mt-3 rounded-md border border-border p-3 text-sm">
                {rows.filter((c) => dossier.data?.anthro[c.id]?.["peso"]).length ? (
                  <ul className="grid gap-1.5">
                    {rows
                      .filter((c) => dossier.data?.anthro[c.id]?.["peso"])
                      .map((c) => (
                        <li key={c.id} className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">{formatDate(c.consultation_date ?? c.created_at)}</span>
                          <span className="tabular-nums font-medium">{dossier.data?.anthro[c.id]?.["peso"]} kg</span>
                        </li>
                      ))}
                  </ul>
                ) : <p className="text-sm text-muted-foreground">Sem medidas registradas ainda.</p>}
              </div>
            </section>
            <section aria-labelledby="notes-heading">
              <h2 id="notes-heading" className="text-sm font-semibold">Observações</h2>
              <p className="mt-3 whitespace-pre-wrap rounded-md border border-border p-3 text-sm text-muted-foreground">
                {p?.notes || "Sem observações."}
              </p>
            </section>
          </aside>
        </div>
      </div>
      <PatientDialog open={editing} onOpenChange={setEditing} patient={p ?? null} />
    </AppShell>
  );
}

function Row({ label, value }: { label: string; value?: string | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm">{value || "—"}</dd>
    </div>
  );
}

function bmiLabel(anthro: Record<string, string | undefined>) {
  const weight = Number(anthro["peso"]);
  const height = Number(anthro["altura"]) / 100;
  if (!weight || !height) return "";
  return ` · IMC ${(weight / (height * height)).toFixed(1)}`;
}

function formatDate(value: string) {
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function describe(patient: db.Patient) {
  const parts: string[] = [];
  if (patient.birth_date) {
    const age = Math.floor((Date.now() - new Date(patient.birth_date).getTime()) / 31557600000);
    if (Number.isFinite(age) && age >= 0) parts.push(`${age} anos`);
  }
  if (patient.sex) parts.push(patient.sex === "feminino" ? "Feminino" : "Masculino");
  if (patient.is_pregnant) parts.push(patient.pregnancy_weeks ? `Gestante · ${patient.pregnancy_weeks} sem` : "Gestante");
  if (patient.phone) parts.push(patient.phone);
  return parts.join(" · ") || "Cadastro incompleto";
}
