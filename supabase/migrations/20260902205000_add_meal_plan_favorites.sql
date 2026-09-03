alter table public.meal_plans
  add column if not exists is_favorite boolean not null default false;

create index if not exists meal_plans_favorite_idx
  on public.meal_plans (consultation_id, is_favorite)
  where is_favorite = true;
