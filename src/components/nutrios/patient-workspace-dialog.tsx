import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, Pencil, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PatientDialog } from "@/components/nutrios/patient-dialog";
import { ClinicalModuleSection, type ClinicalSection } from "@/components/nutrios/clinical-module-section";
import * as db from "@/lib/nutrios/repository";

export type WorkspaceSection =
  | "perfil"
  | "consulta"
  | "anamnese"
  | "antropometria"
  | "calculos"
  | "recordatorio"
  | "diagnostico"
  | "plano"
  | "parecer"
  | "historico";

type Props = {
  open: boolean;
  patientId: string | null;
  initialConsultationId?: string | null | undefined;
  initialSection?: WorkspaceSection | undefined;
  onOpenChange: (open: boolean) => void;
};

const SECTIONS: { id: WorkspaceSection; label: string }[] = [
  { id: "perfil", label: "Perfil" },
  { id: "consulta", label: "Consulta" },
  { id: "anamnese", label: "Anamnese" },
  { id: "antropometria", label: "Antropometria" },
  { id: "calculos", label: "Cálculos" },
  { id: "recordatorio", label: "Recordatório" },
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "plano", label: "Plano alimentar" },
  { id: "parecer", label: "Parecer" },
  { id: "historico", label: "Histórico" },
];

const CLINICAL_SECTIONS = new Set<WorkspaceSection>([
  "consulta",
  "anamnese",
  "antropometria",
  "calculos",
  "recordatorio",
  "diagnostico",
  "plano",
  "parecer",
]);

export function PatientWorkspaceDialog({
  open,
  patientId,
  initialConsultationId = null,
  initialSection = "perfil",
  onOpenChange,
}: Props) {
  const [section, setSection] = useState<WorkspaceSection>(initialSection);
  const [consultationId, setConsultationId] = useState<string | null>(initialConsultationId ?? null);
  const [editing, setEditing] = useState(false);

  const patient = useQuery({
    queryKey: ["patient", patientId],
    queryFn: () => db.getPatient(patientId!),
    enabled: open && !!patientId,
  });
  const dossier = useQuery({
    queryKey: ["patient-dossier", patientId],
    queryFn: () => db.getPatientDossier(patientId!),
    enabled: open && !!patientId,
  });

  const rows = useMemo(() => dossier.data?.consultations ?? [], [dossier.data?.consultations]);

  useEffect(() => {
    if (!open) return;
    setSection(initialSection);
    setConsultationId(initialConsultationId ?? null);
  }, [open, patientId, initialConsultationId, initialSection]);

  const selectSection = (next: WorkspaceSection) => {
    setSection(next);
    setConsultationId(null);
  };

  const p = patient.data;

  return (
    <Dialog open={open && !!patientId} onOpenChange={onOpenChange}>
      <DialogContent
        className="grid h-[94vh] w-[94vw] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-none"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <DialogTitle className="sr-only">Prontuário de {p?.name ?? "paciente"}</DialogTitle>
        <DialogDescription className="sr-only">Prontuário clínico unificado do paciente.</DialogDescription>

        <header className="flex min-h-16 items-center justify-between gap-4 border-b border-border px-5 sm:px-6">
          <div className="min-w-0">
            <div className="truncate text-base font-semibold tracking-tight">{p?.name ?? "Carregando…"}</div>
            <div className="mt-0.5 truncate text-xs text-muted-foreground">{p ? describe(p) : ""}</div>
          </div>
          <div className="flex items-center gap-2">
            {p?.tags?.slice(0, 3).map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}
            <Button variant="ghost" size="icon" aria-label="Fechar prontuário" onClick={() => onOpenChange(false)}>
              <X />
            </Button>
          </div>
        </header>

        <div className="grid min-h-0 grid-cols-[190px_minmax(0,1fr)] md:grid-cols-[210px_minmax(0,1fr)]">
          <aside className="overflow-y-auto border-r border-border bg-muted/20 px-3 py-4">
            <nav className="grid gap-1" aria-label="Seções do prontuário">
              {SECTIONS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectSection(item.id)}
                  className={`relative rounded-md px-3 py-2 text-left text-sm transition-colors ${
                    section === item.id
                      ? "bg-background font-medium text-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                  }`}
                >
                  {section === item.id ? <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary" /> : null}
                  {item.label}
                </button>
              ))}
            </nav>
          </aside>

          <main className="min-h-0 overflow-y-auto bg-background">
            {section === "perfil" ? (
              <Profile
                patient={p ?? null}
                rows={rows}
                dossier={dossier.data}
                onEdit={() => setEditing(true)}
                onOpenSection={selectSection}
              />
            ) : section === "historico" ? (
              <History
                rows={rows}
                dossier={dossier.data}
                onOpen={(id) => {
                  setConsultationId(id);
                  setSection("consulta");
                }}
                onNew={() => selectSection("consulta")}
              />
            ) : CLINICAL_SECTIONS.has(section) && patientId ? (
              <ClinicalModuleSection
                key={`${patientId}-${section}-${consultationId ?? "list"}`}
                patientId={patientId}
                section={section as ClinicalSection}
                initialConsultationId={consultationId}
              />
            ) : null}
          </main>
        </div>

        <PatientDialog open={editing} onOpenChange={setEditing} patient={p ?? null} />
      </DialogContent>
    </Dialog>
  );
}

function Profile({
  patient,
  rows,
  dossier,
  onEdit,
  onOpenSection,
}: {
  patient: db.Patient | null;
  rows: db.Consultation[];
  dossier: Awaited<ReturnType<typeof db.getPatientDossier>> | undefined;
  onEdit: () => void;
  onOpenSection: (section: WorkspaceSection) => void;
}) {
  const last = rows[0];
  const lastAnthro = last ? dossier?.anthro[last.id] : undefined;
  const lastPlan = last ? dossier?.plans[last.id] : undefined;
  const lastReport = last ? dossier?.reports[last.id] : undefined;

  return (
    <div className="mx-auto max-w-5xl px-6 py-7 lg:px-10 lg:py-9">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Perfil</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Visão geral do paciente</h2>
        </div>
        <Button variant="secondary" size="sm" disabled={!patient} onClick={onEdit}><Pencil /> Editar cadastro</Button>
      </div>

      <section className="mt-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold">Fluxo da consulta</h3>
            <p className="mt-1 text-xs text-muted-foreground">Acesse diretamente as áreas mais usadas do atendimento.</p>
          </div>
          <Activity className="size-4 text-muted-foreground" />
        </div>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          <FlowButton label="Consulta" onClick={() => onOpenSection("consulta")} />
          <FlowButton label="Anamnese" onClick={() => onOpenSection("anamnese")} />
          <FlowButton label="Antropometria" onClick={() => onOpenSection("antropometria")} />
          <FlowButton label="Plano alimentar" onClick={() => onOpenSection("plano")} />
        </div>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_0.85fr]">
        <section>
          <h3 className="text-sm font-semibold">Dados cadastrais</h3>
          <dl className="mt-3 divide-y divide-border border-y border-border text-sm">
            <Row label="CPF" value={patient?.cpf} />
            <Row label="Nascimento" value={patient?.birth_date ? formatDate(patient.birth_date) : null} />
            <Row label="Sexo" value={patient?.sex ? (patient.sex === "feminino" ? "Feminino" : "Masculino") : null} />
            <Row label="Telefone" value={patient?.phone} />
            <Row label="E-mail" value={patient?.email} />
            <Row label="Última consulta" value={last ? formatDate(last.consultation_date ?? last.created_at) : null} />
          </dl>
        </section>

        <section>
          <h3 className="text-sm font-semibold">Último acompanhamento</h3>
          <dl className="mt-3 divide-y divide-border border-y border-border text-sm">
            <Row label="Status" value={last ? (last.status === "finalizada" ? "Finalizada" : "Em aberto") : null} />
            <Row label="Peso" value={lastAnthro?.["peso"] ? `${lastAnthro["peso"]} kg` : null} />
            <Row label="Plano" value={lastPlan?.kcal ? `${Math.round(lastPlan.kcal)} kcal` : null} />
            <Row label="Parecer" value={lastReport ? "Disponível" : null} />
          </dl>
        </section>
      </div>

      <section className="mt-8 border-t border-border pt-6">
        <h3 className="text-sm font-semibold">Observações</h3>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{patient?.notes || "Sem observações registradas."}</p>
        {patient?.tags?.length ? (
          <div className="mt-5 flex flex-wrap gap-1.5">{patient.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div>
        ) : null}
      </section>
    </div>
  );
}

function FlowButton({ label, onClick }: { label: string; onClick: () => void }) {
  return <Button type="button" variant="outline" className="h-auto justify-start px-4 py-3 text-sm" onClick={onClick}>{label}</Button>;
}

function History({
  rows,
  dossier,
  onOpen,
  onNew,
}: {
  rows: db.Consultation[];
  dossier: Awaited<ReturnType<typeof db.getPatientDossier>> | undefined;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-7 lg:px-10 lg:py-9">
      <div className="flex items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Histórico</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Linha do tempo clínica</h2>
          <p className="mt-1 text-sm text-muted-foreground">O histórico é formado automaticamente por todos os registros e consultas do paciente.</p>
        </div>
        <Button size="sm" onClick={onNew}>Nova consulta</Button>
      </div>
      <div className="mt-6 divide-y divide-border border-y border-border">
        {rows.length ? rows.map((consultation) => {
          const anthro = dossier?.anthro[consultation.id] ?? {};
          const plan = dossier?.plans[consultation.id];
          const report = dossier?.reports[consultation.id];
          return (
            <button key={consultation.id} type="button" onClick={() => onOpen(consultation.id)} className="grid w-full gap-2 px-1 py-4 text-left hover:bg-muted/30 sm:grid-cols-[170px_1fr_auto] sm:items-center">
              <span className="text-sm font-medium">{formatDate(consultation.consultation_date ?? consultation.created_at)}</span>
              <span className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span>{consultation.status === "finalizada" ? "Finalizada" : "Em aberto"}</span>
                {anthro["peso"] ? <span>{anthro["peso"]} kg</span> : null}
                {plan?.kcal ? <span>{Math.round(plan.kcal)} kcal</span> : null}
                {report ? <span>Parecer disponível</span> : null}
              </span>
              <span className="text-xs font-medium text-foreground">Abrir consulta</span>
            </button>
          );
        }) : <p className="py-10 text-sm text-muted-foreground">Nenhum registro clínico ainda.</p>}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null | undefined }) {
  return <div className="flex items-center justify-between gap-4 py-2.5"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="truncate text-sm">{value || "—"}</dd></div>;
}

function describe(patient: db.Patient) {
  const parts: string[] = [];
  if (patient.birth_date) {
    const age = Math.floor((Date.now() - new Date(patient.birth_date).getTime()) / 31557600000);
    if (Number.isFinite(age) && age >= 0) parts.push(`${age} anos`);
  }
  if (patient.sex) parts.push(patient.sex === "feminino" ? "Feminino" : "Masculino");
  if (patient.phone) parts.push(patient.phone);
  return parts.join(" · ") || "Cadastro incompleto";
}

function formatDate(value: string) {
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}
