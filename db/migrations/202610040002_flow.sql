alter table public.cases add column title text;
update public.cases set title = initcap(replace(signal, '_', ' ')) || ' investigation';
alter table public.cases alter column title set not null;
alter table public.cases alter column title set default 'Stream investigation';
alter table public.cases add constraint case_title_length check(length(title) between 1 and 160);

-- General-inbox observations have no case and cannot become engine evidence.
alter table public.reports alter column case_id drop not null;
alter table public.reports alter column site_code drop not null;
alter table public.reports add constraint report_case_or_inbox check(
  (case_id is null and signal = 'other') or
  (case_id is not null and signal <> 'other' and site_code is not null)
);

create or replace function private.new_report_ref() returns text
language plpgsql volatile set search_path = '' as $$
declare alphabet constant text := '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; ref text := ''; n integer;
begin
  while length(ref) < 16 loop
    n := get_byte(decode(replace(gen_random_uuid()::text, '-', ''), 'hex'), 0);
    if n < 248 then ref := ref || substr(alphabet, n % 31 + 1, 1); end if;
  end loop;
  return ref;
end;
$$;
revoke all on function private.new_report_ref() from public;
alter table public.reports add column ref text not null default private.new_report_ref();
alter table public.reports add constraint unique_report_ref unique(ref);
alter table public.reports add constraint report_ref_format check(ref ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{16}$');
drop function public.report_status(uuid);
create function public.report_status(p_ref text) returns table(state text)
language sql stable security definer set search_path = '' as $$
  select coalesce(d.state, 'unreviewed') from public.reports r
  left join public.review_decisions d on d.report_id = r.id where r.ref = p_ref;
$$;
revoke all on function public.report_status(text) from public;

alter table public.review_decisions add column approval_reason text not null default '' check(length(approval_reason) <= 500);
alter table public.review_events add column approval_reason text not null default '' check(length(approval_reason) <= 500);
