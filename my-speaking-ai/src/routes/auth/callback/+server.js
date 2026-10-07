import { redirect } from '@sveltejs/kit';
import { safeRedirectPath } from '$lib/server/supabaseConfig.js';

const OTP_TYPES = new Set(['signup', 'invite', 'magiclink', 'recovery', 'email', 'email_change']);

/** @type {import('./$types').RequestHandler} */
export async function GET({ url, locals }) {
	const next = safeRedirectPath(url.searchParams.get('next'));
	const code = url.searchParams.get('code');
	const tokenHash = url.searchParams.get('token_hash');
	const type = url.searchParams.get('type');

	if (!locals.supabase) redirect(303, '/login?error=confirm');

	if (code) {
		const { error } = await locals.supabase.auth.exchangeCodeForSession(code);
		if (!error) redirect(303, next);
	}

	if (tokenHash && type && OTP_TYPES.has(type)) {
		const { error } = await locals.supabase.auth.verifyOtp({
			token_hash: tokenHash,
			type: /** @type {'signup' | 'invite' | 'magiclink' | 'recovery' | 'email' | 'email_change'} */ (
				type
			)
		});
		if (!error) redirect(303, next);
	}

	redirect(303, '/login?error=confirm');
}
