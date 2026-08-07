ALTER TABLE public.conducts ADD COLUMN IF NOT EXISTS energy jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.records ADD COLUMN IF NOT EXISTS report text;