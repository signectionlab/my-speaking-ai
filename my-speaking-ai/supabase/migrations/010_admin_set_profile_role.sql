-- 관리자 대시보드에서 profiles.role 변경 (009 적용 후)

create or replace function public.profiles_preserve_role_for_non_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_preserve_role on public.profiles;

create trigger profiles_preserve_role
  before update on public.profiles
  for each row
  execute function public.profiles_preserve_role_for_non_admin();

create or replace function public.admin_set_profile_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized';
  end if;
  if new_role not in ('user', 'admin') then
    raise exception 'invalid role';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'cannot change own role';
  end if;
  update public.profiles
  set role = new_role
  where id = target_user_id;
end;
$$;

grant execute on function public.admin_set_profile_role(uuid, text) to authenticated;
