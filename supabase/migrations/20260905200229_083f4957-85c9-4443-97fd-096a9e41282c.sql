CREATE TABLE public.lab_assessments (
  id uuid primary key default gen_random_uuid(),
  consultation_id uuid not null unique references public.consultations(id) on delete cascade,
  collection_date date,
  laboratory_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_assessments TO anon, authenticated;
GRANT ALL ON public.lab_assessments TO service_role;
ALTER TABLE public.lab_assessments ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_access_lab_assessments ON public.lab_assessments FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.lab_results (
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
  review_status text not null default 'pending',
  is_derived boolean not null default false,
  calculation_key text,
  calculation_version text,
  dependencies jsonb not null default '[]'::jsonb,
  source_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
CREATE INDEX lab_results_consultation_id_idx ON public.lab_results(consultation_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_results TO anon, authenticated;
GRANT ALL ON public.lab_results TO service_role;
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_access_lab_results ON public.lab_results FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.lab_reference_targets (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid,
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
  updated_at timestamptz not null default now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lab_reference_targets TO anon, authenticated;
GRANT ALL ON public.lab_reference_targets TO service_role;
ALTER TABLE public.lab_reference_targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY app_access_lab_reference_targets ON public.lab_reference_targets FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);