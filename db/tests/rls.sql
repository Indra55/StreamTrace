begin;
insert into public.users(id,email,password_hash) values ('00000000-0000-0000-0000-000000000001','rls-reviewer@example.invalid','not-a-login-hash'),('00000000-0000-0000-0000-000000000002','rls-outsider@example.invalid','not-a-login-hash');
insert into public.reviewers values ('00000000-0000-0000-0000-000000000001');
insert into public.cases(id,signal,assumptions) values ('10000000-0000-0000-0000-000000000001','foam','One persistent origin and comparable observations');
insert into public.sites(code,reach_id,accessible) values ('012','reach-12',true);
create function pg_temp.denied(command text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when insufficient_privilege then return;
  end;
  raise exception 'Expected permission denial: %',command;
end;
$$;
create function pg_temp.invalid(command text) returns void language plpgsql as $$
begin
  begin execute command;
  exception when check_violation or raise_exception or insufficient_privilege then return;
  end;
  raise exception 'Expected validation failure: %',command;
end;
$$;
create function pg_temp.check_true(ok boolean, label text) returns void language plpgsql as $$
begin if ok is distinct from true then raise exception 'Failed: %',label; end if; end;
$$;
-- Audit every definer function supplied by this migration for an explicit search path.
select pg_temp.check_true(not exists(
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public','private') and p.prosecdef
    and not exists(select 1 from unnest(p.proconfig) c where c like 'search_path=%')
), 'all security definer functions have an explicit search_path');
select pg_temp.check_true((select array_agg(column_name::text order by ordinal_position)
  = array['id','case_id','site_id','signal','value','observed_on']
  from information_schema.columns where table_schema='public' and table_name='public_reports'),
  'public view exposes exactly the approved six columns');
set local role app_anon;
select pg_temp.denied('select * from public.reports');
select pg_temp.denied('select * from public.review_decisions');
select pg_temp.denied('select * from public.review_events');
select pg_temp.check_true((select count(*)=0 from public.public_reports),'anon can read initially empty public view');
-- No anonymous UPDATE or DELETE grants on any application table or the public view.
do $$
declare t text;
begin
  foreach t in array array['users','reviewers','networks','cases','sites','reports','review_decisions','review_events','public_reports'] loop
    perform pg_temp.check_true(not has_table_privilege(current_user, 'public.' || t, 'UPDATE')
      and not has_any_column_privilege(current_user, 'public.' || t, 'UPDATE')
      and not has_table_privilege(current_user, 'public.' || t, 'DELETE'), 'anon write grants absent: ' || t);
    if t <> 'public_reports' then
      perform pg_temp.denied(format('delete from public.%I',t));
      perform pg_temp.denied(format('update public.%I set %I = %I',t,
        case t when 'users' then 'id' when 'networks' then 'id' when 'reviewers' then 'user_id' when 'sites' then 'code'
          when 'review_decisions' then 'state' when 'review_events' then 'state' else 'id' end,
        case t when 'users' then 'id' when 'networks' then 'id' when 'reviewers' then 'user_id' when 'sites' then 'code'
          when 'review_decisions' then 'state' when 'review_events' then 'state' else 'id' end));
    end if;
  end loop;
end;
$$;
insert into public.reports(id,case_id,signal,site_code,value,confirmed,origin,observed_at)
 values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001','foam','012','absent',true,'web',now());
-- Explicit pre-approval and overlong notes are denied even with otherwise valid fields.
select pg_temp.invalid($q$insert into public.reports(id,case_id,signal,site_code,value,confirmed,origin,observed_at,review_state)
 values ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','foam','012','present',true,'web',now(),'approved')$q$);
select pg_temp.invalid($q$insert into public.reports(id,case_id,signal,site_code,value,confirmed,origin,observed_at,notes)
 values ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','foam','012','present',true,'web',now(),repeat('x',501))$q$);
insert into public.reports(id,case_id,signal,site_code,value,confirmed,origin,observed_at,notes,review_state)
 values ('20000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000001','foam','012','present',true,'web',now(),repeat('x',500),'unreviewed');
select pg_temp.check_true((select count(*)=0 from public.public_reports),'unreviewed submissions remain private');
-- Reviewer and revision fields exist only on decisions, where anon has no INSERT privilege.
select pg_temp.denied($q$insert into public.review_decisions(report_id,state,assumptions_acknowledged,absence_comparable,reviewer_id,revision,updated_at)
 values ('20000000-0000-0000-0000-000000000001','approved',true,true,'00000000-0000-0000-0000-000000000002',99,now())$q$);
select pg_temp.denied($q$insert into public.review_decisions(report_id,state,assumptions_acknowledged,absence_comparable) values ('20000000-0000-0000-0000-000000000001','approved',true,true)$q$);
select pg_temp.denied($q$insert into public.reviewers values ('00000000-0000-0000-0000-000000000002')$q$);
select pg_temp.denied($q$update public.reports set value='present'$q$);
select pg_temp.denied($q$delete from public.reports$q$);
select pg_temp.denied($q$select public.review_report('20000000-0000-0000-0000-000000000001','approved',true,true)$q$);
select pg_temp.denied($q$insert into public.review_events(report_id,revision,state,assumptions_acknowledged,absence_comparable,reviewer_id,created_at) values ('20000000-0000-0000-0000-000000000001',1,'approved',true,true,'00000000-0000-0000-0000-000000000002',now())$q$);
reset role;
set local role app_authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000002"}',true);
select pg_temp.denied($q$insert into public.review_decisions(report_id,state,assumptions_acknowledged,absence_comparable) values ('20000000-0000-0000-0000-000000000001','approved',true,true)$q$);
select pg_temp.denied($q$insert into public.reviewers values ('00000000-0000-0000-0000-000000000002')$q$);
select pg_temp.check_true((select count(*)=0 from public.reviewers),'nonreviewer cannot see other allowlist entries');
select pg_temp.check_true(not has_column_privilege(current_user,'public.review_decisions','reviewer_id','INSERT')
  and not has_column_privilege(current_user,'public.review_decisions','revision','INSERT'), 'clients cannot insert reviewer or revision fields');
select pg_temp.denied($q$select public.review_report('20000000-0000-0000-0000-000000000001','approved',true,true)$q$);
select pg_temp.check_true((select count(*)=0 from public.reports),'nonreviewer cannot read reports');
select pg_temp.check_true((select count(*)=0 from public.review_decisions),'nonreviewer cannot read decisions');
select pg_temp.check_true((select count(*)=0 from public.review_events),'nonreviewer cannot read events');
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001"}',true);
select pg_temp.invalid($q$insert into public.review_decisions(report_id,state,assumptions_acknowledged,absence_comparable) values ('20000000-0000-0000-0000-000000000001','approved',false,true)$q$);
select pg_temp.invalid($q$insert into public.review_decisions(report_id,state,assumptions_acknowledged,absence_comparable) values ('20000000-0000-0000-0000-000000000001','approved',true,false)$q$);
select public.review_report('20000000-0000-0000-0000-000000000001','approved',true,true);
select pg_temp.check_true((select revision=1 and reviewer_id=auth.uid() from public.review_decisions),'server assigns identity and revision');
select public.review_report('20000000-0000-0000-0000-000000000001','approved',true,true);
select pg_temp.check_true((select count(*)=1 from public.review_events),'identical approval is idempotent');
select pg_temp.check_true((select count(*)=2 from public.reports),'reviewer can read private reports');
reset role;
set local role app_anon;
select set_config('request.jwt.claims','{"sub":null}',true);
select pg_temp.denied('select * from public.reports');
select pg_temp.denied('select * from public.review_decisions');
select pg_temp.denied('select * from public.review_events');
select pg_temp.check_true((select count(*)=1 from public.public_reports),'only approved report is public');
select pg_temp.check_true((select id='20000000-0000-0000-0000-000000000001'::uuid
  and case_id='10000000-0000-0000-0000-000000000001'::uuid and site_id='012'
  and signal='foam' and value='absent' and observed_on is not null from public.public_reports), 'public projection values');
reset role;
set local role app_authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000002"}',true);
select pg_temp.check_true((select count(*)=0 from public.review_decisions),'nonreviewer cannot read existing decision');
select pg_temp.check_true((select count(*)=0 from public.review_events),'nonreviewer cannot read existing audit');
select pg_temp.denied($q$select public.review_report('20000000-0000-0000-0000-000000000001','rejected',true,true)$q$);
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001"}',true);
select pg_temp.denied($q$update public.review_decisions set revision=900$q$);
select pg_temp.denied($q$update public.review_decisions set reviewer_id='00000000-0000-0000-0000-000000000002'$q$);
select pg_temp.denied($q$update public.review_decisions set report_id='20000000-0000-0000-0000-000000000002'$q$);
select pg_temp.denied($q$delete from public.review_decisions$q$);
select pg_temp.denied($q$delete from public.review_events$q$);
select pg_temp.denied($q$update public.review_events set state='rejected'$q$);
update public.review_decisions set state='rejected';
select pg_temp.check_true((select revision=2 from public.review_decisions),'reversal creates revision');
select pg_temp.check_true((select count(*)=2 from public.review_events),'reversal preserves audit');
reset role;
set local role app_anon;
select set_config('request.jwt.claims','{"sub":null}',true);
select pg_temp.check_true((select count(*)=0 from public.public_reports),'rejected report disappears from public view');
reset role;
set local role app_authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000002"}',true);
with changed as (update public.review_decisions set state='approved' returning *) select pg_temp.check_true(count(*)=0,'nonreviewer update blocked by RLS') from changed;
reset role;
-- Even broad accidental SELECT/DML grants must not bypass the row policy.
grant select,insert,update,delete on public.review_decisions to app_anon;
set local role app_anon;
select pg_temp.check_true((select count(*)=0 from public.review_decisions),'RLS hides decisions despite accidental SELECT grant');
select set_config('request.jwt.claims','{"sub":null}',true);
select pg_temp.denied($q$insert into public.review_decisions(report_id,state,assumptions_acknowledged,absence_comparable) values ('20000000-0000-0000-0000-000000000001','approved',true,true)$q$);
with changed as (update public.review_decisions set state='approved' returning *) select pg_temp.check_true(count(*)=0,'anon update blocked by RLS') from changed;
with changed as (delete from public.review_decisions returning *) select pg_temp.check_true(count(*)=0,'anon delete blocked by RLS') from changed;
reset role;
delete from public.reviewers;
set local role app_authenticated;
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001"}',true);
with changed as (update public.review_decisions set state='approved' returning *) select pg_temp.check_true(count(*)=0,'revocation takes effect without new JWT') from changed;
select pg_temp.denied($q$insert into public.review_decisions(report_id,state,assumptions_acknowledged,absence_comparable) values ('20000000-0000-0000-0000-000000000001','approved',true,true)$q$);
reset role;
rollback;

