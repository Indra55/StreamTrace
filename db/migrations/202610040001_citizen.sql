alter table public.reports add column if not exists citizen_context jsonb not null default '{}'::jsonb;
-- Reference UUIDs are unguessable submission IDs. Publish only state, never notes or identities.
create or replace function public.report_status(p_ref uuid)
returns table(ref uuid, state text)
language sql stable security definer set search_path = '' as $$
  select r.id, coalesce(d.state,'unreviewed') from public.reports r
  left join public.review_decisions d on d.report_id=r.id where r.id=p_ref;
$$;
revoke all on function public.report_status(uuid) from public;
