/**
 * @param {Record<string, string | undefined>} privateEnv
 * @param {Record<string, string | undefined>} [publicEnv]
 */
export function resolveSupabaseConfig(privateEnv, publicEnv = {}) {
	const url = firstValue(
		publicEnv.PUBLIC_SUPABASE_URL,
		privateEnv.SUPABASE_URL,
		privateEnv.SUPABASE_DB_URL,
		privateEnv.SUPABASE_DB_UR
	);
	const key = firstValue(
		publicEnv.PUBLIC_SUPABASE_PUBLISHABLE_KEY,
		publicEnv.PUBLIC_SUPABASE_ANON_KEY,
		privateEnv.SUPABASE_PUBLISHABLE_KEY,
		privateEnv.SUPABASE_ANON_KEY,
		privateEnv.SUPABASE_DB_PUBLIC_KEY
	);

	return { url, key, configured: Boolean(url && key) };
}

/**
 * @param {Array<string | undefined>} values
 */
function firstValue(...values) {
	for (const value of values) {
		const trimmed = value?.trim();
		if (trimmed) return trimmed;
	}
	return '';
}

/**
 * @param {string | null | undefined} value
 */
export function safeRedirectPath(value) {
	if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) {
		return '/';
	}
	return value;
}

/**
 * @param {string} email
 * @param {string} password
 */
export function validateLogin(email, password) {
	if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
		return '올바른 이메일 주소를 입력해 주세요.';
	}
	if (password.length < 6) {
		return '비밀번호는 6자 이상이어야 합니다.';
	}
	return '';
}

/**
 * @param {string} email
 * @param {string} password
 * @param {string} confirmPassword
 */
export function validateSignup(email, password, confirmPassword) {
	const loginError = validateLogin(email, password);
	if (loginError) return loginError;
	if (password !== confirmPassword) return '비밀번호가 서로 다릅니다.';
	return '';
}

/** @param {string} message */
export function translateAuthError(message) {
	const text = message || '';
	if (/invalid login credentials/i.test(text)) {
		return '이메일 또는 비밀번호가 올바르지 않습니다.';
	}
	if (/email not confirmed/i.test(text)) {
		return '이메일 인증이 필요합니다. 받은 편지함을 확인해 주세요.';
	}
	if (/already registered|already been registered|user already exists/i.test(text)) {
		return '이미 가입된 이메일입니다. 로그인해 주세요.';
	}
	if (/password should be at least|password is too short/i.test(text)) {
		return '비밀번호는 6자 이상이어야 합니다.';
	}
	if (/signups not allowed|signup is disabled/i.test(text)) {
		return '지금은 회원가입을 받을 수 없습니다.';
	}
	if (/unable to validate email address|invalid email/i.test(text)) {
		return '올바른 이메일 주소를 입력해 주세요.';
	}
	if (/rate limit|too many requests/i.test(text)) {
		return '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
	}
	return '인증에 실패했습니다. 입력 내용을 다시 확인해 주세요.';
}
