-- Mapa Metabólico 360°: avaliações relacionais ligadas à consulta.
-- Fontes existentes (anthropometry, conducts, lab_results e anamnesis) continuam
-- sendo as fontes canônicas; estas tabelas guardam dados específicos e revisão.
create table if not exists public.metabolic_assessments (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null unique references public.consultations(id) on delete cascade,
  review_status text not null default 'draft' check (review_status in ('draft','in_review','approved')),
  clinical_summary text,
  patient_summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.metabolic_context_entries (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.metabolic_assessments(id) on delete cascade,
  domain text not null check (domain in ('contexto_clinico','saude_da_mulher','rotina')),
  label text not null,
  value text not null,
  source_kind text not null default 'manual' check (source_kind in ('manual','informed','ai_extracted','calculated','measured','imported')),
  source_date date,
  method text,
  review_status text not null default 'confirmed' check (review_status in ('pending','confirmed','rejected')),
  evidence_source text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists metabolic_context_assessment_idx on public.metabolic_context_entries(assessment_id, domain);

create table if not exists public.metabolic_capacity_measurements (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null unique references public.metabolic_assessments(id) on delete cascade,
  right_grip_kgf numeric,
  left_grip_kgf numeric,
  grip_protocol text,
  grip_measured_at date,
  span_value numeric,
  span_unit text check (span_unit in ('cm','m','in')),
  span_method text,
  span_purpose text,
  notes text,
  source_kind text not null default 'measured' check (source_kind in ('manual','informed','ai_extracted','calculated','measured','imported')),
  review_status text not null default 'confirmed' check (review_status in ('pending','confirmed','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.metabolic_energy_measurements (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.metabolic_assessments(id) on delete cascade,
  measurement_kind text not null check (measurement_kind in ('estimated','measured')),
  kcal numeric not null check (kcal > 0),
  unit text not null default 'kcal/dia',
  formula text,
  inputs jsonb not null default '{}'::jsonb,
  equipment text,
  conditions text,
  measured_at date,
  source_kind text not null default 'calculated' check (source_kind in ('manual','informed','ai_extracted','calculated','measured','imported')),
  review_status text not null default 'confirmed' check (review_status in ('pending','confirmed','rejected')),
  evidence_source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists metabolic_energy_assessment_idx on public.metabolic_energy_measurements(assessment_id, measured_at);

create table if not exists public.metabolic_genetic_findings (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.metabolic_assessments(id) on delete cascade,
  report_file_name text,
  report_reference text,
  laboratory text,
  test_date date,
  variant text,
  result_genotype text,
  evidence_level text,
  source text,
  review_status text not null default 'pending' check (review_status in ('pending','confirmed','rejected')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists metabolic_genetic_assessment_idx on public.metabolic_genetic_findings(assessment_id, test_date);

-- Laudos genéticos são privados. O primeiro segmento do caminho é o assessment_id,
-- permitindo que Storage aplique o mesmo isolamento profissional das tabelas clínicas.
insert into storage.buckets (id, name, public)
values ('clinical-documents', 'clinical-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "clinical_documents_owner_read" on storage.objects;
create policy "clinical_documents_owner_read" on storage.objects for select to authenticated
using (bucket_id = 'clinical-documents' and exists (
  select 1 from public.metabolic_assessments a
  join public.consultations c on c.id = a.consultation_id
  join public.patients p on p.id = c.patient_id
  where a.id::text = split_part(storage.objects.name, '/', 1) and p.professional_id = auth.uid()
));
drop policy if exists "clinical_documents_owner_insert" on storage.objects;
create policy "clinical_documents_owner_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'clinical-documents' and exists (
  select 1 from public.metabolic_assessments a
  join public.consultations c on c.id = a.consultation_id
  join public.patients p on p.id = c.patient_id
  where a.id::text = split_part(storage.objects.name, '/', 1) and p.professional_id = auth.uid()
));
drop policy if exists "clinical_documents_owner_update" on storage.objects;
create policy "clinical_documents_owner_update" on storage.objects for update to authenticated
using (bucket_id = 'clinical-documents' and exists (
  select 1 from public.metabolic_assessments a
  join public.consultations c on c.id = a.consultation_id
  join public.patients p on p.id = c.patient_id
  where a.id::text = split_part(storage.objects.name, '/', 1) and p.professional_id = auth.uid()
));
drop policy if exists "clinical_documents_owner_delete" on storage.objects;
create policy "clinical_documents_owner_delete" on storage.objects for delete to authenticated
using (bucket_id = 'clinical-documents' and exists (
  select 1 from public.metabolic_assessments a
  join public.consultations c on c.id = a.consultation_id
  join public.patients p on p.id = c.patient_id
  where a.id::text = split_part(storage.objects.name, '/', 1) and p.professional_id = auth.uid()
));

do $$ declare table_name text; begin
  foreach table_name in array array['metabolic_assessments','metabolic_context_entries','metabolic_capacity_measurements','metabolic_energy_measurements','metabolic_genetic_findings'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('grant all on public.%I to service_role', table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "%1$s_owner_access" on public.%1$I', table_name);
  end loop;
end $$;

create policy "metabolic_assessments_owner_access" on public.metabolic_assessments for all to authenticated
using (exists (select 1 from public.consultations c join public.patients p on p.id = c.patient_id where c.id = metabolic_assessments.consultation_id and p.professional_id = auth.uid()))
with check (exists (select 1 from public.consultations c join public.patients p on p.id = c.patient_id where c.id = metabolic_assessments.consultation_id and p.professional_id = auth.uid()));

do $$ declare table_name text; begin
  foreach table_name in array array['metabolic_context_entries','metabolic_capacity_measurements','metabolic_energy_measurements','metabolic_genetic_findings'] loop
    execute format('create policy "%1$s_owner_access" on public.%1$I for all to authenticated using (exists (select 1 from public.%2$I x join public.metabolic_assessments a on a.id = x.assessment_id join public.consultations c on c.id = a.consultation_id join public.patients p on p.id = c.patient_id where x.id = %2$I.id and p.professional_id = auth.uid())) with check (exists (select 1 from public.%2$I x join public.metabolic_assessments a on a.id = x.assessment_id join public.consultations c on c.id = a.consultation_id join public.patients p on p.id = c.patient_id where x.id = %2$I.id and p.professional_id = auth.uid()))', table_name, table_name);
  end loop;
end $$;

drop trigger if exists set_updated_at_metabolic_assessments on public.metabolic_assessments;
create trigger set_updated_at_metabolic_assessments before update on public.metabolic_assessments for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_metabolic_context_entries on public.metabolic_context_entries;
create trigger set_updated_at_metabolic_context_entries before update on public.metabolic_context_entries for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_metabolic_capacity_measurements on public.metabolic_capacity_measurements;
create trigger set_updated_at_metabolic_capacity_measurements before update on public.metabolic_capacity_measurements for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_metabolic_energy_measurements on public.metabolic_energy_measurements;
create trigger set_updated_at_metabolic_energy_measurements before update on public.metabolic_energy_measurements for each row execute function public.set_updated_at();
drop trigger if exists set_updated_at_metabolic_genetic_findings on public.metabolic_genetic_findings;
create trigger set_updated_at_metabolic_genetic_findings before update on public.metabolic_genetic_findings for each row execute function public.set_updated_at();
