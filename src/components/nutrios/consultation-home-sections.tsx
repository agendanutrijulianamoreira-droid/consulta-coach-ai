import type { ReactNode, RefObject } from "react";
import {
  ArrowRight,
  Cake,
  CalendarDays,
  CalendarRange,
  Clock3,
  Search,
  Stethoscope,
  UserPlus,
  UsersRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { Patient } from "@/lib/nutrios/repository";

export type PatientRow = {
  patient: Patient;
  consultationId: string | null;
  lastAttendance: string | null;
};

export type PatientView = "recent" | "birthdays";

type MetricValue = number | null | undefined;

type MonthlyHistoryItem = {
  key: string;
  label: string;
  fullLabel: string;
  count: number;
};

export function HomeHeader({
  dateLabel,
  firstName,
  onAddPatient,
  onNewConsultation,
}: {
  dateLabel: string;
  firstName: string;
  onAddPatient: () => void;
  onNewConsultation: () => void;
}) {
  return (
    <header className="flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted-foreground" lang="pt-BR">
          {dateLabel}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
          {firstName ? `Olá, ${firstName}` : "Olá"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Veja o que precisa da sua atenção hoje.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 min-[430px]:grid-cols-2 sm:flex sm:shrink-0">
        <Button
          variant="outline"
          className="min-h-11 w-full justify-center sm:w-auto"
          onClick={onAddPatient}
        >
          <UserPlus /> Adicionar paciente
        </Button>
        <Button className="min-h-11 w-full justify-center sm:w-auto" onClick={onNewConsultation}>
          <Stethoscope /> Nova consulta
        </Button>
      </div>
    </header>
  );
}

export function SummaryCards({
  patients,
  currentMonth,
  lastSevenDays,
  birthdays,
}: {
  patients: MetricValue;
  currentMonth: MetricValue;
  lastSevenDays: MetricValue;
  birthdays: MetricValue;
}) {
  return (
    <section
      className="mt-5 grid auto-rows-fr grid-cols-2 gap-3 lg:grid-cols-4"
      aria-label="Resumo operacional"
    >
      <MetricCard
        icon={<UsersRound />}
        label="Pacientes"
        value={patients}
        detail="Total cadastrado"
      />
      <MetricCard
        icon={<CalendarRange />}
        label="Neste mês"
        value={currentMonth}
        detail="Consultas registradas"
      />
      <MetricCard
        icon={<Clock3 />}
        label="Últimos 7 dias"
        value={lastSevenDays}
        detail="Atendimentos recentes"
      />
      <MetricCard icon={<Cake />} label="Aniversariantes" value={birthdays} detail="Neste mês" />
    </section>
  );
}

function MetricCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: ReactNode;
  label: string;
  value: MetricValue;
  detail: string;
}) {
  return (
    <Card className="flex h-full min-h-28 flex-col justify-between rounded-xl p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        <span className="flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground [&_svg]:size-4">
          {icon}
        </span>
      </div>
      <div className="mt-3">
        {value === null ? (
          <Skeleton className="h-7 w-14" />
        ) : (
          <p className="text-2xl font-semibold tabular-nums tracking-tight">{value ?? "—"}</p>
        )}
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </div>
    </Card>
  );
}

export function PatientQuickAccess({
  search,
  onSearchChange,
  searchAreaRef,
  searchInputRef,
  consultationPrompt,
  patientView,
  onPatientViewChange,
  birthdayCount,
  patientRows,
  birthdayRows,
  isLoading,
  isError,
  onOpen,
  onNewConsultation,
  isStartingConsultation,
  onViewAll,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  searchAreaRef: RefObject<HTMLDivElement | null>;
  searchInputRef: RefObject<HTMLInputElement | null>;
  consultationPrompt: boolean;
  patientView: PatientView;
  onPatientViewChange: (value: PatientView) => void;
  birthdayCount: number;
  patientRows: PatientRow[];
  birthdayRows: PatientRow[];
  isLoading: boolean;
  isError: boolean;
  onOpen: (row: PatientRow) => void;
  onNewConsultation: (patient: Patient) => void;
  isStartingConsultation: boolean;
  onViewAll: () => void;
}) {
  return (
    <Card className="mt-5 overflow-hidden rounded-xl shadow-sm">
      <div className="border-b border-border px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Acesso rápido aos pacientes</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Localize um cadastro para abrir o prontuário ou iniciar um atendimento.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="min-h-11 self-start sm:self-auto"
            onClick={onViewAll}
          >
            Ver todos <ArrowRight />
          </Button>
        </div>

        <div ref={searchAreaRef} className="relative mt-4 scroll-mt-4">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={searchInputRef}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Busque por nome, CPF, telefone, e-mail ou tag"
            className="h-11 bg-background pl-9"
            aria-describedby={consultationPrompt ? "consultation-guidance" : undefined}
          />
        </div>
        {consultationPrompt ? (
          <p
            id="consultation-guidance"
            className="mt-2 text-xs font-medium text-foreground"
            role="status"
          >
            Busque a paciente para iniciar uma nova consulta.
          </p>
        ) : null}
      </div>

      <Tabs
        value={patientView}
        onValueChange={(value) => onPatientViewChange(toPatientView(value))}
      >
        <div className="flex items-center justify-between gap-3 px-4 pt-4 sm:px-5">
          <TabsList
            className="grid h-auto w-full grid-cols-2 sm:w-auto"
            aria-label="Visualização de pacientes"
          >
            <TabsTrigger className="min-h-11 px-2 text-xs sm:px-3 sm:text-sm" value="recent">
              Recentes
            </TabsTrigger>
            <TabsTrigger className="min-h-11 px-2 text-xs sm:px-3 sm:text-sm" value="birthdays">
              Aniversariantes ({birthdayCount})
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="recent" className="mt-3">
          <PatientList
            rows={patientRows}
            isLoading={isLoading}
            isError={isError}
            emptyMessage={
              search
                ? "Nenhum paciente corresponde à sua busca."
                : "Nenhum paciente cadastrado ainda."
            }
            onOpen={onOpen}
            onNewConsultation={onNewConsultation}
            isStartingConsultation={isStartingConsultation}
          />
        </TabsContent>

        <TabsContent value="birthdays" className="mt-3">
          <PatientList
            rows={birthdayRows}
            isLoading={isLoading}
            isError={isError}
            emptyMessage={
              search
                ? "Nenhum aniversariante corresponde à sua busca."
                : "Nenhum paciente faz aniversário neste mês."
            }
            birthdayMode
            onOpen={onOpen}
            onNewConsultation={onNewConsultation}
            isStartingConsultation={isStartingConsultation}
          />
        </TabsContent>
      </Tabs>
    </Card>
  );
}

function PatientList({
  rows,
  isLoading,
  isError,
  emptyMessage,
  birthdayMode = false,
  onOpen,
  onNewConsultation,
  isStartingConsultation,
}: {
  rows: PatientRow[];
  isLoading: boolean;
  isError: boolean;
  emptyMessage: string;
  birthdayMode?: boolean;
  onOpen: (row: PatientRow) => void;
  onNewConsultation: (patient: Patient) => void;
  isStartingConsultation: boolean;
}) {
  if (isLoading) {
    return (
      <div
        className="divide-y divide-border px-4 sm:px-5"
        aria-label="Carregando pacientes"
        aria-busy="true"
      >
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 py-3.5">
            <Skeleton className="size-10 shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-2">
              <Skeleton className="h-4 w-40 max-w-full" />
              <Skeleton className="h-3 w-56 max-w-full" />
            </div>
            <Skeleton className="hidden h-8 w-28 sm:block" />
          </div>
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="border-t border-border px-4 py-10 text-center sm:px-5" role="alert">
        <p className="text-sm font-medium text-destructive">
          Não foi possível carregar os pacientes.
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Atualize a página para tentar novamente.
        </p>
      </div>
    );
  }

  if (!rows.length) {
    return (
      <div className="border-t border-border px-4 py-10 text-center sm:px-5">
        <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {birthdayMode ? <Cake className="size-4" /> : <UsersRound className="size-4" />}
        </span>
        <p className="mt-3 text-sm font-medium">{emptyMessage}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {birthdayMode
            ? "Os aniversários aparecem aqui automaticamente a partir do cadastro."
            : "Use “Adicionar paciente” para começar."}
        </p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border border-t border-border px-4 sm:px-5">
      {rows.map((row) => (
        <div
          key={row.patient.id}
          className="group flex flex-col gap-3 py-3.5 transition-colors hover:bg-muted/35 sm:flex-row sm:items-center sm:px-2"
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-secondary-foreground">
              {getInitials(row.patient.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" title={row.patient.name}>
                {row.patient.name}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {birthdayMode
                  ? formatBirthday(row.patient.birth_date)
                  : row.lastAttendance
                    ? `Último atendimento: ${formatDate(row.lastAttendance)}`
                    : "Sem atendimento registrado"}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-2 sm:flex sm:shrink-0">
            <Button variant="ghost" size="sm" className="min-h-11" onClick={() => onOpen(row)}>
              Abrir paciente
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="min-h-11 sm:w-32"
              disabled={isStartingConsultation}
              onClick={() => onNewConsultation(row.patient)}
            >
              Nova consulta
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ConsultationHistory({
  isLoading,
  isError,
  total,
  history,
}: {
  isLoading: boolean;
  isError: boolean;
  total: number;
  history: MonthlyHistoryItem[];
}) {
  const maxMonth = Math.max(1, ...history.map((item) => item.count));

  return (
    <Card className="mt-5 rounded-xl p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Histórico de consultas</h2>
          <p className="mt-1 text-sm text-muted-foreground">Volume mensal dos últimos 13 meses</p>
        </div>
        {!isLoading && !isError ? (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" /> {total} no período
          </span>
        ) : null}
      </div>

      {isLoading ? (
        <Skeleton className="mt-5 h-44 w-full" />
      ) : isError ? (
        <div
          className="mt-5 rounded-lg border border-dashed border-border px-4 py-10 text-center text-sm text-destructive"
          role="alert"
        >
          Não foi possível carregar o histórico de consultas.
        </div>
      ) : (
        <TooltipProvider delayDuration={150}>
          <div className="mt-4 overflow-x-auto pb-2">
            <div className="flex h-44 min-w-[720px] items-end gap-2 border-b border-border px-1 pt-3">
              {history.map((item) => (
                <Tooltip key={item.key}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="group flex h-full min-w-12 flex-1 flex-col items-center justify-end gap-1.5 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      aria-label={`${item.fullLabel}: ${item.count} ${item.count === 1 ? "consulta" : "consultas"}`}
                    >
                      <span className="text-xs font-medium tabular-nums text-muted-foreground group-hover:text-foreground">
                        {item.count}
                      </span>
                      <span className="flex h-28 w-full max-w-10 items-end rounded-t-sm bg-muted">
                        <span
                          className={`block w-full rounded-t-sm transition-colors ${
                            item.count
                              ? "bg-primary/80 group-hover:bg-primary"
                              : "bg-muted-foreground/20"
                          }`}
                          style={{ height: `${Math.max(6, (item.count / maxMonth) * 112)}px` }}
                        />
                      </span>
                      <span className="text-xs text-muted-foreground">{item.label}</span>
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {item.fullLabel}: {item.count} {item.count === 1 ? "consulta" : "consultas"}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>
        </TooltipProvider>
      )}
    </Card>
  );
}

function toPatientView(value: string): PatientView {
  return value === "birthdays" ? "birthdays" : "recent";
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
  return `${first}${last}`.toLocaleUpperCase("pt-BR") || "—";
}

function getBirthDateParts(value: string | null) {
  if (!value) return null;
  const [, month, day] = value.slice(0, 10).split("-").map(Number);
  if (!month || !day) return null;
  return { month, day };
}

function formatBirthday(value: string | null) {
  const parts = getBirthDateParts(value);
  if (!parts) return "Data de nascimento não informada";
  const date = new Date(2000, parts.month - 1, parts.day);
  return `Aniversário em ${new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
  }).format(date)}`;
}

function formatDate(value: string) {
  const date = value.length === 10 ? new Date(`${value}T12:00:00`) : new Date(value);
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}
