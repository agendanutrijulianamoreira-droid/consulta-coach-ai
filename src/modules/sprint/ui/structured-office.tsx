import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  DollarSign,
  ListChecks,
  Plus,
  RefreshCw,
  Sparkles,
  Target,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  CRM_STAGES,
  LEAD_SOURCES,
  OFFER_KIND_LABEL,
  SEED_OFFERS,
  SPRINT_7_DAYS,
  SPRINT_STEPS,
  UNKNOWN,
  JOURNEY_TEMPLATES,
  stepStatus,
  sprintProgress,
  type Answers,
  type ChecklistState,
  type OfferKind,
} from "@/modules/sprint/domain/sprint";
import { computeKpis, monthRangeSP, brl, pct } from "@/modules/sprint/domain/kpis";
import * as db from "@/modules/sprint/infrastructure/repository";

type WorkspaceTab = "sprint" | "ofertas" | "crm" | "kpis" | "ia";

export function StructuredOffice() {
  const [tab, setTab] = useState<WorkspaceTab>("sprint");
  const tabs: Array<{ id: WorkspaceTab; label: string; icon: typeof Target }> = [
    { id: "sprint", label: "Sprint 90", icon: Target },
    { id: "ofertas", label: "Ofertas", icon: DollarSign },
    { id: "crm", label: "CRM", icon: Users },
    { id: "kpis", label: "KPIs", icon: BarChart3 },
    { id: "ia", label: "Central IA", icon: Sparkles },
  ];
  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-xl border border-border bg-background shadow-sm">
        <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <Target className="size-3.5" /> Consultório estruturado
            </div>
            <h2 className="mt-1.5 text-xl font-semibold tracking-tight">Sprint de 90 minutos</h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">
              Organize diagnóstico, ofertas, jornada, CRM, financeiro e rotina em um único lugar. A
              IA propõe; você revisa e aprova.
            </p>
          </div>
          <Badge variant="secondary" className="w-fit gap-1.5 px-3 py-1.5">
            <Clock3 className="size-3.5" /> 6 etapas · 15 min cada
          </Badge>
        </div>
        <nav className="flex gap-1 overflow-x-auto p-2" aria-label="Consultório estruturado">
          {tabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`flex min-h-10 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${tab === id ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
            >
              <Icon className="size-4" /> {label}
            </button>
          ))}
        </nav>
      </section>
      {tab === "sprint" ? <SprintWizard /> : null}
      {tab === "ofertas" ? <OffersPanel /> : null}
      {tab === "crm" ? <CrmPanel /> : null}
      {tab === "kpis" ? <KpisPanel /> : null}
      {tab === "ia" ? <AiPanel /> : null}
    </div>
  );
}

function SprintWizard() {
  const queryClient = useQueryClient();
  const progress = useQuery({ queryKey: ["sprint-progress"], queryFn: db.getSprintProgress });
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const [checks, setChecks] = useState<ChecklistState>({});
  const [completed, setCompleted] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);

  if (progress.data && !hydrated) {
    setAnswers((progress.data.answers ?? {}) as Answers);
    setChecks((progress.data.checks ?? {}) as ChecklistState);
    setCompleted(progress.data.completed_steps ?? []);
    const savedIndex = SPRINT_STEPS.findIndex((step) => step.id === progress.data?.current_step);
    if (savedIndex >= 0) setStepIndex(savedIndex);
    setHydrated(true);
  }

  const step = SPRINT_STEPS[stepIndex]!;
  const status = stepStatus(step, answers, checks);
  const progressPercent = sprintProgress(completed);
  const save = useMutation({
    mutationFn: () =>
      db.saveSprintProgress({
        answers,
        checks,
        completed_steps: completed,
        current_step: step.id,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sprint-progress"] });
      toast.success("Progresso salvo.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const completeStep = () => {
    if (!status.canComplete) {
      toast.error("Preencha os campos essenciais e marque o checklist desta etapa.");
      return;
    }
    const nextCompleted = Array.from(new Set([...completed, step.id]));
    const nextIndex = Math.min(stepIndex + 1, SPRINT_STEPS.length - 1);
    setCompleted(nextCompleted);
    setStepIndex(nextIndex);
    void db
      .saveSprintProgress({
        answers,
        checks,
        completed_steps: nextCompleted,
        current_step: SPRINT_STEPS[nextIndex]!.id,
      })
      .then(() => queryClient.invalidateQueries({ queryKey: ["sprint-progress"] }))
      .catch((error: Error) => toast.error(error.message));
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[250px_minmax(0,1fr)]">
      <Card className="h-fit xl:sticky xl:top-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Roteiro da sprint</CardTitle>
          <CardDescription>{progressPercent}% concluído</CardDescription>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-1">
          {SPRINT_STEPS.map((item, index) => {
            const done = completed.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setStepIndex(index)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm ${index === stepIndex ? "bg-accent font-semibold" : "hover:bg-muted"}`}
              >
                <span
                  className={`grid size-6 shrink-0 place-items-center rounded-full text-xs ${done ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                >
                  {done ? <Check className="size-3.5" /> : index + 1}
                </span>
                <span className="min-w-0 flex-1 truncate">{item.title}</span>
                <span className="text-[10px] text-muted-foreground">15m</span>
              </button>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="border-b border-border">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                Etapa {stepIndex + 1} de {SPRINT_STEPS.length}
              </p>
              <CardTitle className="mt-1">{step.title}</CardTitle>
              <CardDescription className="mt-2 max-w-2xl leading-5">{step.goal}</CardDescription>
            </div>
            <Badge variant={status.canComplete ? "default" : "outline"}>
              {status.canComplete ? "Pronta para concluir" : "Em preenchimento"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pt-6">
          <div className="grid gap-4 md:grid-cols-2">
            {step.fields.map((field) => (
              <label key={field.key} className={field.type === "textarea" ? "md:col-span-2" : ""}>
                <span className="text-sm font-medium">
                  {field.label}
                  {field.essential ? " *" : ""}
                </span>
                {field.hint ? (
                  <span className="mt-1 block text-xs text-muted-foreground">{field.hint}</span>
                ) : null}
                {field.type === "textarea" ? (
                  <Textarea
                    className="mt-2"
                    rows={4}
                    value={answers[field.key] ?? ""}
                    onChange={(event) =>
                      setAnswers({ ...answers, [field.key]: event.target.value })
                    }
                  />
                ) : (
                  <Input
                    className="mt-2"
                    type={
                      field.type === "number"
                        ? "number"
                        : field.type === "money"
                          ? "number"
                          : "text"
                    }
                    step={field.type === "money" ? "0.01" : undefined}
                    value={answers[field.key] === UNKNOWN ? "" : (answers[field.key] ?? "")}
                    onChange={(event) =>
                      setAnswers({ ...answers, [field.key]: event.target.value })
                    }
                  />
                )}
                {field.essential && !answers[field.key] ? (
                  <button
                    type="button"
                    className="mt-1 text-xs text-muted-foreground underline"
                    onClick={() => setAnswers({ ...answers, [field.key]: UNKNOWN })}
                  >
                    Não sei ainda
                  </button>
                ) : null}
              </label>
            ))}
          </div>
          <div className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-sm font-semibold">Checklist de conclusão</p>
            <div className="mt-3 space-y-2">
              {step.checklist.map((item) => {
                const key = `${step.id}.${item.key}`;
                return (
                  <label key={key} className="flex cursor-pointer items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      checked={Boolean(checks[key])}
                      onChange={(event) => setChecks({ ...checks, [key]: event.target.checked })}
                      className="mt-0.5 size-4 accent-primary"
                    />
                    <span>{item.label}</span>
                  </label>
                );
              })}
            </div>
          </div>
          {status.unknown.length ? (
            <p className="flex items-start gap-2 text-xs text-amber-700">
              <CircleAlert className="mt-0.5 size-4 shrink-0" /> Itens “Não sei” ficam registrados
              como pendência para revisão.
            </p>
          ) : null}
          <div className="flex flex-wrap justify-between gap-2 border-t border-border pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => void save.mutateAsync()}
              disabled={save.isPending}
            >
              <RefreshCw className="size-4" /> Salvar progresso
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={stepIndex === 0}
                onClick={() => setStepIndex((value) => value - 1)}
              >
                Anterior
              </Button>
              <Button type="button" onClick={completeStep}>
                {stepIndex === SPRINT_STEPS.length - 1 ? "Concluir sprint" : "Concluir e avançar"}{" "}
                <ArrowRight />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function OffersPanel() {
  const queryClient = useQueryClient();
  const offers = useQuery({ queryKey: ["sprint-offers"], queryFn: db.listOffers });
  const [draft, setDraft] = useState({
    name: "",
    kind: "servico_clinico" as OfferKind,
    price: "",
    variable_cost: "",
    minutes_spent: "",
  });
  const save = useMutation({
    mutationFn: () =>
      db.createOffer({
        name: draft.name.trim(),
        kind: draft.kind,
        price: Number(draft.price),
        variable_cost: Number(draft.variable_cost || 0),
        minutes_spent: Number(draft.minutes_spent || 0),
      }),
    onSuccess: () => {
      setDraft({
        name: "",
        kind: "servico_clinico",
        price: "",
        variable_cost: "",
        minutes_spent: "",
      });
      void queryClient.invalidateQueries({ queryKey: ["sprint-offers"] });
      toast.success("Oferta adicionada.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const remove = useMutation({
    mutationFn: db.deleteOffer,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["sprint-offers"] }),
    onError: (error: Error) => toast.error(error.message),
  });
  const seed = useMutation({
    mutationFn: async () =>
      Promise.all(SEED_OFFERS.map((offer, position) => db.createOffer({ ...offer, position }))),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["sprint-offers"] });
      toast.success("Catálogo inicial criado.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Catálogo de ofertas</CardTitle>
              <CardDescription>
                Preço, custo variável e tempo clínico deixam a margem visível.
              </CardDescription>
            </div>
            {!offers.data?.length ? (
              <Button variant="outline" onClick={() => seed.mutate()} disabled={seed.isPending}>
                Criar catálogo inicial
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_150px_150px_auto]">
            <Input
              placeholder="Nome da oferta"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={draft.kind}
              onChange={(event) => setDraft({ ...draft, kind: event.target.value as OfferKind })}
            >
              {Object.entries(OFFER_KIND_LABEL).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
            <Input
              type="number"
              placeholder="Preço"
              value={draft.price}
              onChange={(event) => setDraft({ ...draft, price: event.target.value })}
            />
            <Input
              type="number"
              placeholder="Minutos"
              value={draft.minutes_spent}
              onChange={(event) => setDraft({ ...draft, minutes_spent: event.target.value })}
            />
            <Button
              onClick={() => save.mutate()}
              disabled={save.isPending || !draft.name.trim() || !draft.price}
            >
              <Plus /> Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="divide-y divide-border">
            {(offers.data ?? []).map((offer) => {
              const margin = offer.price - offer.variable_cost;
              return (
                <div
                  key={offer.id}
                  className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-medium">{offer.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {OFFER_KIND_LABEL[offer.kind as OfferKind] ?? offer.kind} ·{" "}
                      {offer.minutes_spent} min · custo {brl(offer.variable_cost)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-semibold">{brl(offer.price)}</span>
                    <Badge variant={margin > 0 ? "secondary" : "destructive"}>
                      margem {brl(margin)}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Excluir ${offer.name}`}
                      onClick={() => remove.mutate(offer.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              );
            })}
            {!offers.data?.length ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Nenhuma oferta cadastrada.
              </p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CrmPanel() {
  const queryClient = useQueryClient();
  const leads = useQuery({ queryKey: ["sprint-leads"], queryFn: db.listLeads });
  const [draft, setDraft] = useState({ name: "", phone: "", source: "instagram", next_action: "" });
  const create = useMutation({
    mutationFn: () => db.createLead(draft),
    onSuccess: () => {
      setDraft({ name: "", phone: "", source: "instagram", next_action: "" });
      void queryClient.invalidateQueries({ queryKey: ["sprint-leads"] });
      toast.success("Lead adicionado ao CRM.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const update = useMutation({
    mutationFn: ({ id, stage }: { id: string; stage: string }) => db.updateLead(id, { stage }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["sprint-leads"] }),
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>CRM e follow-ups</CardTitle>
          <CardDescription>Cada lead precisa ter estágio e próxima ação claros.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_180px_180px_minmax(0,1fr)_auto]">
            <Input
              placeholder="Nome do lead"
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
            <Input
              placeholder="Telefone"
              value={draft.phone}
              onChange={(event) => setDraft({ ...draft, phone: event.target.value })}
            />
            <select
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              value={draft.source}
              onChange={(event) => setDraft({ ...draft, source: event.target.value })}
            >
              {LEAD_SOURCES.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.label}
                </option>
              ))}
            </select>
            <Input
              placeholder="Próxima ação"
              value={draft.next_action}
              onChange={(event) => setDraft({ ...draft, next_action: event.target.value })}
            />
            <Button
              onClick={() => create.mutate()}
              disabled={!draft.name.trim() || create.isPending}
            >
              <Plus /> Adicionar
            </Button>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {(leads.data ?? []).map((lead) => (
              <div
                key={lead.id}
                className="grid gap-3 rounded-lg border border-border p-4 md:grid-cols-[minmax(0,1fr)_220px_220px]"
              >
                <div>
                  <p className="font-medium">{lead.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {lead.phone || "Sem telefone"} ·{" "}
                    {LEAD_SOURCES.find((source) => source.id === lead.source)?.label ?? lead.source}
                  </p>
                  {lead.next_action ? (
                    <p className="mt-2 text-xs">
                      <span className="font-semibold">Próxima ação:</span> {lead.next_action}
                    </p>
                  ) : null}
                </div>
                <select
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={lead.stage}
                  onChange={(event) => update.mutate({ id: lead.id, stage: event.target.value })}
                >
                  {CRM_STAGES.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.label}
                    </option>
                  ))}
                </select>
                <div className="flex items-center justify-end">
                  <Badge variant={lead.stage === "ganho" ? "default" : "outline"}>
                    {CRM_STAGES.find((stage) => stage.id === lead.stage)?.label ?? lead.stage}
                  </Badge>
                </div>
              </div>
            ))}
            {!leads.data?.length ? (
              <p className="py-10 text-center text-sm text-muted-foreground">Nenhum lead no CRM.</p>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KpisPanel() {
  const range = monthRangeSP();
  const leads = useQuery({ queryKey: ["sprint-leads"], queryFn: db.listLeads });
  const events = useQuery({ queryKey: ["sprint-lead-events"], queryFn: db.listLeadEvents });
  const entries = useQuery({ queryKey: ["sprint-entries"], queryFn: db.listEntries });
  const offers = useQuery({ queryKey: ["sprint-offers"], queryFn: db.listOffers });
  const kpis = useMemo(
    () =>
      computeKpis({
        leads: leads.data ?? [],
        events: events.data ?? [],
        entries: entries.data ?? [],
        offers: offers.data ?? [],
        ...range,
        includeDemo: false,
        availableMinutes: null,
      }),
    [entries.data, events.data, leads.data, offers.data, range],
  );
  const cards = [
    ["Contratado", brl(kpis.contracted), DollarSign],
    ["Recebido", brl(kpis.received), DollarSign],
    ["Ticket médio", brl(kpis.averageTicket), Target],
    ["Agendamento", pct(kpis.schedulingRate), CalendarIcon],
    ["Comparecimento", pct(kpis.attendanceRate), CheckCircle2],
    ["Inadimplência", pct(kpis.delinquencyRate), CircleAlert],
  ] as const;
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value, Icon]) => (
          <Card key={label}>
            <CardContent className="flex items-center justify-between pt-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {label}
                </p>
                <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
              </div>
              <span className="grid size-10 place-items-center rounded-xl bg-accent text-accent-foreground">
                <Icon className="size-5" />
              </span>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Painel executivo</CardTitle>
          <CardDescription>
            Período atual: {range.from} a {range.to}. “N/D” significa que ainda não há denominador
            confiável.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <KpiLine label="Receita reconhecida" value={brl(kpis.recognized)} />
          <KpiLine label="Conversão em protocolo" value={pct(kpis.protocolConversion)} />
          <KpiLine label="Renovações" value={String(kpis.renewals)} />
        </CardContent>
      </Card>
    </div>
  );
}

function KpiLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function AiPanel() {
  const queryClient = useQueryClient();
  const proposals = useQuery({ queryKey: ["sprint-proposals"], queryFn: db.listProposals });
  const templates = useQuery({ queryKey: ["sprint-templates"], queryFn: db.listMessageTemplates });
  const update = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) => db.updateProposal(id, status),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["sprint-proposals"] }),
    onError: (error: Error) => toast.error(error.message),
  });
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Central de aprovações</CardTitle>
          <CardDescription>Propostas ficam pendentes até sua decisão explícita.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(proposals.data ?? []).map((proposal) => (
            <div key={proposal.id} className="rounded-lg border border-border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">{proposal.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {proposal.agent} · {proposal.status}
                  </p>
                </div>
                <Sparkles className="size-4 text-primary" />
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {proposal.body}
              </p>
              {["pendente", "proposta"].includes(proposal.status) ? (
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => update.mutate({ id: proposal.id, status: "aprovado" })}
                  >
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => update.mutate({ id: proposal.id, status: "rejeitado" })}
                  >
                    Rejeitar
                  </Button>
                </div>
              ) : null}
            </div>
          ))}
          {!proposals.data?.length ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              <ListChecks className="mx-auto size-6" />
              <p className="mt-2">Nenhuma proposta pendente.</p>
            </div>
          ) : null}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Mensagens da jornada</CardTitle>
          <CardDescription>Rascunhos para revisar antes de enviar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {(templates.data?.length ? templates.data : JOURNEY_TEMPLATES).map((template) => (
            <div
              key={"id" in template ? template.id : template.step}
              className="rounded-lg border border-border p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium">{template.title}</p>
                <Badge variant="outline">
                  {"status" in template ? template.status : "rascunho"}
                </Badge>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted-foreground">{template.body}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function CalendarIcon(props: { className?: string }) {
  return <Clock3 {...props} />;
}
