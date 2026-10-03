create schema if not exists private;
revoke all on schema private from public;
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  password_hash text not null,
  created_at timestamptz not null default now()
);
create table if not exists public.networks (
  id text primary key,
  label text not null,
  graph jsonb not null,
  simulated boolean not null default false
);
create table if not exists public.reviewers (
  user_id uuid primary key references public.users(id) on delete cascade
);
create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  signal text not null check (length(signal) between 1 and 80),
  assumptions text not null,
  network_id text references public.networks(id),
  simulated boolean not null default false,
  unique(id, signal)
);
create table if not exists public.sites (
  code text primary key,
  reach_id text not null,
  accessible boolean not null default false,
  network_id text references public.networks(id)
);
create table if not exists public.reports (
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
create table if not exists public.review_decisions (
  report_id uuid primary key references public.reports(id),
  state text not null check(state in ('approved','rejected','uncertain','unreviewed')),
  assumptions_acknowledged boolean not null default false,
  absence_comparable boolean not null default false,
  reviewer_id uuid not null references public.users(id),
  revision integer not null check(revision > 0),
  updated_at timestamptz not null,
  check(state <> 'approved' or assumptions_acknowledged)
);
create table if not exists public.review_events (
  report_id uuid not null references public.reports(id),
  revision integer not null,
  state text not null,
  assumptions_acknowledged boolean not null,
  absence_comparable boolean not null,
  reviewer_id uuid not null references public.users(id),
  created_at timestamptz not null,
  primary key(report_id,revision)
);
