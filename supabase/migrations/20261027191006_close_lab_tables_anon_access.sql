-- A migration 20260905200229 recriou lab_assessments/lab_results/
-- lab_reference_targets com uma policy "app_access_*" aberta
-- (USING(true) para anon, authenticated) ao lado da policy
-- "*_owner_access" restrita que a migration 20260902153000 já tinha
-- criado. Como policies permissivas do RLS se combinam com OR, a
-- policy aberta tornava a restrita inútil: qualquer pessoa com a
-- chave publica conseguia ler/gravar resultado de exame de qualquer
-- paciente, sem login. Resultado de exame (hormonal, etc.) e dado de
-- saude tao sensivel quanto o que a migration 20260901190643 ja
-- havia protegido nas demais tabelas clinicas -- este e o mesmo
-- retrocesso critico, agora so nestas 3 tabelas.
--
-- Mantem a policy "*_owner_access" (que ja isola por dono) e so
-- remove a policy aberta e a concessao a anon. Nao apaga linhas.

do $$
declare t text;
begin
  foreach t in array array['lab_assessments', 'lab_results', 'lab_reference_targets']
  loop
    execute format('drop policy if exists "app_access_%1$s" on public.%1$I', t);
    execute format('revoke select, insert, update, delete on public.%I from anon', t);
  end loop;
end $$;
