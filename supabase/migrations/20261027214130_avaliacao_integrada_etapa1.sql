-- Avaliação Integrada — Etapa 1 (Telas 1 e 2: Fontes e Síntese).
-- Schema mínimo para esta etapa: uma avaliação por consulta, com as
-- telas registradas individualmente (texto gerado por IA, texto final
-- revisado pela profissional e as fontes citadas para cada uma).
-- Hipóteses, metas e rotina (Telas 3, 5, 6 e 7) entram em etapas futuras —
-- não são criadas aqui para não travar esta etapa em decisões clínicas
-- que ainda dependem da Juliana.

create table if not exists public.avaliacoes_integradas (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null unique references public.consultations(id) on delete cascade,
  version integer not null default 1,
  status text not null default 'rascunho' check (status in ('rascunho', 'aprovada')),
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Uma linha por tela (ex.: 'fontes', 'sintese'). ai_text guarda o rascunho
-- gerado pela IA; final_text é o que a profissional efetivamente revisou e
-- aprovou — nunca o mesmo campo, para que o texto gerado por IA nunca vá
-- ao paciente sem passar por revisão humana explícita.
create table if not exists public.avaliacao_telas (
  id uuid primary key default gen_random_uuid(),
  avaliacao_id uuid not null references public.avaliacoes_integradas(id) on delete cascade,
  tela text not null check (tela in ('fontes', 'sintese', 'exames', 'hipoteses', 'rotina', 'conduta')),
  ai_text jsonb,
  final_text jsonb,
  sources jsonb not null default '[]'::jsonb,
  status text not null default 'pendente' check (status in ('pendente', 'revisao', 'aprovada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (avaliacao_id, tela)
);
create index if not exists avaliacao_telas_avaliacao_idx on public.avaliacao_telas(avaliacao_id);

-- Lista editável de termos de alerta (dor muito forte, sangramento intenso,
-- vômitos persistentes, perda de peso rápida, piora emocional etc.). É uma
-- regra fixa e barata verificada antes de qualquer rascunho de IA — nunca
-- a própria IA decide o que é um sinal de alerta.
create table if not exists public.avaliacao_alert_terms (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  term text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, term)
);

alter table public.avaliacoes_integradas enable row level security;
alter table public.avaliacao_telas enable row level security;
alter table public.avaliacao_alert_terms enable row level security;

grant select, insert, update, delete on public.avaliacoes_integradas to authenticated;
grant select, insert, update, delete on public.avaliacao_telas to authenticated;
grant select, insert, update, delete on public.avaliacao_alert_terms to authenticated;
grant all on public.avaliacoes_integradas to service_role;
grant all on public.avaliacao_telas to service_role;
grant all on public.avaliacao_alert_terms to service_role;

create policy "avaliacoes_integradas_owner_access" on public.avaliacoes_integradas
  for all to authenticated
  using (exists (
    select 1 from public.consultations c
    join public.patients p on p.id = c.patient_id
    where c.id = avaliacoes_integradas.consultation_id and p.professional_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.consultations c
    join public.patients p on p.id = c.patient_id
    where c.id = avaliacoes_integradas.consultation_id and p.professional_id = auth.uid()
  ));

create policy "avaliacao_telas_owner_access" on public.avaliacao_telas
  for all to authenticated
  using (exists (
    select 1 from public.avaliacoes_integradas a
    join public.consultations c on c.id = a.consultation_id
    join public.patients p on p.id = c.patient_id
    where a.id = avaliacao_telas.avaliacao_id and p.professional_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.avaliacoes_integradas a
    join public.consultations c on c.id = a.consultation_id
    join public.patients p on p.id = c.patient_id
    where a.id = avaliacao_telas.avaliacao_id and p.professional_id = auth.uid()
  ));

create policy "avaliacao_alert_terms_owner_access" on public.avaliacao_alert_terms
  for all to authenticated
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

drop trigger if exists set_updated_at_avaliacoes_integradas on public.avaliacoes_integradas;
create trigger set_updated_at_avaliacoes_integradas before update on public.avaliacoes_integradas
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_avaliacao_telas on public.avaliacao_telas;
create trigger set_updated_at_avaliacao_telas before update on public.avaliacao_telas
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_avaliacao_alert_terms on public.avaliacao_alert_terms;
create trigger set_updated_at_avaliacao_alert_terms before update on public.avaliacao_alert_terms
  for each row execute function public.set_updated_at();

-- Sementes editáveis da lista de alerta, por profissional já existente.
-- A Juliana deve revisar/ajustar esta lista antes de usar com pacientes.
insert into public.avaliacao_alert_terms (professional_id, term)
select id, term
from auth.users
cross join (values
  ('dor muito forte'),
  ('sangramento intenso'),
  ('vômitos persistentes'),
  ('perda de peso rápida'),
  ('piora emocional')
) as seed(term)
on conflict (professional_id, term) do nothing;
