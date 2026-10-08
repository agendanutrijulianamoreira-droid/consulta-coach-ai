import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, Contact, FileText, Pencil, Plus, Settings, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { PatientDialog } from "@/components/nutrios/patient-dialog";
import { ConsultationRegistrationDialog } from "@/components/nutrios/consultation-registration-dialog";
import { ClinicalModuleSection, type ClinicalSection } from "@/components/nutrios/clinical-module-section";
import { ConsultationWorkspace } from "@/components/nutrios/consultation-workspace";
import { MetabolicMapSection } from "@/modules/metabolico/ui/metabolic-map-section";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import * as db from "@/lib/nutrios/repository";
import * as labDb from "@/modules/exames/infrastructure/labs-repository";

export type WorkspaceSection =
  | "perfil"
  | "consulta"
  | "anamnese"
  | "antropometria"
  | "calculos"
  | "recordatorio"
  | "exames"
  | "diagnostico"
  | "plano"
  | "parecer"
  | "metabolico"
  | "historico";

type Props = {
  open: boolean;
  patientId: string | null;
  initialConsultationId?: string | null | undefined;
  initialSection?: WorkspaceSection | undefined;
  onOpenChange: (open: boolean) => void;
};

const SECTIONS: { id: WorkspaceSection; label: string }[] = [
  { id: "perfil", label: "Configurações" },
  { id: "historico", label: "Histórico de consultas" },
  { id: "anamnese", label: "Anamnese" },
  { id: "antropometria", label: "Antropometria" },
  { id: "calculos", label: "Cálculos" },
  { id: "recordatorio", label: "Recordatório" },
  { id: "exames", label: "Exames" },
  { id: "metabolico", label: "Mapa Metabólico" },
  { id: "diagnostico", label: "Diagnóstico" },
  { id: "plano", label: "Plano alimentar" },
  { id: "parecer", label: "Parecer" },
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

const WORKSPACE_STEPS: Partial<Record<WorkspaceSection, number>> = {
  consulta: 0, anamnese: 1, antropometria: 2, calculos: 3, recordatorio: 4,
  exames: 5, diagnostico: 6, plano: 7, parecer: 7,
};

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
  const [registering, setRegistering] = useState(false);
  const [consultationRecording, setConsultationRecording] = useState(false);
  const queryClient = useQueryClient();

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

  const allRows = useMemo(() => dossier.data?.consultations ?? [], [dossier.data?.consultations]);
  const rows = useMemo(() => allRows.filter((consultation) => consultation.record_kind === "attendance" && consultation.visible_in_history), [allRows]);

  const registerConsultation = useMutation({
    mutationFn: ({ date, observations }: { date: string; observations: string }) => db.createConsultation(patientId!, date, observations),
    onSuccess: async (consultation) => {
      setRegistering(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["patient-dossier", patientId] }),
        queryClient.invalidateQueries({ queryKey: ["consultations"] }),
        queryClient.invalidateQueries({ queryKey: ["consultation-dates"] }),
      ]);
      setConsultationId(consultation.id);
      setSection("consulta");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  useEffect(() => {
    if (!open) return;
    setSection(initialSection);
    setConsultationId(initialConsultationId ?? null);
  }, [open, patientId, initialConsultationId, initialSection]);

  const selectSection = (next: WorkspaceSection) => {
    setSection(next);
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
            {consultationId && patientId ? (
              <div className={CLINICAL_SECTIONS.has(section) || section === "exames" ? "" : "hidden"}>
                <div className="border-b border-border px-6 py-3">
                  <Button type="button" variant="ghost" size="sm" disabled={consultationRecording} onClick={() => setConsultationId(null)}><ArrowLeft /> {consultationRecording ? "Encerre a gravação para voltar aos registros" : "Voltar aos registros desta aba"}</Button>
                </div>
                <ConsultationWorkspace key={`${patientId}-${consultationId}`} consultationId={consultationId} activeStep={WORKSPACE_STEPS[section] ?? 0} embedded onRecordingChange={setConsultationRecording} />
              </div>
            ) : null}

            {section === "perfil" ? (
              <Profile
                patient={p ?? null}
                rows={allRows}
                onEdit={() => setEditing(true)}
                onOpenSection={selectSection}
              />
            ) : section === "historico" ? (
              <History
                rows={rows}
                patientId={patientId!}
                onNew={() => setRegistering(true)}
              />
            ) : section === "exames" && patientId && !consultationId ? (
              <ExamsSection
                patientId={patientId}
                rows={rows}
                consultationId={consultationId}
                onOpen={setConsultationId}
              />
            ) : CLINICAL_SECTIONS.has(section) && patientId && !consultationId ? (
              <ClinicalModuleSection
                key={patientId}
                patientId={patientId}
                section={section as ClinicalSection}
                onOpenConsultation={setConsultationId}
              />
            ) : section === "metabolico" && patientId ? (
              <MetabolicMapSection patientId={patientId} rows={rows} />
            ) : null}
          </main>
        </div>

        <PatientDialog open={editing} onOpenChange={setEditing} patient={p ?? null} />
        <ConsultationRegistrationDialog
          open={registering}
          patientName={p?.name}
          isPending={registerConsultation.isPending}
          onOpenChange={setRegistering}
          onConfirm={(date, observations) => registerConsultation.mutate({ date, observations })}
        />
      </DialogContent>
    </Dialog>
  );
}

function ExamsSection({
  patientId,
  rows,
  consultationId,
  onOpen,
}: {
  patientId: string;
  rows: db.Consultation[];
  consultationId: string | null;
  onOpen: (id: string | null) => void;
}) {
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState<db.Consultation | null>(null);
  const create = useMutation({
    mutationFn: () => db.createConsultation(patientId, new Date().toISOString().slice(0, 10), undefined, "module"),
    onSuccess: (consultation) => onOpen(consultation.id),
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: (consultationId: string) => labDb.deleteLabAssessment(consultationId),
    onSuccess: async (_, consultationId) => {
      setRemoving(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["lab-results", consultationId] }),
        queryClient.invalidateQueries({ queryKey: ["lab-assessment", consultationId] }),
      ]);
      toast.success("Exames excluídos somente desta aba.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (consultationId) {
    return (
      <div>
        <div className="border-b border-border px-6 py-3">
          <Button type="button" variant="ghost" size="sm" onClick={() => onOpen(null)}>
            <ArrowLeft /> Voltar para exames
          </Button>
        </div>
        <ConsultationWorkspace
          key={`exames-${consultationId}`}
          consultationId={consultationId}
          activeStep={5}
          embedded
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-7 lg:px-10 lg:py-9">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Registros</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Exames</h2>
          <p className="mt-1 text-sm text-muted-foreground">Acesse os exames laboratoriais de cada consulta e acompanhe a evolução no módulo de exames.</p>
        </div>
        <Button size="sm" disabled={create.isPending} onClick={() => create.mutate()}>
          <Plus /> {create.isPending ? "Abrindo…" : "Novo exame"}
        </Button>
      </div>

      {rows.length ? (
        <div className="mt-6 divide-y divide-border border-y border-border">
          {rows.map((consultation) => (
            <div key={consultation.id} className="grid gap-3 py-4 sm:grid-cols-[170px_1fr_auto] sm:items-center">
              <span className="text-sm font-medium">{formatDate(consultation.consultation_date ?? consultation.created_at)}</span>
              <span className="text-xs text-muted-foreground">Exames vinculados a esta consulta</span>
              <div className="flex items-center justify-end gap-1"><Button type="button" size="sm" variant="ghost" onClick={() => onOpen(consultation.id)}><FileText /> Abrir exames</Button><Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setRemoving(consultation)}><Trash2 /> Excluir</Button></div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex min-h-[340px] flex-col items-center justify-center text-center">
          <div className="rounded-full border border-border p-4"><FileText className="size-7 text-muted-foreground" /></div>
          <h3 className="mt-4 text-lg font-semibold">Nenhum registro de exames</h3>
          <p className="mt-1 text-sm text-muted-foreground">Crie o primeiro registro de exames para este paciente.</p>
          <Button className="mt-5" disabled={create.isPending} onClick={() => create.mutate()}><Plus /> Novo exame</Button>
        </div>
      )}
      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Excluir exames?</AlertDialogTitle><AlertDialogDescription>Somente os exames laboratoriais deste registro serão excluídos. Os demais dados da consulta permanecerão intactos.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={remove.isPending} onClick={(event) => { event.preventDefault(); if (removing) remove.mutate(removing.id); }}>{remove.isPending ? "Excluindo…" : "Excluir exames"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function Profile({
  patient,
  rows,
  onEdit,
  onOpenSection,
}: {
  patient: db.Patient | null;
  rows: db.Consultation[];
  onEdit: () => void;
  onOpenSection: (section: WorkspaceSection) => void;
}) {
  const last = rows[0];

  return (
    <div className="mx-auto max-w-5xl px-6 py-7 lg:px-10 lg:py-9">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground"><Settings className="size-3.5" /> Configurações</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Configurações do paciente</h2>
          <p className="mt-1 text-sm text-muted-foreground">Centralize cadastro, contato, contexto clínico e preferências usadas em toda a plataforma.</p>
        </div>
        <Button size="sm" disabled={!patient} onClick={onEdit}><Pencil /> Editar configurações</Button>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <section className="rounded-lg border border-border p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><Contact className="size-4 text-muted-foreground" /> Identificação e contato</h3>
          <dl className="mt-3 divide-y divide-border border-y border-border text-sm">
            <Row label="CPF" value={patient?.cpf} />
            <Row label="Nascimento" value={patient?.birth_date ? formatDate(patient.birth_date) : null} />
            <Row label="Sexo" value={patient?.sex ? (patient.sex === "feminino" ? "Feminino" : "Masculino") : null} />
            <Row label="Telefone" value={patient?.phone} />
            <Row label="E-mail" value={patient?.email} />
          </dl>
        </section>

        <section className="rounded-lg border border-border p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold"><CalendarDays className="size-4 text-muted-foreground" /> Uso na plataforma</h3>
          <dl className="mt-3 divide-y divide-border border-y border-border text-sm">
            <Row label="Consultas registradas" value={String(rows.length)} />
            <Row label="Última consulta" value={last ? formatDate(last.consultation_date ?? last.created_at) : null} />
            <Row label="Gestação" value={patient?.is_pregnant ? `${patient.pregnancy_weeks ?? "—"} semanas` : "Não informada"} />
            <Row label="Cadastro criado" value={patient?.created_at ? formatDate(patient.created_at) : null} />
          </dl>
          <Button type="button" variant="outline" size="sm" className="mt-4" onClick={() => onOpenSection("historico")}>Abrir histórico de consultas</Button>
        </section>
      </div>

      <section className="mt-5 rounded-lg border border-border p-5">
        <h3 className="text-sm font-semibold">Contexto clínico e organização</h3>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{patient?.notes || "Sem observações registradas."}</p>
        {patient?.tags?.length ? (
          <div className="mt-5 flex flex-wrap gap-1.5">{patient.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div>
        ) : null}
      </section>
    </div>
  );
}

function History({
  rows,
  patientId,
  onNew,
}: {
  rows: db.Consultation[];
  patientId: string;
  onNew: () => void;
}) {
  const queryClient = useQueryClient();
  const [removing, setRemoving] = useState<db.Consultation | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => db.hideConsultationFromHistory(id),
    onSuccess: async () => {
      setRemoving(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["patient-dossier", patientId] }),
        queryClient.invalidateQueries({ queryKey: ["consultations"] }),
        queryClient.invalidateQueries({ queryKey: ["consultation-dates"] }),
        queryClient.invalidateQueries({ queryKey: ["consultation-report"] }),
      ]);
      toast.success("Consulta removida do histórico e do relatório. O prontuário foi preservado.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="mx-auto max-w-5xl px-6 py-7 lg:px-10 lg:py-9">
      <div className="flex items-end justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Atendimentos</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Histórico de consultas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Cada registro nasce do botão Registrar consulta no início do atendimento.</p>
        </div>
        <Button size="sm" onClick={onNew}><Plus /> Registrar consulta</Button>
      </div>
      <div className="mt-6 divide-y divide-border border-y border-border">
        {rows.length ? rows.map((consultation) => (
          <div key={consultation.id} className="grid gap-3 px-1 py-4 sm:grid-cols-[170px_1fr_auto] sm:items-center">
            <span className="text-sm font-medium">{formatDate(consultation.consultation_date ?? consultation.created_at)}</span>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{consultation.observations || "Sem observações."}</p>
            <Button type="button" size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setRemoving(consultation)}><Trash2 /> Excluir</Button>
          </div>
        )) : <p className="py-10 text-sm text-muted-foreground">Nenhuma consulta registrada.</p>}
      </div>
      <AlertDialog open={!!removing} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Remover do histórico?</AlertDialogTitle><AlertDialogDescription>A consulta de {removing ? formatDate(removing.consultation_date ?? removing.created_at) : ""} deixará de aparecer neste histórico e no relatório de Meu Consultório. Anamnese, exames, avaliações, plano e demais dados clínicos permanecerão no prontuário e poderão ser excluídos somente em suas próprias abas.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction disabled={remove.isPending} onClick={(event) => { event.preventDefault(); if (removing) remove.mutate(removing.id); }}>{remove.isPending ? "Removendo…" : "Remover do histórico"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
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
