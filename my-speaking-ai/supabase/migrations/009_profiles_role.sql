alter table public.profiles
  add column if not exists role text not null default 'user';

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check check (role in ('user', 'admin'));

-- RLS에서 profiles를 다시 조회하면 재귀가 날 수 있어 security definer로만 판별합니다.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

drop policy if exists "profiles: select admin" on public.profiles;

create policy "profiles: select admin"
  on public.profiles for select
  using (public.is_admin());
