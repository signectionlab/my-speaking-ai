-- 관리자가 conversation_records(및 usage 뷰)를 조회 (009 is_admin 적용 후)
-- admin-template은 publishable 키 + 관리자 로그인만으로 사용량을 읽을 수 있습니다.

drop policy if exists "conversation_records: select admin" on public.conversation_records;

create policy "conversation_records: select admin"
  on public.conversation_records for select
  using (public.is_admin());
