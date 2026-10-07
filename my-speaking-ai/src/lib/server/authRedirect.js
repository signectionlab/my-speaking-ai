/** 가입 인증 메일이 돌아갈 수 있는 주소. 배포마다 바뀌는 vercel.app 주소는 넣지 않습니다. */
const ALLOWED_ORIGINS = [
	'http://localhost:5173',
	'http://127.0.0.1:5173',
	'https://myspeaking-ai.vercel.app',
	'https://myspeacking-ai.vercel.app',
	'https://my-speaking-ai-signectionlab-s-projects.vercel.app'
];

/**
 * @param {string | null | undefined} origin
 * @param {string | null | undefined} [extraOrigin]
 * @returns {string | null}
 */
export function resolveEmailRedirect(origin, extraOrigin) {
	const allowed = new Set(ALLOWED_ORIGINS);
	const extra = normalizeOrigin(extraOrigin);
	if (extra) allowed.add(extra);

	const normalized = normalizeOrigin(origin);
	if (!normalized || !allowed.has(normalized)) return null;
	return `${normalized}/auth/callback`;
}

/** @param {string | null | undefined} value */
function normalizeOrigin(value) {
	const trimmed = String(value ?? '').trim().replace(/\/$/, '');
	if (!trimmed) return '';
	try {
		const url = new URL(trimmed);
		if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) return '';
		return url.origin;
	} catch {
		return '';
	}
}
