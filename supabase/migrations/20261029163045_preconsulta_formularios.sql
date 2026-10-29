-- Pré-consulta (P1 do WebDiet): formulário público, sem login, acessado
-- por um token único, que a paciente preenche antes da consulta — cobre
-- uma parte da Anamnese para acelerar o atendimento. Isso nunca decide
-- nada por ela: a profissional aplica as respostas como "sugerido" (igual
-- a uma sugestão vinda da transcrição) e revisa campo a campo antes de
-- aceitar, exatamente como já funciona hoje.
--
-- SEGURANÇA: esta tabela nunca recebe grant para o papel anon. O acesso
-- público (ler o formulário pelo token e enviar as respostas) passa só
-- por funções de servidor que usam a service role e validam o token em
-- código — nunca por uma policy de RLS tentando replicar "o token bate",
-- que seria frágil e abriria brecha de enumeração.

create table if not exists public.preconsulta_formularios (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  token text not null unique,
  status text not null default 'pendente' check (status in ('pendente', 'respondido')),
  respostas jsonb,
  submitted_at timestamptz,
  expires_at timestamptz not null default (now() + interval '21 days'),
  created_at timestamptz not null default now()
);
create index if not exists preconsulta_formularios_patient_idx on public.preconsulta_formularios(patient_id, created_at desc);

alter table public.preconsulta_formularios enable row level security;
grant select, insert, update, delete on public.preconsulta_formularios to authenticated;
grant all on public.preconsulta_formularios to service_role;

drop policy if exists "preconsulta_formularios_owner_access" on public.preconsulta_formularios;
create policy "preconsulta_formularios_owner_access" on public.preconsulta_formularios
  for all to authenticated
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());
