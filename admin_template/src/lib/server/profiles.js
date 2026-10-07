/** @typedef {'user' | 'admin'} ProfileRole */

/**
 * @typedef {Object} ProfileRow
 * @property {string} id
 * @property {string} email
 * @property {string | null} [display_name]
 * @property {string | null} [phone_number]
 * @property {ProfileRole} role
 * @property {string} created_at
 * @property {string | null} [onboarding_completed_at]
 */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
export async function readProfileRole(supabase, userId) {
	const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle();

	if (error) {
		return { role: /** @type {ProfileRole | null} */ (null), error: error.message };
	}

	const role = data?.role;
	if (role === 'admin' || role === 'user') {
		return { role, error: null };
	}

	return { role: 'user', error: null };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function listProfilesForAdmin(supabase) {
	const columns =
		'id, email, display_name, phone_number, role, created_at, onboarding_completed_at';

	let { data, error } = await supabase.from('profiles').select(columns).order('created_at', {
		ascending: false
	});

	// 005(온보딩 컬럼) 미적용 DB — 최소 컬럼만 조회
	if (error && /display_name|phone_number|onboarding_completed_at/i.test(error.message || '')) {
		({ data, error } = await supabase
			.from('profiles')
			.select('id, email, role, created_at')
			.order('created_at', { ascending: false }));
	}

	if (error) {
		return { profiles: /** @type {ProfileRow[]} */ ([]), error: error.message };
	}

	return { profiles: /** @type {ProfileRow[]} */ (data ?? []), error: null };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} targetUserId
 * @param {ProfileRole} newRole
 */
export async function setProfileRole(supabase, targetUserId, newRole) {
	const { error } = await supabase.rpc('admin_set_profile_role', {
		target_user_id: targetUserId,
		new_role: newRole
	});

	if (error) {
		return { ok: false, error: translateRoleUpdateError(error.message) };
	}

	return { ok: true, error: null };
}

/** @param {string} message */
function translateRoleUpdateError(message) {
	const text = message || '';
	if (/not authorized/i.test(text)) {
		return '관리자만 권한을 변경할 수 있습니다.';
	}
	if (/cannot change own role/i.test(text)) {
		return '본인 권한은 이 화면에서 바꿀 수 없습니다.';
	}
	if (/invalid role/i.test(text)) {
		return '올바르지 않은 권한 값입니다.';
	}
	if (/admin_set_profile_role/i.test(text) || /function.*does not exist/i.test(text)) {
		return '권한 변경 기능이 DB에 아직 없습니다. 010_admin_set_profile_role.sql을 Supabase에서 실행해 주세요.';
	}
	return '권한을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.';
}
