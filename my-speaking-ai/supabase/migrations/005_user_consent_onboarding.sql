-- 개인정보·서비스 이용 동의 및 최초 로그인 온보딩 (이름·전화번호)
-- (001 적용 후 SQL Editor에서 실행)

-- ============================================================
-- 1) profiles — 표시 이름·연락처·온보딩 완료 시각
-- ============================================================
alter table public.profiles
  add column if not exists display_name text,
  add column if not exists phone_number text,
  add column if not exists onboarding_completed_at timestamptz;

comment on column public.profiles.display_name is '사용자 실명 또는 표시 이름';
comment on column public.profiles.phone_number is '연락처 (숫자만 저장 권장)';
comment on column public.profiles.onboarding_completed_at is '약관 동의·프로필 입력 완료 시각';

-- ============================================================
-- 2) legal_policies — 동의 대상 정책 문서 버전
-- ============================================================
create table if not exists public.legal_policies (
  id uuid primary key default gen_random_uuid(),
  policy_type text not null check (policy_type in ('privacy', 'terms_of_service')),
  version text not null,
  title text not null,
  content text not null default '',
  effective_at timestamptz not null default now(),
  is_current boolean not null default false,
  created_at timestamptz not null default now(),
  constraint legal_policies_type_version unique (policy_type, version)
);

create unique index if not exists legal_policies_one_current_per_type
  on public.legal_policies (policy_type)
  where is_current;

comment on table public.legal_policies is '개인정보 처리방침·이용약관 등 동의 문서 버전';

-- ============================================================
-- 3) user_consents — 사용자별 정책 동의 이력
-- ============================================================
create table if not exists public.user_consents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  policy_id uuid not null references public.legal_policies (id) on delete restrict,
  agreed_at timestamptz not null default now(),
  constraint user_consents_user_policy unique (user_id, policy_id)
);

create index if not exists user_consents_user_agreed_idx
  on public.user_consents (user_id, agreed_at desc);

comment on table public.user_consents is '사용자가 동의한 정책 문서(버전) 기록';

-- ============================================================
-- 4) 초기 정책 (현행 1.0)
-- ============================================================
insert into public.legal_policies (policy_type, version, title, content, is_current)
values
  (
    'privacy',
    '1.0',
    '개인정보 처리방침',
    E'1. 수집 항목\n- 필수: 이메일, 이름, 휴대전화번호, 서비스 이용 기록(회화 저장 데이터 등)\n\n2. 이용 목적\n- 회원 식별 및 AI 영어 회화 서비스 제공\n- 고객 문의 대응 및 서비스 개선\n\n3. 보유 기간\n- 회원 탈퇴 시까지. 단, 관련 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.\n\n4. 제3자 제공\n- 원칙적으로 이용자의 개인정보를 외부에 제공하지 않습니다. AI 음성·텍스트 처리를 위해 클라우드 API(OpenAI 등)를 이용할 수 있으며, 이 경우 서비스 제공에 필요한 최소 범위만 전송합니다.\n\n5. 이용자 권리\n- 개인정보 열람·정정·삭제·처리 정지를 요청할 수 있습니다. 문의: 서비스 내 고객센터 또는 가입 이메일로 연락해 주세요.\n\n본 방침은 2025년 10월 1일부터 적용됩니다.',
    true
  ),
  (
    'terms_of_service',
    '1.0',
    '서비스 이용약관',
    E'제1조 (목적)\n본 약관은 실시간 AI 영어 회화 서비스(이하 "서비스") 이용과 관련하여 회사와 이용자 간 권리·의무를 규정합니다.\n\n제2조 (회원가입)\n- 이용자는 정확한 정보를 제공해야 하며, 타인의 정보를 도용해서는 안 됩니다.\n\n제3조 (서비스 이용)\n- AI 생성 응답은 학습 보조 목적이며, 전문적인 법률·의료·투자 조언으로 간주되지 않습니다.\n- 서비스를 역공학·과도한 자동 호출 등으로 방해하는 행위를 금합니다.\n\n제4조 (콘텐츠)\n- 이용자가 저장한 회화 기록의 권리는 이용자에게 있습니다. 서비스 운영·품질 개선을 위해 익명화된 형태로 통계에 활용될 수 있습니다.\n\n제5조 (면책)\n- 천재지변, API 장애 등 불가항력으로 인한 서비스 중단에 대해 고의 또는 중과실이 없는 한 책임을 제한합니다.\n\n제6조 (약관 변경)\n- 약관이 변경되는 경우 시행일 7일 전 공지하며, 변경 후에도 서비스를 계속 이용하면 동의한 것으로 봅니다.\n\n본 약관은 2025년 10월 1일부터 적용됩니다.',
    true
  )
on conflict (policy_type, version) do nothing;

-- ============================================================
-- 5) RLS
-- ============================================================
alter table public.legal_policies enable row level security;
alter table public.user_consents enable row level security;

create policy "legal_policies: select public"
  on public.legal_policies for select
  using (true);

create policy "user_consents: select own"
  on public.user_consents for select
  using (auth.uid() = user_id);

create policy "user_consents: insert own"
  on public.user_consents for insert
  with check (auth.uid() = user_id);
