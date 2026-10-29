-- IA Gerente — Entrega 5 do MVP: histórico de ações e aprovações.
-- Fecha o conjunto de "5 entregas" definido no documento de engenharia
-- reversa. Toda vez que a IA gera um rascunho (resumo do dia ou mensagem
-- de WhatsApp), fica registrado aqui: o que entrou, o que saiu, e se a
-- profissional de fato usou (aprovou) aquele rascunho.
--
-- O conteúdo original (entrada/saida) nunca é reescrito depois de criado
-- — a única transição permitida é o status passar de 'rascunho' para
-- 'aprovado' (quando ela copia a mensagem) ou 'rejeitado', com o
-- carimbo de quando isso aconteceu.

create table if not exists public.acoes_agente (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  agente text not null check (agente in ('resumo_diario', 'mensagem_whatsapp')),
  entrada jsonb not null default '{}'::jsonb,
  saida jsonb not null default '{}'::jsonb,
  status text not null default 'rascunho' check (status in ('rascunho', 'aprovado', 'rejeitado')),
  aprovado_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists acoes_agente_professional_created_idx on public.acoes_agente(professional_id, created_at desc);

alter table public.acoes_agente enable row level security;

grant select, insert, update on public.acoes_agente to authenticated;
grant all on public.acoes_agente to service_role;

create policy "acoes_agente_owner_access" on public.acoes_agente
  for all to authenticated
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());
