begin;

create or replace function public.dailyapp_valid_date(value text)
returns boolean language plpgsql immutable set search_path = '' as $$
begin
  if value !~ '^\d{4}-\d{2}-\d{2}$' then return false; end if;
  return value::date between date '1900-01-01' and date '2200-12-31'
    and to_char(value::date, 'YYYY-MM-DD') = value;
exception when others then return false;
end;
$$;

create or replace function public.dailyapp_valid_document(doc jsonb)
returns boolean language plpgsql immutable set search_path = '' as $$
declare item jsonb; key text; amount jsonb; total_ids bigint; distinct_ids bigint;
begin
  if (jsonb_typeof(doc) = 'object' and jsonb_typeof(doc->'schemaVersion') = 'number' and doc->>'schemaVersion' = '1'
      and jsonb_typeof(doc->'name') = 'string' and char_length(doc->>'name') <= 60
      and jsonb_typeof(doc->'demo') = 'boolean'
      and jsonb_typeof(doc->'tasks') = 'array'
      and jsonb_typeof(doc->'transactions') = 'array'
      and jsonb_typeof(doc->'budgets') = 'object') is not true then return false; end if;
  if octet_length(doc::text) > 5000000 or jsonb_array_length(doc->'tasks') > 5000
    or jsonb_array_length(doc->'transactions') > 10000 then return false; end if;
  if doc->>'demoBudgetMonth' is not null and not public.dailyapp_valid_date((doc->>'demoBudgetMonth') || '-01') then return false; end if;
  for item in select value from jsonb_array_elements(doc->'tasks') loop
    if (jsonb_typeof(item) = 'object'
      and jsonb_typeof(item->'id') = 'string' and char_length(item->>'id') between 1 and 100
      and jsonb_typeof(item->'title') = 'string' and char_length(btrim(item->>'title')) between 1 and 120
      and jsonb_typeof(item->'notes') = 'string' and char_length(item->>'notes') <= 1000
      and jsonb_typeof(item->'date') = 'string' and public.dailyapp_valid_date(item->>'date')
      and jsonb_typeof(item->'time') = 'string' and (item->>'time' = '' or item->>'time' ~ '^([01]\d|2[0-3]):[0-5]\d$')
      and item->>'category' in ('Pessoal','Trabalho','Saúde','Estudos')
      and item->>'priority' in ('Baixa','Média','Alta')
      and jsonb_typeof(item->'completed') = 'boolean') is not true then return false; end if;
  end loop;
  for item in select value from jsonb_array_elements(doc->'transactions') loop
    if (jsonb_typeof(item) = 'object'
      and jsonb_typeof(item->'id') = 'string' and char_length(item->>'id') between 1 and 100
      and jsonb_typeof(item->'description') = 'string' and char_length(btrim(item->>'description')) between 1 and 120
      and jsonb_typeof(item->'notes') = 'string' and char_length(item->>'notes') <= 1000
      and jsonb_typeof(item->'date') = 'string' and public.dailyapp_valid_date(item->>'date')
      and jsonb_typeof(item->'amountCents') = 'number' and item->>'amountCents' ~ '^\d+$'
      and jsonb_typeof(item->'paid') = 'boolean'
      and ((item->>'type' = 'income' and item->>'category' in ('Salário','Freelance','Investimentos','Outros'))
        or (item->>'type' = 'expense' and item->>'category' in ('Alimentação','Moradia','Transporte','Saúde','Lazer','Educação','Compras','Outros')))) is not true then return false; end if;
    if (item->>'amountCents')::numeric <= 0 or (item->>'amountCents')::numeric > 100000000000 then return false; end if;
  end loop;
  for key, amount in select * from jsonb_each(doc->'budgets') loop
    if not public.dailyapp_valid_date(key || '-01') or jsonb_typeof(amount) <> 'number'
      or amount::text !~ '^\d+$' then return false; end if;
    if amount::text::numeric <= 0 or amount::text::numeric > 100000000000 then return false; end if;
  end loop;
  select count(*), count(distinct id) into total_ids, distinct_ids from (
    select value->>'id' as id from jsonb_array_elements(doc->'tasks')
    union all select value->>'id' from jsonb_array_elements(doc->'transactions')
  ) ids;
  return total_ids = distinct_ids;
exception when others then return false;
end;
$$;

create table if not exists public.dailyapp_workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  document jsonb not null check (public.dailyapp_valid_document(document)),
  revision bigint not null default 1 check (revision between 1 and 9007199254740991),
  updated_at timestamptz not null default now()
);
alter table public.dailyapp_workspaces enable row level security;
drop policy if exists "Read own workspace" on public.dailyapp_workspaces;
create policy "Read own workspace" on public.dailyapp_workspaces
  for select to authenticated using ((select auth.uid()) = user_id);
revoke all on public.dailyapp_workspaces from public, anon, authenticated;
grant select on public.dailyapp_workspaces to authenticated;

-- User identity always comes from the verified JWT, never from a client argument.
-- Only this RPC writes documents; CAS prevents a stale device overwriting data.
drop function if exists public.save_dailyapp_workspace(jsonb,bigint);
create or replace function public.save_dailyapp_workspace(p_document jsonb, p_expected_revision bigint, p_owner_id uuid)
returns setof public.dailyapp_workspaces
language plpgsql security definer set search_path = '' as $$
declare owner_id uuid := auth.uid();
begin
  if owner_id is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  -- Guard against an in-flight request using a new session after an account switch.
  -- This argument never grants ownership: it must match the verified JWT identity.
  if p_owner_id is distinct from owner_id then raise exception 'Account changed' using errcode = '42501'; end if;
  if p_expected_revision is null or p_expected_revision < 0 or p_expected_revision >= 9007199254740991 then
    raise exception 'Invalid revision' using errcode = '22023'; end if;
  if not public.dailyapp_valid_document(p_document) then
    raise exception 'Invalid workspace document' using errcode = '22023'; end if;
  if p_expected_revision = 0 then
    return query insert into public.dailyapp_workspaces (user_id, document, revision)
      values (owner_id, p_document, 1) on conflict (user_id) do nothing returning *;
  else
    return query update public.dailyapp_workspaces set document = p_document,
      revision = p_expected_revision + 1, updated_at = now()
      where user_id = owner_id and revision = p_expected_revision returning *;
  end if;
end;
$$;
revoke all on function public.save_dailyapp_workspace(jsonb,bigint,uuid) from public, anon;
grant execute on function public.save_dailyapp_workspace(jsonb,bigint,uuid) to authenticated;
revoke all on function public.dailyapp_valid_document(jsonb) from public, anon;
revoke all on function public.dailyapp_valid_date(text) from public, anon;
commit;
