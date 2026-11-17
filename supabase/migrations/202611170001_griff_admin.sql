-- Apply to the dedicated Griff Casual project. No customer or credential data belongs in this file.
create table if not exists public.griff_state (
  id integer primary key check (id = 1),
  version bigint not null default 0 check (version >= 0),
  data jsonb not null,
  updated_at timestamptz not null default now()
);
create table if not exists public.griff_admin_emails (
  email text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);
alter table public.griff_state enable row level security;
alter table public.griff_admin_emails enable row level security;
revoke all on public.griff_state, public.griff_admin_emails from anon, authenticated;
grant all on public.griff_state, public.griff_admin_emails to service_role;

-- Atomic compare-and-swap: order creation, stock changes and audit history commit together.
create or replace function public.griff_compare_and_swap(p_expected_version bigint, p_next_state jsonb)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare result jsonb;
begin
  if p_next_state->>'schema' <> '1' or octet_length(p_next_state::text) > 8000000 then
    raise exception 'Invalid or oversized application state';
  end if;
  update public.griff_state set data = p_next_state, version = version + 1, updated_at = now()
  where id = 1 and version = p_expected_version
  returning jsonb_build_object('version', version, 'state', data) into result;
  if result is null then raise exception using errcode = '40001', message = 'Concurrent change. Refresh and retry.'; end if;
  return result;
end;
$$;
revoke all on function public.griff_compare_and_swap(bigint, jsonb) from public, anon, authenticated;
grant execute on function public.griff_compare_and_swap(bigint, jsonb) to service_role;

-- Only product photographs are public. Database records and upload permissions remain private.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('griff-products', 'griff-products', true, 1500000, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;
