-- IA Gerente — Entregas 1 e 2 do MVP (são inseparáveis: a fila de
-- aprovações precisa de uma tabela própria por trás dela, em vez de ser
-- só um cálculo client-side como a antiga "Atenção clínica").
--
-- Duas camadas, como o documento pede: regra fixa detecta o evento
-- (consulta aberta há mais de X horas, falta sem remarcar, aniversário),
-- a tarefa fica registrada aqui, e só a redação do resumo/rascunho é que
-- é IA (entregas 3 e 4, ainda não construídas).
--
-- dedupe_key identifica a mesma situação real entre sincronizações
-- (ex.: 'consulta_aberta:<consultation_id>'), para a tarefa não reaparecer
-- do zero toda vez, e para "adiar"/"descartar" serem lembrados.

create table if not exists public.tarefas_gerente (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete cascade,
  consultation_id uuid references public.consultations(id) on delete cascade,
  dedupe_key text not null,
  tipo text not null check (tipo in (
    'consulta_aberta',
    'falta_sem_remarcar',
    'aniversario'
  )),
  prioridade integer not null,
  titulo text not null,
  motivo text not null,
  action_label text not null,
  action_section text,
  origem text not null default 'regra' check (origem in ('regra', 'ia')),
  status text not null default 'aberta' check (status in ('aberta', 'adiada', 'feita', 'descartada')),
  adiada_ate timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (professional_id, dedupe_key)
);
create index if not exists tarefas_gerente_professional_status_idx on public.tarefas_gerente(professional_id, status, prioridade);

alter table public.tarefas_gerente enable row level security;

grant select, insert, update, delete on public.tarefas_gerente to authenticated;
grant all on public.tarefas_gerente to service_role;

create policy "tarefas_gerente_owner_access" on public.tarefas_gerente
  for all to authenticated
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

drop trigger if exists set_updated_at_tarefas_gerente on public.tarefas_gerente;
create trigger set_updated_at_tarefas_gerente before update on public.tarefas_gerente
  for each row execute function public.set_updated_at();
