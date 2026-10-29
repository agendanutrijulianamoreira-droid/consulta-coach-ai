-- Protocolos por condição (P1 do WebDiet): biblioteca reutilizável de
-- protocolos clínicos por condição (mioma, endometriose, adenomiose, SOMP,
-- intestino inflamado, compulsão, retenção, fadiga hormonal), separada do
-- "Método" (que já existe em localStorage e modela o programa comercial de
-- 60/90 dias, não protocolos clínicos por condição).
--
-- "Aplicar à paciente" nunca copia automaticamente para o prontuário dela —
-- só registra o uso (protocolo_aplicacoes) e devolve o texto para a
-- profissional colar onde fizer sentido, revisado e adaptado por ela.

create table if not exists public.protocolos (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null,
  conditions text[] not null default '{}'::text[]
    check (conditions <@ array['mioma','endometriose','adenomiose','somp','intestino_inflamado','compulsao','retencao','fadiga_hormonal','outro']::text[]),
  objetivo text not null default '',
  pilares text[] not null default '{}'::text[],
  atencao text[] not null default '{}'::text[],
  alimentos_sugeridos text[] not null default '{}'::text[],
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists protocolos_professional_idx on public.protocolos(professional_id, created_at desc);

create table if not exists public.protocolo_aplicacoes (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  protocolo_id uuid not null references public.protocolos(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists protocolo_aplicacoes_protocolo_idx on public.protocolo_aplicacoes(protocolo_id, created_at desc);

do $$ declare table_name text; begin
  foreach table_name in array array['protocolos','protocolo_aplicacoes'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', table_name);
    execute format('grant all on public.%I to service_role', table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('drop policy if exists "%1$s_owner_access" on public.%1$I', table_name);
    execute format('create policy "%1$s_owner_access" on public.%1$I for all to authenticated using (professional_id = auth.uid()) with check (professional_id = auth.uid())', table_name);
  end loop;
end $$;
