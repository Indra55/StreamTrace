create schema if not exists auth;
revoke all on schema auth from public;
create or replace function auth.uid() returns uuid
language sql stable set search_path = '' as $$
  select (nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub')::uuid;
$$;
do $$
begin
  if not exists(select 1 from pg_roles where rolname='app_anon') then create role app_anon nologin; end if;
  if not exists(select 1 from pg_roles where rolname='app_authenticated') then create role app_authenticated nologin; end if;
  if not exists(select 1 from pg_roles where rolname='app_login') then create role app_login login; end if;
end;
$$;
alter role app_anon nologin nobypassrls nocreatedb nocreaterole noreplication;
alter role app_authenticated nologin nobypassrls nocreatedb nocreaterole noreplication;
alter role app_login login noinherit nobypassrls nocreatedb nocreaterole noreplication;
-- SQL-created roles default to NOSUPERUSER. Neon rejects altering that flag,
-- so verify it explicitly rather than requesting an unavailable privilege.
do $$
begin
  if exists(select 1 from pg_roles where rolname in ('app_anon','app_authenticated','app_login')
    and (rolsuper or rolbypassrls or rolcreaterole or rolcreatedb or rolreplication)) then
    raise exception 'Unsafe application role configuration';
  end if;
end;
$$;
grant app_anon, app_authenticated to app_login;
revoke create on schema public from public;
grant usage on schema public, auth, private to app_anon, app_authenticated;
revoke all on function auth.uid() from public;
grant execute on function auth.uid() to app_anon, app_authenticated;
revoke all on all tables in schema public from public, app_login, app_anon, app_authenticated;

-- FORCE RLS requires an explicit policy for the trusted migration owner too.
-- That owner is never a runtime role and is not granted to app_login.
do $$
declare t record;
begin
  for t in select n.nspname, c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname in ('public','private') and c.relkind in ('r','p') loop
    execute format('alter table %I.%I enable row level security',t.nspname,t.relname);
    execute format('alter table %I.%I force row level security',t.nspname,t.relname);
    execute format('drop policy if exists migration_owner on %I.%I',t.nspname,t.relname);
    execute format('create policy migration_owner on %I.%I to %I using(true) with check(true)',t.nspname,t.relname,current_user);
  end loop;
end;
$$;
create or replace function private.is_reviewer() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.reviewers where user_id = auth.uid());
$$;
create or replace function private.guard_review() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not private.is_reviewer() then raise exception 'Reviewer access required' using errcode = '42501'; end if;
  if TG_OP = 'UPDATE' and new.report_id <> old.report_id then raise exception 'Report identity is immutable'; end if;
  if new.state = 'approved' and (
    not new.assumptions_acknowledged or
    exists(select 1 from public.reports where id = new.report_id and value = 'absent' and not new.absence_comparable)
  ) then raise exception 'Approval requires acknowledged assumptions and comparable absence'; end if;
  -- Retries of an identical decision are no-ops, including audit history.
  if TG_OP = 'UPDATE' and (new.state,new.assumptions_acknowledged,new.absence_comparable)
    is not distinct from (old.state,old.assumptions_acknowledged,old.absence_comparable) then return null; end if;
  new.reviewer_id := auth.uid();
  new.revision := case when TG_OP = 'INSERT' then 1 else old.revision + 1 end;
  new.updated_at := clock_timestamp();
  return new;
end;
$$;
create or replace function private.audit_review() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.review_events values(new.report_id,new.revision,new.state,new.assumptions_acknowledged,new.absence_comparable,new.reviewer_id,new.updated_at);
  return new;
end;
$$;
revoke all on function private.is_reviewer() from public, app_anon, app_login;
grant execute on function private.is_reviewer() to app_authenticated;
revoke all on function private.guard_review(), private.audit_review() from public, app_anon, app_authenticated, app_login;
drop trigger if exists guard_review on public.review_decisions;
drop trigger if exists audit_review on public.review_decisions;
create trigger guard_review before insert or update on public.review_decisions for each row execute function private.guard_review();
create trigger audit_review after insert or update on public.review_decisions for each row execute function private.audit_review();
grant select on public.reviewers to app_authenticated;
drop policy if exists read_cases on public.cases;
drop policy if exists read_sites on public.sites;
drop policy if exists read_reports on public.reports;
drop policy if exists submit_reports on public.reports;
drop policy if exists read_decisions on public.review_decisions;
drop policy if exists create_decisions on public.review_decisions;
drop policy if exists change_decisions on public.review_decisions;
drop policy if exists read_events on public.review_events;
grant select on public.cases, public.sites to app_anon, app_authenticated;
grant select on public.reports, public.review_decisions, public.review_events to app_authenticated;
grant insert(id,case_id,signal,site_code,value,confirmed,origin,observed_at,notes,review_state) on public.reports to app_anon, app_authenticated;
grant insert(report_id,state,assumptions_acknowledged,absence_comparable), update(state,assumptions_acknowledged,absence_comparable)
  on public.review_decisions to app_authenticated;
create policy read_cases on public.cases for select to app_anon, app_authenticated using(true);
create policy read_sites on public.sites for select to app_anon, app_authenticated using(true);
create policy read_reports on public.reports for select to app_authenticated using((select private.is_reviewer()));
create policy submit_reports on public.reports for insert to app_anon, app_authenticated with check(confirmed = true and review_state = 'unreviewed' and length(notes) <= 500);
create policy read_decisions on public.review_decisions for select to app_authenticated using((select private.is_reviewer()));
create policy create_decisions on public.review_decisions for insert to app_authenticated
  with check((select private.is_reviewer()) and reviewer_id = (select auth.uid()));
create policy change_decisions on public.review_decisions for update to app_authenticated
  using((select private.is_reviewer())) with check((select private.is_reviewer()) and reviewer_id = (select auth.uid()));
create policy read_events on public.review_events for select to app_authenticated using((select private.is_reviewer()));

drop policy if exists own_membership on public.reviewers;
create policy own_membership on public.reviewers for select to app_authenticated using(user_id=(select auth.uid()));
grant select on public.networks to app_anon, app_authenticated;
drop policy if exists read_networks on public.networks;
create policy read_networks on public.networks for select to app_anon, app_authenticated using(true);
create or replace function private.login_user(p_email text)
returns table(id uuid, password_hash text)
language sql stable security definer set search_path = '' as $$
  select u.id, u.password_hash from public.users u where u.email=p_email;
$$;
revoke all on function private.login_user(text) from public, app_login, app_authenticated;
grant execute on function private.login_user(text) to app_anon;
create or replace view public.public_reports with (security_barrier = true, security_invoker = false) as
  select r.id, r.case_id, r.site_code as site_id, r.signal, r.value, r.observed_at as observed_on
  from public.reports r
  join public.review_decisions d on d.report_id = r.id
  where d.state = 'approved';
revoke all on public.public_reports from public, app_anon, app_authenticated;
grant select on public.public_reports to app_anon, app_authenticated;

-- Atomic upsert serializes concurrent decisions on the report primary key.
create or replace function public.review_report(p_report_id uuid, p_state text, p_assumptions boolean, p_comparable boolean)
returns void language sql security invoker set search_path = '' as $$
  insert into public.review_decisions(report_id,state,assumptions_acknowledged,absence_comparable)
  values(p_report_id,p_state,p_assumptions,p_comparable)
  on conflict(report_id) do update set state=excluded.state,
    assumptions_acknowledged=excluded.assumptions_acknowledged,
    absence_comparable=excluded.absence_comparable;
$$;
revoke all on function public.review_report(uuid,text,boolean,boolean) from public, app_anon;
grant execute on function public.review_report(uuid,text,boolean,boolean) to app_authenticated;
