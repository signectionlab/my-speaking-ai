/** @param {string} pathname */
export function isOnboardingExemptPath(pathname) {
	if (pathname === '/onboarding' || pathname === '/logout') return true;
	if (pathname.startsWith('/auth/')) return true;
	if (pathname.startsWith('/legal/')) return true;
	return false;
}

/**
 * @param {string} raw
 * @returns {string | null} digits only, or null if invalid
 */
export function normalizePhoneNumber(raw) {
	const digits = String(raw ?? '').replace(/\D/g, '');
	if (digits.length < 10 || digits.length > 11) return null;
	if (!digits.startsWith('0')) return null;
	return digits;
}

/**
 * @param {string} digits
 * @returns {string}
 */
export function formatPhoneNumber(digits) {
	const value = String(digits ?? '').replace(/\D/g, '');
	if (value.length === 11) return `${value.slice(0, 3)}-${value.slice(3, 7)}-${value.slice(7)}`;
	if (value.length === 10) return `${value.slice(0, 3)}-${value.slice(3, 6)}-${value.slice(6)}`;
	return value;
}

/**
 * @param {string} displayName
 * @param {string} phone
 */
export function validateProfileFields(displayName, phone) {
	const name = displayName.trim();
	if (name.length < 2 || name.length > 40) {
		return '이름은 2자 이상 40자 이하로 입력해 주세요.';
	}
	if (!/^[\p{L}\p{N}\s·.-]+$/u.test(name)) {
		return '이름에는 문자, 숫자, 공백과 · . - 만 사용할 수 있습니다.';
	}
	if (!normalizePhoneNumber(phone)) {
		return '휴대전화번호를 올바르게 입력해 주세요. (예: 01012345678)';
	}
	return '';
}

/**
 * @param {string} displayName
 * @param {string} phone
 * @param {boolean} agreePrivacy
 * @param {boolean} agreeTerms
 */
export function validateOnboardingSubmission(displayName, phone, agreePrivacy, agreeTerms) {
	const profileError = validateProfileFields(displayName, phone);
	if (profileError) return profileError;
	if (!agreePrivacy) {
		return '개인정보 처리방침에 동의해 주세요.';
	}
	if (!agreeTerms) {
		return '서비스 이용약관에 동의해 주세요.';
	}
	return '';
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 * @param {string} userId
 */
export async function readOnboardingComplete(supabase, userId) {
	if (!supabase || !userId) return false;
	const { data, error } = await supabase
		.from('profiles')
		.select('onboarding_completed_at')
		.eq('id', userId)
		.maybeSingle();
	if (error) return false;
	return Boolean(data?.onboarding_completed_at);
}
