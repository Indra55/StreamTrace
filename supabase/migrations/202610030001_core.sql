begin;
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table public.reviewers (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.reviewers enable row level security;
-- No client role can add itself, even by changing user metadata.
revoke all on public.reviewers from anon, authenticated;
grant select on public.reviewers to authenticated;
create policy own_membership on public.reviewers for select to authenticated using (user_id = (select auth.uid()));

create function private.is_reviewer() returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists(select 1 from public.reviewers where user_id = auth.uid());
$$;
revoke all on function private.is_reviewer() from public, anon;
grant execute on function private.is_reviewer() to authenticated;

create table public.cases (
  id uuid primary key default gen_random_uuid(),
  signal text not null check (length(signal) between 1 and 80),
  assumptions text not null,
  unique(id, signal)
);
create table public.sites (
  code text primary key,
  reach_id text not null,
  accessible boolean not null default false
);
create table public.reports (
  id uuid primary key, -- client-generated idempotency key, reused on submission retry
  case_id uuid not null,
  signal text not null,
  site_code text not null references public.sites(code),
  value text not null check(value in ('present','absent','cannot_tell')),
  confirmed boolean not null check(confirmed),
  origin text not null check(origin in ('web','sms_simulator')),
  observed_at timestamptz not null,
  notes text not null default '' check(length(notes) <= 500),
  -- Submission state is immutable; authoritative review state lives in review_decisions.
  review_state text not null default 'unreviewed' check(review_state = 'unreviewed'),
  created_at timestamptz not null default now(),
  foreign key(case_id,signal) references public.cases(id,signal)
);
-- AI drafts have no write path into decisions. A confirmed observation is a new report.
create table public.review_decisions (
  report_id uuid primary key references public.reports(id),
  state text not null check(state in ('approved','rejected','uncertain','unreviewed')),
  assumptions_acknowledged boolean not null default false,
  absence_comparable boolean not null default false,
  reviewer_id uuid not null references auth.users(id),
  revision integer not null check(revision > 0),
  updated_at timestamptz not null,
  check(state <> 'approved' or assumptions_acknowledged)
);
create table public.review_events (
  report_id uuid not null references public.reports(id),
  revision integer not null,
  state text not null,
  assumptions_acknowledged boolean not null,
  absence_comparable boolean not null,
  reviewer_id uuid not null references auth.users(id),
  created_at timestamptz not null,
  primary key(report_id,revision)
);
create function private.guard_review() returns trigger
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
create function private.audit_review() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.review_events values(new.report_id,new.revision,new.state,new.assumptions_acknowledged,new.absence_comparable,new.reviewer_id,new.updated_at);
  return new;
end;
$$;
revoke all on function private.guard_review(), private.audit_review() from public, anon, authenticated;
create trigger guard_review before insert or update on public.review_decisions for each row execute function private.guard_review();
create trigger audit_review after insert or update on public.review_decisions for each row execute function private.audit_review();

alter table public.cases enable row level security;
alter table public.sites enable row level security;
alter table public.reports enable row level security;
alter table public.review_decisions enable row level security;
alter table public.review_events enable row level security;
revoke all on public.cases, public.sites, public.reports, public.review_decisions, public.review_events from public, anon, authenticated;
grant select on public.cases, public.sites to anon, authenticated;
grant select on public.reports, public.review_decisions, public.review_events to authenticated;
grant insert(id,case_id,signal,site_code,value,confirmed,origin,observed_at,notes,review_state) on public.reports to anon, authenticated;
grant insert(report_id,state,assumptions_acknowledged,absence_comparable), update(state,assumptions_acknowledged,absence_comparable)
  on public.review_decisions to authenticated;
create policy read_cases on public.cases for select to anon, authenticated using(true);
create policy read_sites on public.sites for select to anon, authenticated using(true);
create policy read_reports on public.reports for select to authenticated using((select private.is_reviewer()));
create policy submit_reports on public.reports for insert to anon, authenticated with check(confirmed = true and review_state = 'unreviewed' and length(notes) <= 500);
create policy read_decisions on public.review_decisions for select to authenticated using((select private.is_reviewer()));
create policy create_decisions on public.review_decisions for insert to authenticated
  with check((select private.is_reviewer()) and reviewer_id = (select auth.uid()));
create policy change_decisions on public.review_decisions for update to authenticated
  using((select private.is_reviewer())) with check((select private.is_reviewer()) and reviewer_id = (select auth.uid()));
create policy read_events on public.review_events for select to authenticated using((select private.is_reviewer()));

-- Deliberately owner-executed: publish only this projection without granting base-table access.
-- The trusted migration owner owns both the view and base tables. The barrier protects filtering.
-- Existing database names are aliased to the public API names without changing engine inputs.
create view public.public_reports with (security_barrier = true, security_invoker = false) as
  select r.id, r.case_id, r.site_code as site_id, r.signal, r.value, r.observed_at as observed_on
  from public.reports r
  join public.review_decisions d on d.report_id = r.id
  where d.state = 'approved';
revoke all on public.public_reports from public, anon, authenticated;
grant select on public.public_reports to anon, authenticated;

-- Atomic upsert serializes concurrent decisions on the report primary key.
create function public.review_report(p_report_id uuid, p_state text, p_assumptions boolean, p_comparable boolean)
returns void language sql security invoker set search_path = '' as $$
  insert into public.review_decisions(report_id,state,assumptions_acknowledged,absence_comparable)
  values(p_report_id,p_state,p_assumptions,p_comparable)
  on conflict(report_id) do update set state=excluded.state,
    assumptions_acknowledged=excluded.assumptions_acknowledged,
    absence_comparable=excluded.absence_comparable;
$$;
revoke all on function public.review_report(uuid,text,boolean,boolean) from public, anon;
grant execute on function public.review_report(uuid,text,boolean,boolean) to authenticated;
commit;
