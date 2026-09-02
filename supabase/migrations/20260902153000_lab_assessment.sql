-- Etapa 6: exames laboratoriais longitudinais.
-- Resultados medidos e índices derivados ficam por consulta; a evolução é
-- obtida pelo paciente através da consulta, sem duplicar vínculo clínico.

create table if not exists public.lab_assessments (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null unique references public.consultations(id) on delete cascade,
  collection_date date,
  laboratory_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lab_results (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null references public.consultations(id) on delete cascade,
  analyte_code text not null,
  analyte_name text not null,
  value numeric,
  value_text text,
  unit text,
  lab_reference_min numeric,
  lab_reference_max numeric,
  lab_reference_text text,
  input_method text not null default 'manual',
  review_status text not null default 'confirmed',
  is_derived boolean not null default false,
  calculation_key text,
  calculation_version text,
  dependencies jsonb not null default '[]'::jsonb,
  source_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lab_results_input_method_check check (input_method in ('manual','dictation','image','pdf','derived')),
  constraint lab_results_review_status_check check (review_status in ('pending','confirmed','rejected'))
);

create index if not exists lab_results_consultation_idx on public.lab_results(consultation_id);
create index if not exists lab_results_analyte_idx on public.lab_results(analyte_code);

-- Padrões clínico-nutricionais editáveis do consultório. Não são tratados como
-- intervalos universais; cada faixa guarda população, unidade e fonte/versão.
create table if not exists public.lab_reference_targets (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  analyte_code text not null,
  analyte_name text not null,
  unit text,
  sex text,
  age_min integer,
  age_max integer,
  target_min numeric,
  target_max numeric,
  interpretation_below text,
  interpretation_in_range text,
  interpretation_above text,
  source_label text,
  source_version text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, analyte_code, unit, sex, age_min, age_max)
);

alter table public.lab_assessments enable row level security;
alter table public.lab_results enable row level security;
alter table public.lab_reference_targets enable row level security;

grant select, insert, update, delete on public.lab_assessments to authenticated;
grant select, insert, update, delete on public.lab_results to authenticated;
grant select, insert, update, delete on public.lab_reference_targets to authenticated;
grant all on public.lab_assessments to service_role;
grant all on public.lab_results to service_role;
grant all on public.lab_reference_targets to service_role;

create policy "lab_assessments_owner_access" on public.lab_assessments
  for all to authenticated
  using (exists (
    select 1 from public.consultations c
    join public.patients p on p.id = c.patient_id
    where c.id = lab_assessments.consultation_id and p.professional_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.consultations c
    join public.patients p on p.id = c.patient_id
    where c.id = lab_assessments.consultation_id and p.professional_id = auth.uid()
  ));

create policy "lab_results_owner_access" on public.lab_results
  for all to authenticated
  using (exists (
    select 1 from public.consultations c
    join public.patients p on p.id = c.patient_id
    where c.id = lab_results.consultation_id and p.professional_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.consultations c
    join public.patients p on p.id = c.patient_id
    where c.id = lab_results.consultation_id and p.professional_id = auth.uid()
  ));

create policy "lab_reference_targets_owner_access" on public.lab_reference_targets
  for all to authenticated
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

drop trigger if exists set_updated_at_lab_assessments on public.lab_assessments;
create trigger set_updated_at_lab_assessments before update on public.lab_assessments
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_lab_results on public.lab_results;
create trigger set_updated_at_lab_results before update on public.lab_results
  for each row execute function public.set_updated_at();

drop trigger if exists set_updated_at_lab_reference_targets on public.lab_reference_targets;
create trigger set_updated_at_lab_reference_targets before update on public.lab_reference_targets
  for each row execute function public.set_updated_at();
