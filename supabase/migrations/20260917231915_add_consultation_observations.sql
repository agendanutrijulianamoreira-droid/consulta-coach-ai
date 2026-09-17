alter table public.consultations
  add column if not exists observations text;

comment on column public.consultations.observations is
  'Observações informadas pelo profissional ao registrar o atendimento.';
