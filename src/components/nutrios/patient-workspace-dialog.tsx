import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Pencil, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PatientDialog } from "@/components/nutrios/patient-dialog";
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

const CONSULTATION_STEP: Partial<Record<WorkspaceSection, number>> = {
  consulta: 0,
  anamnese: 1,
  antropometria: 2,
  calculos: 3,
  recordatorio: 4,
  diagnostico: 6,
  plano: 7,
};

export function PatientWorkspaceDialog({
  open,
  patientId,
  initialConsultationId = null,
  initialSection = "perfil",
  onOpenChange,
}: Props) {
  const queryClient = useQueryClient();
  const [section, setSection] = useState<WorkspaceSection>(initialSection);
  const [consultationId, setConsultationId] = useState<string | null>(initialConsultationId ?? null);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

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
  const selectedConsultation = useMemo(
    () => rows.find((item) => item.id === consultationId) ?? rows[0] ?? null,
    [rows, consultationId],
  );

  useEffect(() => {
    if (!open) return;
    setSection(initialSection);
    setConsultationId(initialConsultationId ?? null);
  }, [open, patientId, initialConsultationId, initialSection]);

  useEffect(() => {
    const first = rows[0];
    if (!open || consultationId || !first) return;
    setConsultationId(first.id);
  }, [open, rows, consultationId]);

  const start = useMutation({
    mutationFn: () => db.createConsultation(patientId!, date),
    onSuccess: (consultation) => {
      setConsultationId(consultation.id);
      setSection("consulta");
      void queryClient.invalidateQueries({ queryKey: ["patient-dossier", patientId] });
      void queryClient.invalidateQueries({ queryKey: ["consultations"] });
      void queryClient.invalidateQueries({ queryKey: ["consultation-dates"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const selectSection = (next: WorkspaceSection) => {
    setSection(next);
    const first = rows[0];
    if (next in CONSULTATION_STEP && !consultationId && first) setConsultationId(first.id);
  };

  const syncEmbeddedStep = useCallback(() => {
    const frame = iframeRef.current;
    const step = CONSULTATION_STEP[section];
    if (!frame || step === undefined) return;
    try {
      const doc = frame.contentDocument;
      if (!doc) return;
      injectEmbeddedStyles(doc);
      const tabs = Array.from(doc.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
      tabs[step]?.click();
    } catch {
      // Same-origin is expected in production. If unavailable, the consultation still remains usable.
    }
  }, [section]);

  useEffect(() => {
    if (CONSULTATION_STEP[section] === undefined) return;
    const timer = window.setTimeout(syncEmbeddedStep, 40);
    return () => window.clearTimeout(timer);
  }, [section, syncEmbeddedStep]);

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
          <aside className="border-r border-border bg-muted/20 px-3 py-4">
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
              <Profile patient={p ?? null} rows={rows} onEdit={() => setEditing(true)} />
            ) : section === "historico" ? (
              <History
                rows={rows}
                dossier={dossier.data}
                onOpen={(id) => {
                  setConsultationId(id);
                  setSection("consulta");
                }}
              />
            ) : section === "parecer" ? (
              <Report
                consultationId={selectedConsultation?.id ?? null}
                report={selectedConsultation ? dossier.data?.reports[selectedConsultation.id] : undefined}
              />
            ) : selectedConsultation ? (
              <div className="h-full min-h-[680px]">
                <iframe
                  key={selectedConsultation.id}
                  ref={iframeRef}
                  title={`Consulta de ${p?.name ?? "paciente"}`}
                  src={`/consulta/${selectedConsultation.id}`}
                  onLoad={syncEmbeddedStep}
                  className="h-full min-h-[680px] w-full border-0 bg-background"
                />
              </div>
            ) : (
              <EmptyConsultation
                date={date}
                onDateChange={setDate}
                onStart={() => start.mutate()}
                pending={start.isPending}
              />
            )}
          </main>
        </div>

        <PatientDialog open={editing} onOpenChange={setEditing} patient={p ?? null} />
      </DialogContent>
    </Dialog>
  );
}

function Profile({ patient, rows, onEdit }: { patient: db.Patient | null; rows: db.Consultation[]; onEdit: () => void }) {
  const last = rows[0];
  return (
    <div className="mx-auto max-w-5xl px-6 py-7 lg:px-10 lg:py-9">
      <div className="flex items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Perfil</p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">Dados do paciente</h2>
        </div>
        <Button variant="secondary" size="sm" disabled={!patient} onClick={onEdit}><Pencil /> Editar cadastro</Button>
      </div>

      <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_0.8fr]">
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
          <h3 className="text-sm font-semibold">Observações</h3>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">{patient?.notes || "Sem observações registradas."}</p>
          {patient?.tags?.length ? (
            <div className="mt-5 flex flex-wrap gap-1.5">{patient.tags.map((tag) => <Badge key={tag} variant="outline">{tag}</Badge>)}</div>
          ) : null}
        </section>
      </div>
    </div>
  );
}

function History({
  rows,
  dossier,
  onOpen,
}: {
  rows: db.Consultation[];
  dossier: Awaited<ReturnType<typeof db.getPatientDossier>> | undefined;
  onOpen: (id: string) => void;
}) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-7 lg:px-10 lg:py-9">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Histórico</p>
      <h2 className="mt-1 text-xl font-semibold tracking-tight">Consultas anteriores</h2>
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
        }) : <p className="py-10 text-sm text-muted-foreground">Nenhuma consulta registrada.</p>}
      </div>
    </div>
  );
}

function Report({ consultationId, report }: { consultationId: string | null; report?: string | null | undefined }) {
  return (
    <div className="mx-auto max-w-5xl px-6 py-7 lg:px-10 lg:py-9">
      <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">Parecer</p>
      <div className="mt-1 flex items-center justify-between gap-4">
        <h2 className="text-xl font-semibold tracking-tight">Parecer da consulta</h2>
        {consultationId ? <Button asChild variant="secondary" size="sm"><a href={`/prontuario/${consultationId}`}><FileText /> Abrir versão completa</a></Button> : null}
      </div>
      {report ? <div className="mt-6 whitespace-pre-wrap text-sm leading-7">{report}</div> : <p className="mt-6 text-sm text-muted-foreground">Esta consulta ainda não possui parecer gerado.</p>}
    </div>
  );
}

function EmptyConsultation({ date, onDateChange, onStart, pending }: { date: string; onDateChange: (value: string) => void; onStart: () => void; pending: boolean }) {
  return (
    <div className="flex min-h-full items-center justify-center px-6 py-12">
      <div className="w-full max-w-sm text-center">
        <h2 className="text-lg font-semibold">Nenhuma consulta registrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">Registre a primeira consulta para começar o prontuário clínico.</p>
        <div className="mx-auto mt-6 grid max-w-56 gap-1.5 text-left">
          <Label htmlFor="workspace-consult-date" className="text-xs text-muted-foreground">Data da consulta</Label>
          <Input id="workspace-consult-date" type="date" value={date} onChange={(event) => onDateChange(event.target.value)} />
        </div>
        <Button className="mt-3" onClick={onStart} disabled={pending}><Plus />{pending ? "Abrindo…" : "Iniciar consulta"}</Button>
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

function injectEmbeddedStyles(doc: Document) {
  if (doc.getElementById("cach-workspace-embed-style")) return;
  const style = doc.createElement("style");
  style.id = "cach-workspace-embed-style";
  style.textContent = `
    .flex.min-h-screen.bg-background.text-foreground > aside { display: none !important; }
    main.flex.min-w-0.flex-1.flex-col > .md\\:hidden { display: none !important; }
    .min-w-0.flex-1 > .border-b.border-border.px-3.py-3 { display: none !important; }
    .flex.min-h-screen.bg-background.text-foreground { min-height: 100% !important; }
    body { overflow: auto !important; }
  `;
  doc.head.appendChild(style);
}
