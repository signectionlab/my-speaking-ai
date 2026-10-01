import { error } from '@sveltejs/kit';
import { fetchCurrentLegalPolicy } from '$lib/server/legalPolicies.js';

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals }) {
	if (!locals.supabase) error(503, 'Supabase 설정이 없습니다.');
	try {
		const policy = await fetchCurrentLegalPolicy(locals.supabase, 'privacy');
		if (!policy) error(404, '개인정보 처리방침을 찾을 수 없습니다.');
		return { policy };
	} catch {
		error(503, '약관을 불러오지 못했습니다.');
	}
}
