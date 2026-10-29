-- Financeiro (P1 do WebDiet) — liga o financeiro já existente (Sprint 90:
-- crm_leads, biz_entries) a pacientes de verdade. Hoje um lançamento só
-- pode ser vinculado a um lead do CRM (lead_id); isso cobre a venda, mas
-- depois que a paciente já está cadastrada no Prontuário não há como ver
-- a situação financeira dela ali — nem cobrar renovação sem recriar um
-- lead. patient_id resolve isso: opcional, "on delete set null" porque um
-- lançamento financeiro é histórico e não deve desaparecer se a ficha da
-- paciente for excluída.
--
-- Não recria policy de RLS: essas tabelas já são scoped por owner_id,
-- e uma coluna nova nula não muda esse comportamento.

alter table public.crm_leads add column if not exists patient_id uuid references public.patients(id) on delete set null;
alter table public.biz_entries add column if not exists patient_id uuid references public.patients(id) on delete set null;

create index if not exists crm_leads_patient_idx on public.crm_leads(patient_id);
create index if not exists biz_entries_patient_idx on public.biz_entries(patient_id);
