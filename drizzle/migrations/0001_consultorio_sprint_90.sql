CREATE TABLE public.sprint_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid() UNIQUE,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_steps text[] NOT NULL DEFAULT '{}',
  current_step text NOT NULL DEFAULT 'diagnostico',
  checks jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.biz_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'servico_clinico' CHECK (kind IN ('assinatura','checkout','servico_clinico')),
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  cash_price numeric(12,2) CHECK (cash_price >= 0),
  duration_months integer NOT NULL DEFAULT 0 CHECK (duration_months >= 0),
  variable_cost numeric(12,2) NOT NULL DEFAULT 0 CHECK (variable_cost >= 0),
  minutes_spent integer NOT NULL DEFAULT 0 CHECK (minutes_spent >= 0),
  monthly_capacity integer CHECK (monthly_capacity >= 0),
  active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX biz_offers_owner_idx ON public.biz_offers(owner_id);
CREATE TABLE public.crm_leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 160),
  phone text,
  email text,
  source text NOT NULL DEFAULT 'outro' CHECK (source IN ('instagram','google','whatsapp','indicacao','outro')),
  stage text NOT NULL DEFAULT 'novo',
  offer_id uuid REFERENCES public.biz_offers(id) ON DELETE SET NULL,
  next_action text,
  next_action_at timestamptz,
  commercial_notes text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_leads_owner_idx ON public.crm_leads(owner_id);
CREATE TABLE public.crm_lead_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  lead_id uuid NOT NULL REFERENCES public.crm_leads(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'nota',
  from_stage text,
  to_stage text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX crm_lead_events_lead_idx ON public.crm_lead_events(lead_id);
CREATE INDEX crm_lead_events_owner_idx ON public.crm_lead_events(owner_id);
CREATE TABLE public.biz_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  entry_type text NOT NULL CHECK (entry_type IN ('contrato','recebimento','reconhecimento')),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  entry_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  due_date date,
  status text NOT NULL DEFAULT 'ok' CHECK (status IN ('ok','pendente','atrasado')),
  is_renewal boolean NOT NULL DEFAULT false,
  offer_id uuid REFERENCES public.biz_offers(id) ON DELETE SET NULL,
  lead_id uuid REFERENCES public.crm_leads(id) ON DELETE SET NULL,
  description text,
  is_demo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX biz_entries_owner_idx ON public.biz_entries(owner_id, entry_date);
CREATE TABLE public.biz_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  metric text NOT NULL,
  target numeric(12,2) NOT NULL CHECK (target >= 0),
  period_month date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (owner_id, metric, period_month)
);
CREATE TABLE public.message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  journey_step text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','aprovado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX message_templates_owner_idx ON public.message_templates(owner_id);
CREATE TABLE public.ai_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  agent text NOT NULL CHECK (agent IN ('helena','comercial','experiencia','clinica','operacoes')),
  title text NOT NULL,
  body text NOT NULL,
  data_summary text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('proposta','pendente','aprovado','rejeitado','executado')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_proposals_owner_idx ON public.ai_proposals(owner_id);
CREATE TABLE public.ai_proposal_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  proposal_id uuid NOT NULL REFERENCES public.ai_proposals(id) ON DELETE CASCADE,
  actor text NOT NULL,
  action text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ai_proposal_events_proposal_idx ON public.ai_proposal_events(proposal_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sprint_progress','biz_offers','crm_leads','crm_lead_events','biz_entries','biz_goals','message_templates','ai_proposals','ai_proposal_events'] LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY owner_all ON public.%I FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid())', t);
  END LOOP;
  FOREACH t IN ARRAY ARRAY['sprint_progress','biz_offers','crm_leads','message_templates','ai_proposals'] LOOP
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
  END LOOP;
END $$;
-- Audit trail is append-only
DROP POLICY owner_all ON public.ai_proposal_events;
CREATE POLICY owner_read ON public.ai_proposal_events FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY owner_insert ON public.ai_proposal_events FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.ai_proposals p WHERE p.id = proposal_id AND p.owner_id = auth.uid()));
-- Lead events must belong to own lead
DROP POLICY owner_all ON public.crm_lead_events;
CREATE POLICY owner_read ON public.crm_lead_events FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY owner_insert ON public.crm_lead_events FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid() AND EXISTS (SELECT 1 FROM public.crm_leads l WHERE l.id = lead_id AND l.owner_id = auth.uid()));