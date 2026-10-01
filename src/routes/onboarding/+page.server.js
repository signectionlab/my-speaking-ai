import { error, fail, redirect } from '@sveltejs/kit';
import { fetchCurrentLegalPolicies } from '$lib/server/legalPolicies.js';
import {
	normalizePhoneNumber,
	readOnboardingComplete,
	validateOnboardingSubmission
} from '$lib/server/onboarding.js';
import { safeRedirectPath } from '$lib/server/supabaseConfig.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, url }) {
	if (!locals.user) redirect(303, '/login');
	if (!locals.supabase) error(503, 'Supabase 설정이 없습니다.');

	const complete = await readOnboardingComplete(locals.supabase, locals.user.id);
	const redirectTo = safeRedirectPath(url.searchParams.get('redirect'));
	if (complete) redirect(303, redirectTo);

	let policies;
	try {
		policies = await fetchCurrentLegalPolicies(locals.supabase);
	} catch {
		error(503, '약관 정보를 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
	}

	const privacy = policies.find((p) => p.policy_type === 'privacy');
	const terms = policies.find((p) => p.policy_type === 'terms_of_service');
	if (!privacy || !terms) {
		error(503, '필수 약관이 준비되지 않았습니다. 관리자에게 문의해 주세요.');
	}

	const { data: profile } = await locals.supabase
		.from('profiles')
		.select('display_name, phone_number')
		.eq('id', locals.user.id)
		.maybeSingle();

	return {
		email: locals.user.email,
		redirectTo,
		privacy,
		terms,
		displayName: profile?.display_name ?? '',
		phoneNumber: profile?.phone_number ?? ''
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	default: async ({ request, locals, url }) => {
		if (!locals.user || !locals.supabase) {
			return fail(503, { error: 'Supabase 설정이 없습니다.' });
		}

		const form = await request.formData();
		const displayName = String(form.get('displayName') ?? '');
		const phone = String(form.get('phone') ?? '');
		const agreePrivacy = form.get('agreePrivacy') === 'on';
		const agreeTerms = form.get('agreeTerms') === 'on';
		const redirectTo = safeRedirectPath(url.searchParams.get('redirect'));

		const validationError = validateOnboardingSubmission(
			displayName,
			phone,
			agreePrivacy,
			agreeTerms
		);
		if (validationError) {
			return fail(400, {
				displayName,
				phone,
				error: validationError,
				agreePrivacy,
				agreeTerms
			});
		}

		const phoneNumber = normalizePhoneNumber(phone);
		if (!phoneNumber) {
			return fail(400, {
				displayName,
				phone,
				error: '휴대전화번호를 올바르게 입력해 주세요.',
				agreePrivacy,
				agreeTerms
			});
		}

		let policies;
		try {
			policies = await fetchCurrentLegalPolicies(locals.supabase);
		} catch {
			return fail(503, { displayName, phone, error: '약관 정보를 불러오지 못했습니다.' });
		}

		const privacy = policies.find((p) => p.policy_type === 'privacy');
		const terms = policies.find((p) => p.policy_type === 'terms_of_service');
		if (!privacy || !terms) {
			return fail(503, { displayName, phone, error: '필수 약관이 준비되지 않았습니다.' });
		}

		const now = new Date().toISOString();
		const { error: profileError } = await locals.supabase.from('profiles').upsert(
			{
				id: locals.user.id,
				email: locals.user.email || '',
				display_name: displayName.trim(),
				phone_number: phoneNumber,
				onboarding_completed_at: now,
				updated_at: now
			},
			{ onConflict: 'id' }
		);
		if (profileError) {
			return fail(500, { displayName, phone, error: '프로필 저장에 실패했습니다. 다시 시도해 주세요.' });
		}

		const consentRows = [
			{ user_id: locals.user.id, policy_id: privacy.id, agreed_at: now },
			{ user_id: locals.user.id, policy_id: terms.id, agreed_at: now }
		];
		const { error: consentError } = await locals.supabase
			.from('user_consents')
			.upsert(consentRows, { onConflict: 'user_id,policy_id' });
		if (consentError) {
			return fail(500, {
				displayName,
				phone,
				error: '동의 기록 저장에 실패했습니다. 다시 시도해 주세요.'
			});
		}

		redirect(303, redirectTo);
	}
};
