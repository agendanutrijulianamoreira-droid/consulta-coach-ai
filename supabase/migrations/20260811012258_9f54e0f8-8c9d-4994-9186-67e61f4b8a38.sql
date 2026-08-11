ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS cpf text,
  ADD COLUMN IF NOT EXISTS is_pregnant boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pregnancy_weeks integer,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.consultations
  ADD COLUMN IF NOT EXISTS consultation_date date NOT NULL DEFAULT current_date;

UPDATE public.consultations SET consultation_date = created_at::date WHERE consultation_date IS DISTINCT FROM created_at::date;

CREATE INDEX IF NOT EXISTS consultations_consultation_date_idx ON public.consultations (consultation_date);
CREATE INDEX IF NOT EXISTS patients_tags_idx ON public.patients USING gin (tags);