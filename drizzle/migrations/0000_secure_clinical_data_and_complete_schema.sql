ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS professional_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.patients ALTER COLUMN professional_id SET DEFAULT auth.uid();

DO $$
DECLARE sole_user_id uuid;
BEGIN
  IF (SELECT count(*) FROM auth.users) = 1 THEN
    SELECT id INTO sole_user_id FROM auth.users LIMIT 1;
    UPDATE public.patients SET professional_id = sole_user_id WHERE professional_id IS NULL;
  END IF;
END $$;

ALTER TABLE public.diagnoses ADD COLUMN IF NOT EXISTS reasoning jsonb NOT NULL DEFAULT '{}'::jsonb;
CREATE INDEX IF NOT EXISTS patients_professional_id_idx ON public.patients (professional_id);
CREATE INDEX IF NOT EXISTS consultations_patient_id_idx ON public.consultations (patient_id);
CREATE INDEX IF NOT EXISTS food_recall_items_consultation_id_idx ON public.food_recall_items (consultation_id);
CREATE INDEX IF NOT EXISTS meal_plans_consultation_id_idx ON public.meal_plans (consultation_id);
CREATE INDEX IF NOT EXISTS lab_results_consultation_idx ON public.lab_results (consultation_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.patients, public.consultations,
  public.transcript_segments, public.anamnesis, public.anthropometry,
  public.food_recall_items, public.diagnoses, public.conducts,
  public.meal_plans, public.records, public.foods, public.recipes,
  public.lab_assessments, public.lab_results, public.lab_reference_targets TO authenticated;
GRANT ALL ON public.patients, public.consultations, public.transcript_segments,
  public.anamnesis, public.anthropometry, public.food_recall_items,
  public.diagnoses, public.conducts, public.meal_plans, public.records,
  public.foods, public.recipes, public.lab_assessments, public.lab_results,
  public.lab_reference_targets TO service_role;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.patients, public.consultations,
  public.transcript_segments, public.anamnesis, public.anthropometry,
  public.food_recall_items, public.diagnoses, public.conducts,
  public.meal_plans, public.records, public.foods, public.recipes,
  public.lab_assessments, public.lab_results, public.lab_reference_targets FROM anon;

DROP POLICY IF EXISTS "app_access_patients" ON public.patients;
DROP POLICY IF EXISTS "patients_owner_access" ON public.patients;
CREATE POLICY "patients_owner_access" ON public.patients FOR ALL TO authenticated
  USING (professional_id = auth.uid()) WITH CHECK (professional_id = auth.uid());

DROP POLICY IF EXISTS "app_access_consultations" ON public.consultations;
DROP POLICY IF EXISTS "consultations_owner_access" ON public.consultations;
CREATE POLICY "consultations_owner_access" ON public.consultations FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = consultations.patient_id AND p.professional_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.patients p WHERE p.id = consultations.patient_id AND p.professional_id = auth.uid()));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['transcript_segments','anamnesis','anthropometry','food_recall_items','diagnoses','conducts','meal_plans','records','lab_assessments','lab_results'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "app_access_%1$s" ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "%1$s_owner_access" ON public.%1$I', t);
    EXECUTE format($policy$CREATE POLICY "%1$s_owner_access" ON public.%1$I FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM public.consultations c JOIN public.patients p ON p.id = c.patient_id WHERE c.id = %1$I.consultation_id AND p.professional_id = auth.uid()))
      WITH CHECK (EXISTS (SELECT 1 FROM public.consultations c JOIN public.patients p ON p.id = c.patient_id WHERE c.id = %1$I.consultation_id AND p.professional_id = auth.uid()))$policy$, t);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "app_access_lab_reference_targets" ON public.lab_reference_targets;
DROP POLICY IF EXISTS "lab_reference_targets_owner_access" ON public.lab_reference_targets;
CREATE POLICY "lab_reference_targets_owner_access" ON public.lab_reference_targets FOR ALL TO authenticated
  USING (professional_id = auth.uid()) WITH CHECK (professional_id = auth.uid());

DROP POLICY IF EXISTS "app_access_foods" ON public.foods;
DROP POLICY IF EXISTS "foods_authenticated_access" ON public.foods;
CREATE POLICY "foods_authenticated_access" ON public.foods FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "app_access_recipes" ON public.recipes;
DROP POLICY IF EXISTS "recipes_authenticated_access" ON public.recipes;
CREATE POLICY "recipes_authenticated_access" ON public.recipes FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMENT ON COLUMN public.patients.professional_id IS 'Owner of the clinical record; RLS isolates each professional account.';
COMMENT ON COLUMN public.diagnoses.reasoning IS 'Structured clinical reasoning for findings, reviewable hypotheses, priorities, and directions.';
NOTIFY pgrst, 'reload schema';