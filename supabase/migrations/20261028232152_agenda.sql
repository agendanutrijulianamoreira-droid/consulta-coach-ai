-- Agenda (prioridade P0): calendário de consultas com status de confirmação
-- e falta, e lista de espera. Hoje o sistema só registra a consulta clínica
-- em si (public.consultations); não existia nenhum conceito de horário
-- agendado antes da consulta acontecer. Esta migration cria exatamente isso,
-- sem mexer em consultations.
--
-- Lembrete por WhatsApp e vínculo com Google Calendar (também pedidos no
-- documento de especificação) ficam de fora por enquanto: dependem de
-- credenciais e de uma integração externa que só a Juliana pode autorizar
-- e configurar. O campo reminder_sent_at já guarda o espaço para isso.

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  scheduled_at timestamptz not null,
  duration_minutes integer not null default 50 check (duration_minutes > 0),
  status text not null default 'agendado' check (status in (
    'agendado',
    'encaixe',
    'confirmado_profissional',
    'confirmado_paciente',
    'desmarcado_profissional',
    'desmarcado_paciente',
    'nao_compareceu',
    'realizado'
  )),
  notes text,
  consultation_id uuid references public.consultations(id) on delete set null,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists appointments_professional_scheduled_idx on public.appointments(professional_id, scheduled_at);
create index if not exists appointments_patient_idx on public.appointments(patient_id);

create table if not exists public.appointment_waitlist (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  desired_period text,
  notes text,
  status text not null default 'aguardando' check (status in ('aguardando', 'contatada', 'agendada', 'cancelada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists appointment_waitlist_professional_idx on public.appointment_waitlist(professional_id, status);

alter table public.appointments enable row level security;
alter table public.appointment_waitlist enable row level security;

grant select, insert, update, delete on public.appointments to authenticated;
grant select, insert, update, delete on public.appointment_waitlist to authenticated;
grant all on public.appointments to service_role;
grant all on public.appointment_waitlist to service_role;

create policy "appointments_owner_access" on public.appointments
  for all to authenticated
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

create policy "appointment_waitlist_owner_access" on public.appointment_waitlist
  for all to authenticated
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

drop trigger if exists set_updated_at_appointments on public.appointments;
create trigger set_updated_at_appointments before update on public.appointments
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_appointment_waitlist on public.appointment_waitlist;
create trigger set_updated_at_appointment_waitlist before update on public.appointment_waitlist
  for each row execute function public.set_updated_at();
