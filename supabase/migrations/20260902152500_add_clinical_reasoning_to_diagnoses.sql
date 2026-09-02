-- Etapa 7: raciocínio clínico nutricional estruturado.
-- Migração aditiva: preserva hypotheses e recall_flags legados.

alter table public.diagnoses
  add column if not exists reasoning jsonb not null default '{}'::jsonb;

comment on column public.diagnoses.reasoning is
  'Raciocínio clínico nutricional estruturado: achados, hipóteses revisáveis, prioridades e direcionamentos.';
