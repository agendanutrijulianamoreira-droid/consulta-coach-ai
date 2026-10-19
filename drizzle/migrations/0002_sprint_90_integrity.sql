-- Sprint 90: ownership-safe relations, append-only audit history and domain checks.
-- The composite keys prevent a row from pointing at another owner's record.
ALTER TABLE public.biz_offers ADD CONSTRAINT biz_offers_owner_id_id_key UNIQUE (owner_id, id);
ALTER TABLE public.crm_leads ADD CONSTRAINT crm_leads_owner_id_id_key UNIQUE (owner_id, id);
ALTER TABLE public.ai_proposals ADD CONSTRAINT ai_proposals_owner_id_id_key UNIQUE (owner_id, id);

ALTER TABLE public.crm_leads DROP CONSTRAINT IF EXISTS crm_leads_offer_id_fkey;
ALTER TABLE public.crm_leads
  ADD CONSTRAINT crm_leads_offer_owner_fkey FOREIGN KEY (owner_id, offer_id)
  REFERENCES public.biz_offers (owner_id, id) ON DELETE SET NULL;

ALTER TABLE public.biz_entries DROP CONSTRAINT IF EXISTS biz_entries_offer_id_fkey;
ALTER TABLE public.biz_entries DROP CONSTRAINT IF EXISTS biz_entries_lead_id_fkey;
ALTER TABLE public.biz_entries
  ADD CONSTRAINT biz_entries_offer_owner_fkey FOREIGN KEY (owner_id, offer_id)
  REFERENCES public.biz_offers (owner_id, id) ON DELETE SET NULL;
ALTER TABLE public.biz_entries
  ADD CONSTRAINT biz_entries_lead_owner_fkey FOREIGN KEY (owner_id, lead_id)
  REFERENCES public.crm_leads (owner_id, id) ON DELETE SET NULL;

ALTER TABLE public.crm_lead_events DROP CONSTRAINT IF EXISTS crm_lead_events_lead_id_fkey;
ALTER TABLE public.crm_lead_events
  ADD CONSTRAINT crm_lead_events_lead_owner_fkey FOREIGN KEY (owner_id, lead_id)
  REFERENCES public.crm_leads (owner_id, id) ON DELETE RESTRICT;
ALTER TABLE public.ai_proposal_events DROP CONSTRAINT IF EXISTS ai_proposal_events_proposal_id_fkey;
ALTER TABLE public.ai_proposal_events
  ADD CONSTRAINT ai_proposal_events_proposal_owner_fkey FOREIGN KEY (owner_id, proposal_id)
  REFERENCES public.ai_proposals (owner_id, id) ON DELETE RESTRICT;

ALTER TABLE public.crm_leads
  ADD CONSTRAINT crm_leads_stage_check CHECK (stage IN ('novo','qualificacao','consulta_oferecida','aguardando_pagamento','confirmada','realizada','protocolo_apresentado','ganho','perdido','reagendado'));
ALTER TABLE public.crm_lead_events
  ADD CONSTRAINT crm_lead_events_kind_check CHECK (kind IN ('criacao','mudanca_estagio','nota','follow_up'));
ALTER TABLE public.biz_entries
  ADD CONSTRAINT biz_entries_date_check CHECK (due_date IS NULL OR due_date >= entry_date);

-- Prevent duplicate active leads for one owner while allowing historical/demo records.
CREATE UNIQUE INDEX crm_leads_owner_phone_unique
  ON public.crm_leads (owner_id, regexp_replace(phone, '[^0-9]', '', 'g'))
  WHERE phone IS NOT NULL AND phone <> '' AND is_demo = false;
CREATE UNIQUE INDEX crm_leads_owner_email_unique
  ON public.crm_leads (owner_id, lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '' AND is_demo = false;
