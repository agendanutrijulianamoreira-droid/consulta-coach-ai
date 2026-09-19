alter table public.consultations
  add column if not exists observations text,
  add column if not exists record_kind text not null default 'attendance',
  add column if not exists visible_in_history boolean not null default true;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.consultations'::regclass
      and conname = 'consultations_record_kind_check'
  ) then
    alter table public.consultations
      add constraint consultations_record_kind_check
      check (record_kind in ('attendance', 'module'));
  end if;
end
$$;

comment on column public.consultations.observations is
  'Observações informadas pelo profissional ao registrar o atendimento.';

comment on column public.consultations.record_kind is
  'Distingue atendimentos reais de contêineres técnicos criados por módulos clínicos.';

comment on column public.consultations.visible_in_history is
  'Controla somente a exibição no histórico administrativo e no relatório do consultório; não remove dados clínicos.';

notify pgrst, 'reload schema';
