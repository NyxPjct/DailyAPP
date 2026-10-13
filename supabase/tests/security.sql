\set ON_ERROR_STOP on
begin;
create temporary table sample_document (document jsonb);
insert into sample_document values ('{"schemaVersion":1,"name":"Ana","demo":false,"demoBudgetMonth":null,"tasks":[{"id":"task-1","title":"Consulta","notes":"","date":"2026-10-13","time":"10:00","category":"Saúde","priority":"Alta","completed":false}],"transactions":[{"id":"entry-1","description":"Mercado","notes":"","date":"2026-10-13","amountCents":12590,"type":"expense","category":"Alimentação","paid":true}],"budgets":{"2026-10":300000}}');
grant select on sample_document to authenticated;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
do $$ declare doc jsonb; result bigint; begin
  select document into doc from sample_document;
  select revision into result from public.save_dailyapp_workspace(doc,0,auth.uid());
  assert result = 1, 'first write must use revision 1';
  assert (select count(*) from public.dailyapp_workspaces) = 1, 'owner can read workspace';
  select revision into result from public.save_dailyapp_workspace(doc || '{"name":"Ana atualizada"}',1,auth.uid());
  assert result = 2, 'update increments revision';
  assert (select count(*) from public.save_dailyapp_workspace(doc,1,auth.uid())) = 0, 'stale update must not write';
  assert (select document->>'name' from public.dailyapp_workspaces) = 'Ana atualizada', 'conflict preserves server document';
  assert (select count(*) from public.save_dailyapp_workspace(doc,0,auth.uid())) = 0, 'repeated initial insert must not overwrite';
  begin
    update public.dailyapp_workspaces set document=doc;
    raise exception 'direct update must be denied';
  exception when insufficient_privilege then null; end;
  begin
    perform * from public.save_dailyapp_workspace(doc || '{"tasks":[{"id":"bad"}]}',2,auth.uid());
    raise exception 'malformed tasks must be rejected';
  exception when invalid_parameter_value then null; end;
  begin
    perform * from public.save_dailyapp_workspace(jsonb_set(doc,'{transactions,0,amountCents}','-1'),2,auth.uid());
    raise exception 'negative amount must be rejected';
  exception when invalid_parameter_value then null; end;
  begin
    perform * from public.save_dailyapp_workspace(jsonb_set(doc,'{transactions,0,id}','"task-1"'),2,auth.uid());
    raise exception 'duplicate ID across collections must be rejected';
  exception when invalid_parameter_value then null; end;
  begin
    perform * from public.save_dailyapp_workspace(jsonb_set(doc,'{tasks,0,date}','"2026-02-30"'),2,auth.uid());
    raise exception 'nonexistent date must be rejected';
  exception when invalid_parameter_value then null; end;
  begin
    perform * from public.save_dailyapp_workspace(doc || '{"budgets":{"2026-13":10000}}',2,auth.uid());
    raise exception 'invalid month must be rejected';
  exception when invalid_parameter_value then null; end;
  raise notice 'PASS: owner access, CAS, duplicate insert, direct-write denial and document validation';
end $$;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
do $$ declare doc jsonb; begin
  select document into doc from sample_document;
  assert (select count(*) from public.dailyapp_workspaces) = 0, 'second user cannot read first user data';
  assert (select count(*) from public.save_dailyapp_workspace(doc,2,auth.uid())) = 0, 'second user cannot modify first user row';
  assert (select count(*) from public.save_dailyapp_workspace(doc || '{"name":"Bruno"}',0,auth.uid())) = 1, 'second user creates own row';
  assert (select count(*) from public.dailyapp_workspaces) = 1, 'second user only sees own row';
  assert (select document->>'name' from public.dailyapp_workspaces) = 'Bruno', 'second user has distinct data';
  begin
    perform * from public.save_dailyapp_workspace(doc,1,'00000000-0000-0000-0000-000000000001');
    raise exception 'request from a previous account must be rejected';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS: isolation between two authenticated users and account-switch guard';
end $$;
set local request.jwt.claim.sub = '';
do $$ begin
  assert (select count(*) from public.dailyapp_workspaces) = 0, 'no identity must not read data';
  begin
    perform * from public.save_dailyapp_workspace((select document from sample_document),0,auth.uid());
    raise exception 'no identity must not write';
  exception when insufficient_privilege then null; end;
  raise notice 'PASS: missing identity cannot read or write';
end $$;
reset role;
do $$ begin
  assert not has_table_privilege('anon','public.dailyapp_workspaces','SELECT'), 'anonymous reads denied';
  assert not has_function_privilege('anon','public.save_dailyapp_workspace(jsonb,bigint,uuid)','EXECUTE'), 'anonymous writes denied';
  raise notice 'PASS: anonymous table and RPC access denied';
end $$;
rollback;
