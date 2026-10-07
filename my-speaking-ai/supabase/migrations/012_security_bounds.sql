-- 비용·권한·저장 한도 (011 적용 후 SQL Editor에서 실행)
-- 1) 음성 세션 토큰은 계정당 1시간 20회, 하루 60회
-- 2) 본인 행이라도 메시지·요금·프로필 민감 컬럼은 한도를 넘기거나 직접 바꾸지 못함
-- 3) 관리자는 사용량만 조회하고, 다른 사용자의 회화 본문은 읽지 못함

-- ============================================================
-- 1) 실시간 토큰 발급 횟수
-- ============================================================
create table if not exists public.realtime_token_grants (
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index if not exists realtime_token_grants_user_created_idx
  on public.realtime_token_grants (user_id, created_at desc);

alter table public.realtime_token_grants enable row level security;

comment on table public.realtime_token_grants is '계정당 음성 세션 토큰 발급 시각. 앱은 security definer 함수로만 기록합니다.';

create or replace function public.consume_realtime_token_grant()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  hour_count integer;
  day_count integer;
  oldest_hour timestamptz;
  oldest_day timestamptz;
  retry_seconds integer;
begin
  if uid is null then
    return jsonb_build_object('allowed', false, 'reason', 'unauthenticated');
  end if;

  if not exists (select 1 from public.profiles where id = uid) then
    return jsonb_build_object('allowed', false, 'reason', 'profile_missing');
  end if;

  select count(*) into hour_count
  from public.realtime_token_grants
  where user_id = uid and created_at > now() - interval '1 hour';

  select count(*) into day_count
  from public.realtime_token_grants
  where user_id = uid and created_at > now() - interval '1 day';

  if hour_count >= 20 or day_count >= 60 then
    select min(created_at) into oldest_hour
    from public.realtime_token_grants
    where user_id = uid and created_at > now() - interval '1 hour';

    select min(created_at) into oldest_day
    from public.realtime_token_grants
    where user_id = uid and created_at > now() - interval '1 day';

    retry_seconds := 60;
    if hour_count >= 20 and oldest_hour is not null then
      retry_seconds := greatest(1, ceil(extract(epoch from (oldest_hour + interval '1 hour' - now())))::integer);
    end if;
    if day_count >= 60 and oldest_day is not null then
      retry_seconds := greatest(
        retry_seconds,
        ceil(extract(epoch from (oldest_day + interval '1 day' - now())))::integer
      );
    end if;

    return jsonb_build_object(
      'allowed', false,
      'reason', 'rate_limit',
      'retry_after_seconds', retry_seconds
    );
  end if;

  insert into public.realtime_token_grants (user_id) values (uid);

  delete from public.realtime_token_grants
  where user_id = uid and created_at < now() - interval '2 days';

  return jsonb_build_object('allowed', true);
end;
$$;

revoke all on function public.consume_realtime_token_grant() from public, anon;
grant execute on function public.consume_realtime_token_grant() to authenticated;

-- ============================================================
-- 2) 프로필: 권한·이메일·온보딩 완료 시각은 클라이언트 업데이트로 바꾸지 않음
-- ============================================================
create or replace function public.profiles_preserve_role_for_non_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.display_name is not null and (
    char_length(btrim(new.display_name)) < 2 or char_length(new.display_name) > 40
  ) then
    raise exception 'invalid display name';
  end if;

  if new.phone_number is not null and new.phone_number !~ '^0[0-9]{9,10}$' then
    raise exception 'invalid phone';
  end if;

  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.role := 'user';
      new.onboarding_completed_at := null;
    end if;
    return new;
  end if;

  if not public.is_admin() then
    new.role := old.role;
    new.email := old.email;
    if current_setting('app.allow_onboarding', true) is distinct from '1' then
      new.onboarding_completed_at := old.onboarding_completed_at;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_lock_sensitive_on_insert on public.profiles;

create trigger profiles_lock_sensitive_on_insert
  before insert on public.profiles
  for each row
  execute function public.profiles_preserve_role_for_non_admin();

create or replace function public.complete_onboarding(
  new_display_name text,
  new_phone_number text,
  privacy_policy_id uuid,
  terms_policy_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  cleaned_name text := btrim(new_display_name);
begin
  if uid is null then
    raise exception 'not authorized';
  end if;

  if cleaned_name is null or char_length(cleaned_name) < 2 or char_length(cleaned_name) > 40 then
    raise exception 'invalid display name';
  end if;

  if new_phone_number is null or new_phone_number !~ '^0[0-9]{9,10}$' then
    raise exception 'invalid phone';
  end if;

  if not exists (
    select 1 from public.legal_policies
    where id = privacy_policy_id and policy_type = 'privacy' and is_current
  ) then
    raise exception 'invalid privacy policy';
  end if;

  if not exists (
    select 1 from public.legal_policies
    where id = terms_policy_id and policy_type = 'terms_of_service' and is_current
  ) then
    raise exception 'invalid terms policy';
  end if;

  perform set_config('app.allow_onboarding', '1', true);

  update public.profiles
  set
    display_name = cleaned_name,
    phone_number = new_phone_number,
    onboarding_completed_at = now(),
    updated_at = now()
  where id = uid;

  if not found then
    raise exception 'profile missing';
  end if;

  insert into public.user_consents (user_id, policy_id, agreed_at)
  values
    (uid, privacy_policy_id, now()),
    (uid, terms_policy_id, now())
  on conflict (user_id, policy_id) do update
  set agreed_at = excluded.agreed_at;
end;
$$;

revoke all on function public.complete_onboarding(text, text, uuid, uuid) from public, anon;
grant execute on function public.complete_onboarding(text, text, uuid, uuid) to authenticated;

drop policy if exists "user_consents: insert own" on public.user_consents;

-- ============================================================
-- 3) 회화 기록·프롬프트 크기와 요금 숫자 한도
-- ============================================================
create or replace function public.conversation_records_enforce_bounds()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  message_item jsonb;
begin
  if char_length(new.level) > 40 or char_length(new.vad_preset) > 40 then
    raise exception 'invalid session settings';
  end if;

  if new.language_mode is not null and char_length(new.language_mode) > 20 then
    raise exception 'invalid language mode';
  end if;

  if new.custom_prompt_text is not null and char_length(new.custom_prompt_text) > 2000 then
    raise exception 'custom prompt too long';
  end if;

  if jsonb_typeof(new.messages) is distinct from 'array' then
    raise exception 'invalid message';
  end if;

  if jsonb_array_length(new.messages) > 500 or octet_length(new.messages::text) > 500000 then
    raise exception 'invalid message';
  end if;

  for message_item in select value from jsonb_array_elements(new.messages)
  loop
    if jsonb_typeof(message_item) is distinct from 'object'
      or coalesce(message_item->>'role', '') not in ('user', 'assistant', 'system')
      or message_item->>'text' is null
      or char_length(message_item->>'text') > 8000 then
      raise exception 'invalid message';
    end if;
  end loop;

  if new.usage is not null and octet_length(new.usage::text) > 16000 then
    raise exception 'invalid usage';
  end if;

  if new.usage_duration_ms is not null and (new.usage_duration_ms < 0 or new.usage_duration_ms > 86400000) then
    raise exception 'invalid usage';
  end if;
  if new.usage_response_count is not null and (new.usage_response_count < 0 or new.usage_response_count > 5000) then
    raise exception 'invalid usage';
  end if;
  if new.usage_input_text_tokens is not null and (new.usage_input_text_tokens < 0 or new.usage_input_text_tokens > 1000000) then
    raise exception 'invalid usage';
  end if;
  if new.usage_input_audio_tokens is not null and (new.usage_input_audio_tokens < 0 or new.usage_input_audio_tokens > 1000000) then
    raise exception 'invalid usage';
  end if;
  if new.usage_cached_text_tokens is not null and (new.usage_cached_text_tokens < 0 or new.usage_cached_text_tokens > 1000000) then
    raise exception 'invalid usage';
  end if;
  if new.usage_cached_audio_tokens is not null and (new.usage_cached_audio_tokens < 0 or new.usage_cached_audio_tokens > 1000000) then
    raise exception 'invalid usage';
  end if;
  if new.usage_output_text_tokens is not null and (new.usage_output_text_tokens < 0 or new.usage_output_text_tokens > 1000000) then
    raise exception 'invalid usage';
  end if;
  if new.usage_output_audio_tokens is not null and (new.usage_output_audio_tokens < 0 or new.usage_output_audio_tokens > 1000000) then
    raise exception 'invalid usage';
  end if;
  if new.usage_transcription_audio_tokens is not null and (
    new.usage_transcription_audio_tokens < 0 or new.usage_transcription_audio_tokens > 1000000
  ) then
    raise exception 'invalid usage';
  end if;
  if new.estimated_cost_usd is not null and (new.estimated_cost_usd < 0 or new.estimated_cost_usd > 80) then
    raise exception 'invalid usage';
  end if;
  if new.usd_krw_rate is not null and (new.usd_krw_rate < 0 or new.usd_krw_rate > 10000) then
    raise exception 'invalid usage';
  end if;
  if new.estimated_cost_krw is not null and (new.estimated_cost_krw < 0 or new.estimated_cost_krw > 800000) then
    raise exception 'invalid usage';
  end if;

  return new;
end;
$$;

drop trigger if exists conversation_records_enforce_bounds on public.conversation_records;

create trigger conversation_records_enforce_bounds
  before insert or update on public.conversation_records
  for each row
  execute function public.conversation_records_enforce_bounds();

create or replace function public.user_prompts_enforce_bounds()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  saved_count integer;
begin
  if char_length(new.content) > 2000 then
    raise exception 'prompt too long';
  end if;

  if new.title is not null and char_length(new.title) > 80 then
    raise exception 'prompt title too long';
  end if;

  if tg_op = 'INSERT' and new.prompt_kind = 'saved' then
    select count(*) into saved_count
    from public.user_prompts
    where user_id = new.user_id and prompt_kind = 'saved';

    if saved_count >= 30 then
      raise exception 'too many prompts';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists user_prompts_enforce_bounds on public.user_prompts;

create trigger user_prompts_enforce_bounds
  before insert or update on public.user_prompts
  for each row
  execute function public.user_prompts_enforce_bounds();

-- ============================================================
-- 4) 관리자 사용량 조회: 회화 본문(messages)은 반환하지 않음
-- ============================================================
create or replace function public.admin_list_conversation_usage(
  row_limit integer,
  row_offset integer,
  target_user_id uuid default null
)
returns table (
  id uuid,
  user_id uuid,
  saved_at timestamptz,
  usage jsonb,
  usage_duration_ms integer,
  usage_response_count integer,
  usage_input_text_tokens integer,
  usage_input_audio_tokens integer,
  usage_cached_text_tokens integer,
  usage_cached_audio_tokens integer,
  usage_output_text_tokens integer,
  usage_output_audio_tokens integer,
  usage_transcription_audio_tokens integer,
  estimated_cost_usd numeric,
  estimated_cost_krw numeric
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    return;
  end if;

  return query
  select
    records.id,
    records.user_id,
    records.saved_at,
    records.usage,
    records.usage_duration_ms,
    records.usage_response_count,
    records.usage_input_text_tokens,
    records.usage_input_audio_tokens,
    records.usage_cached_text_tokens,
    records.usage_cached_audio_tokens,
    records.usage_output_text_tokens,
    records.usage_output_audio_tokens,
    records.usage_transcription_audio_tokens,
    records.estimated_cost_usd,
    records.estimated_cost_krw
  from public.conversation_records as records
  where target_user_id is null or records.user_id = target_user_id
  order by records.saved_at desc
  limit least(greatest(coalesce(row_limit, 1), 1), 1000)
  offset least(greatest(coalesce(row_offset, 0), 0), 20000);
end;
$$;

revoke all on function public.admin_list_conversation_usage(integer, integer, uuid) from public, anon;
grant execute on function public.admin_list_conversation_usage(integer, integer, uuid) to authenticated;

drop view if exists public.conversation_usage_billing;

create view public.conversation_usage_billing
with (security_invoker = false, security_barrier = true) as
select
  id,
  user_id,
  saved_at,
  usage,
  usage_duration_ms,
  usage_response_count,
  usage_input_text_tokens,
  usage_input_audio_tokens,
  usage_cached_text_tokens,
  usage_cached_audio_tokens,
  usage_output_text_tokens,
  usage_output_audio_tokens,
  usage_transcription_audio_tokens,
  estimated_cost_usd,
  usd_krw_rate,
  estimated_cost_krw
from public.conversation_records
where public.is_admin();

comment on view public.conversation_usage_billing is
  '관리자 전용 사용량. 회화 본문은 포함하지 않습니다. is_admin()이 참일 때만 행이 보입니다.';

revoke all on public.conversation_usage_billing from public, anon;
grant select on public.conversation_usage_billing to authenticated;

drop policy if exists "conversation_records: select admin" on public.conversation_records;
