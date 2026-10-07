/** 로그인 화면과 로그아웃만 관리자 권한 없이 열 수 있습니다. */
export function isAdminOpenPath(pathname) {
	return pathname === '/' || pathname === '/logout';
}
