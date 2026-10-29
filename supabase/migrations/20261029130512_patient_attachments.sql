-- Prontuário — anexos e fotos de evolução. Fecha o gap de "Arquivos
-- anexos" do WebDiet e a Etapa 8 (Evolução fotográfica) da Avaliação
-- Integrada: as duas pedem a mesma capacidade de base (arquivo vinculado
-- à paciente, com data e rótulo), então ficam na mesma tabela,
-- diferenciadas por "kind".
--
-- Fotos de evolução exigem consentimento explícito antes da primeira
-- captura (photo_consent_at) — a UI não libera o upload de foto sem isso.

alter table public.patients add column if not exists photo_consent_at timestamptz;

create table if not exists public.patient_attachments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients(id) on delete cascade,
  professional_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  kind text not null check (kind in ('anexo', 'foto_evolucao')),
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  size_bytes integer not null,
  label text,
  taken_at date,
  created_at timestamptz not null default now()
);
create index if not exists patient_attachments_patient_kind_idx on public.patient_attachments(patient_id, kind, created_at desc);

alter table public.patient_attachments enable row level security;
grant select, insert, update, delete on public.patient_attachments to authenticated;
grant all on public.patient_attachments to service_role;

drop policy if exists "patient_attachments_owner_access" on public.patient_attachments;
create policy "patient_attachments_owner_access" on public.patient_attachments
  for all to authenticated
  using (exists (select 1 from public.patients p where p.id = patient_attachments.patient_id and p.professional_id = auth.uid()))
  with check (exists (select 1 from public.patients p where p.id = patient_attachments.patient_id and p.professional_id = auth.uid()));

-- Reaproveita o bucket "clinical-documents" (já criado para laudos do Mapa
-- Metabólico). Aqui o primeiro segmento do caminho é o patient_id — já
-- conhecido antes do upload, diferente do id da linha de anexo, que só
-- existe depois do insert.
insert into storage.buckets (id, name, public)
values ('clinical-documents', 'clinical-documents', false)
on conflict (id) do update set public = false;

drop policy if exists "clinical_documents_patient_owner_read" on storage.objects;
create policy "clinical_documents_patient_owner_read" on storage.objects for select to authenticated
using (bucket_id = 'clinical-documents' and exists (
  select 1 from public.patients p
  where p.id::text = split_part(storage.objects.name, '/', 1) and p.professional_id = auth.uid()
));
drop policy if exists "clinical_documents_patient_owner_insert" on storage.objects;
create policy "clinical_documents_patient_owner_insert" on storage.objects for insert to authenticated
with check (bucket_id = 'clinical-documents' and exists (
  select 1 from public.patients p
  where p.id::text = split_part(storage.objects.name, '/', 1) and p.professional_id = auth.uid()
));
drop policy if exists "clinical_documents_patient_owner_delete" on storage.objects;
create policy "clinical_documents_patient_owner_delete" on storage.objects for delete to authenticated
using (bucket_id = 'clinical-documents' and exists (
  select 1 from public.patients p
  where p.id::text = split_part(storage.objects.name, '/', 1) and p.professional_id = auth.uid()
));
