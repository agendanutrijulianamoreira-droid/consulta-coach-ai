-- Fecha o acesso anonimo as tabelas clinicas (RLS estava USING(true) para
-- anon+authenticated: qualquer pessoa com a chave publica conseguia ler,
-- gravar ou apagar dados de saude de todas as pacientes). A partir daqui
-- somente usuarios autenticados (login por email/senha) acessam dados
-- clinicos, e somente os dados que o proprio profissional criou.
--
-- Nao remove nem apaga nenhuma linha existente. Pacientes ja cadastrados
-- sem dono (professional_id nulo) sao automaticamente atribuidos ao
-- primeiro profissional que criar conta no sistema (bootstrap de
-- consultorio solo) via o trigger claim_orphan_patients abaixo.

alter table public.patients
  add column if not exists professional_id uuid references auth.users(id) on delete set null;

create index if not exists patients_professional_id_idx on public.patients (professional_id);
create index if not exists consultations_patient_id_idx on public.consultations (patient_id);
create index if not exists food_recall_items_consultation_id_idx on public.food_recall_items (consultation_id);
create index if not exists meal_plans_consultation_id_idx on public.meal_plans (consultation_id);

-- Novas pacientes ja nascem com o dono correto, sem precisar mudar o app.
alter table public.patients alter column professional_id set default auth.uid();

-- Quando a primeira conta de profissional é criada, ela adota qualquer
-- paciente pre-existente sem dono. Em contas seguintes o trigger nao faz
-- nada (o consultorio ja tem dono definido).
create or replace function public.claim_orphan_patients()
returns trigger as $$
begin
  if (select count(*) from auth.users) = 1 then
    update public.patients set professional_id = new.id where professional_id is null;
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public, auth;

drop trigger if exists claim_orphan_patients_on_signup on auth.users;
create trigger claim_orphan_patients_on_signup
  after insert on auth.users
  for each row execute function public.claim_orphan_patients();

-- Substitui as policies abertas por policies restritas ao dono, somente
-- para authenticated (remove completamente o acesso anon).
drop policy if exists "app_access_patients" on public.patients;
create policy "patients_owner_access" on public.patients
  for all to authenticated
  using (professional_id = auth.uid())
  with check (professional_id = auth.uid());

drop policy if exists "app_access_consultations" on public.consultations;
create policy "consultations_owner_access" on public.consultations
  for all to authenticated
  using (exists (
    select 1 from public.patients p
    where p.id = consultations.patient_id and p.professional_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.patients p
    where p.id = consultations.patient_id and p.professional_id = auth.uid()
  ));

do $$
declare t text;
begin
  foreach t in array array[
    'transcript_segments', 'anamnesis', 'anthropometry',
    'food_recall_items', 'diagnoses', 'conducts', 'meal_plans', 'records'
  ]
  loop
    execute format('drop policy if exists "app_access_%1$s" on public.%1$I', t);
    execute format(
      $p$create policy "%1$s_owner_access" on public.%1$I
        for all to authenticated
        using (exists (
          select 1 from public.consultations c
          join public.patients p on p.id = c.patient_id
          where c.id = %1$I.consultation_id and p.professional_id = auth.uid()
        ))
        with check (exists (
          select 1 from public.consultations c
          join public.patients p on p.id = c.patient_id
          where c.id = %1$I.consultation_id and p.professional_id = auth.uid()
        ))$p$,
      t
    );
  end loop;
end $$;

-- Base de alimentos e receitas: acervo clinico compartilhado do
-- consultorio (nao e dado de paciente). Fica restrito a usuarios
-- autenticados, sem isolamento por dono.
drop policy if exists "app_access_foods" on public.foods;
create policy "foods_authenticated_access" on public.foods
  for all to authenticated using (true) with check (true);

drop policy if exists "app_access_recipes" on public.recipes;
create policy "recipes_authenticated_access" on public.recipes
  for all to authenticated using (true) with check (true);

-- Remove o acesso de leitura/escrita concedido ao anon no bootstrap
-- original do projeto.
do $$
declare t text;
begin
  foreach t in array array[
    'patients', 'consultations', 'transcript_segments', 'anamnesis',
    'anthropometry', 'food_recall_items', 'diagnoses', 'conducts',
    'meal_plans', 'records', 'foods', 'recipes'
  ]
  loop
    execute format('revoke select, insert, update, delete on public.%I from anon', t);
  end loop;
end $$;
