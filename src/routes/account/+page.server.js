import { error, fail, redirect } from '@sveltejs/kit';
import { formatPhoneNumber, normalizePhoneNumber, validateProfileFields } from '$lib/server/onboarding.js';

/** @param {unknown} row */
function mapConsent(row) {
	if (!row || typeof row !== 'object') return null;
	const record = /** @type {{ agreed_at?: string, policy?: { id?: string, title?: string, version?: string, policy_type?: string, content?: string, effective_at?: string } | { id?: string, title?: string, version?: string, policy_type?: string, content?: string, effective_at?: string }[] | null }} */ (
		row
	);
	const policy = Array.isArray(record.policy) ? record.policy[0] : record.policy;
	if (!policy?.title) return null;
	return {
		id: policy.id ?? `${policy.policy_type ?? ''}-${policy.version ?? ''}`,
		title: policy.title,
		version: policy.version ?? '',
		policyType: policy.policy_type ?? '',
		content: policy.content ?? '',
		effectiveAt: policy.effective_at ?? '',
		agreedAt: record.agreed_at ?? ''
	};
}

const POLICY_ORDER = { privacy: 0, terms_of_service: 1 };

/** @param {{ policyType?: string }} consent */
function consentRank(consent) {
	return POLICY_ORDER[/** @type {keyof typeof POLICY_ORDER} */ (consent.policyType)] ?? 9;
}

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals }) {
	if (!locals.user) redirect(303, '/login?redirect=%2Faccount');
	if (!locals.supabase) error(503, 'Supabase 설정이 없습니다.');

	let { data: profile, error: profileError } = await locals.supabase
		.from('profiles')
		.select('display_name, phone_number, email, created_at, updated_at')
		.eq('id', locals.user.id)
		.maybeSingle();

	if (profileError && /updated_at/i.test(profileError.message || '')) {
		const fallback = await locals.supabase
			.from('profiles')
			.select('display_name, phone_number, email, created_at')
			.eq('id', locals.user.id)
			.maybeSingle();
		profile = fallback.data;
		profileError = fallback.error;
	}

	if (profileError) {
		error(503, '프로필을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
	}

	const { data: consentRows } = await locals.supabase
		.from('user_consents')
		.select('agreed_at, policy:legal_policies(id, title, version, policy_type, content, effective_at)')
		.eq('user_id', locals.user.id)
		.order('agreed_at', { ascending: false });

	const consents = (consentRows ?? [])
		.map(mapConsent)
		.filter(Boolean)
		.sort((a, b) => consentRank(a) - consentRank(b) || String(b.agreedAt).localeCompare(String(a.agreedAt)));

	return {
		email: locals.user.email || profile?.email || '',
		displayName: profile?.display_name ?? '',
		phoneNumber: formatPhoneNumber(profile?.phone_number ?? ''),
		createdAt: profile?.created_at ?? '',
		updatedAt: profile?.updated_at ?? profile?.created_at ?? '',
		consents
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	update: async ({ request, locals }) => {
		if (!locals.user || !locals.supabase) {
			return fail(503, { error: 'Supabase 설정이 없습니다.' });
		}

		const form = await request.formData();
		const displayName = String(form.get('displayName') ?? '');
		const phone = String(form.get('phone') ?? '');
		const validationError = validateProfileFields(displayName, phone);
		if (validationError) {
			return fail(400, { displayName, phone, error: validationError });
		}

		const phoneNumber = normalizePhoneNumber(phone);
		if (!phoneNumber) {
			return fail(400, { displayName, phone, error: '휴대전화번호를 올바르게 입력해 주세요.' });
		}

		const trimmedName = displayName.trim();
		const updatedAt = new Date().toISOString();
		const { data: saved, error: profileError } = await locals.supabase
			.from('profiles')
			.update({
				display_name: trimmedName,
				phone_number: phoneNumber,
				updated_at: updatedAt
			})
			.eq('id', locals.user.id)
			.select('display_name, phone_number, updated_at')
			.maybeSingle();

		if (profileError && /updated_at/i.test(profileError.message || '')) {
			const retry = await locals.supabase
				.from('profiles')
				.update({
					display_name: trimmedName,
					phone_number: phoneNumber
				})
				.eq('id', locals.user.id)
				.select('display_name, phone_number')
				.maybeSingle();
			if (!retry.error && retry.data) {
				return {
					displayName: trimmedName,
					phone: formatPhoneNumber(phoneNumber),
					success: '내 정보를 저장했습니다.'
				};
			}
		}

		if (profileError || !saved) {
			return fail(500, {
				displayName,
				phone,
				error: '프로필 저장에 실패했습니다. 다시 시도해 주세요.'
			});
		}

		return {
			displayName: trimmedName,
			phone: formatPhoneNumber(phoneNumber),
			success: '내 정보를 저장했습니다.'
		};
	}
};
