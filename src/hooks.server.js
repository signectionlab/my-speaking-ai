import { createServerClient } from '@supabase/ssr';
import { json, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { resolveSupabaseConfig } from '$lib/server/supabaseConfig.js';

const PUBLIC_PAGES = new Set(['/login', '/signup']);

/** @param {string} pathname */
function isSkippable(pathname) {
	return pathname.startsWith('/_app/') || /\.[a-z0-9]+$/i.test(pathname);
}

/** @param {string} pathname */
function isProtectedPath(pathname) {
	return pathname === '/' || pathname.startsWith('/live') || pathname.startsWith('/api/');
}

/** @param {import('@sveltejs/kit').Cookies} cookies */
function hasAuthCookie(cookies) {
	return cookies.getAll().some((cookie) => cookie.name.includes('-auth-token'));
}

/** @param {string} name */
function filterSerializedResponseHeaders(name) {
	return name === 'content-range' || name === 'x-supabase-api-version';
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
async function readUser(supabase) {
	const { data, error } = await supabase.auth.getClaims();
	if (error || !data?.claims?.sub) return null;
	const email = data.claims.email;
	return {
		id: String(data.claims.sub),
		email: typeof email === 'string' ? email : ''
	};
}

/** @type {import('@sveltejs/kit').Handle} */
export async function handle({ event, resolve }) {
	const config = resolveSupabaseConfig(env, publicEnv);
	event.locals.user = null;
	event.locals.supabase = null;

	if (config.configured) {
		event.locals.supabase = createServerClient(config.url, config.key, {
			cookies: {
				getAll() {
					return event.cookies.getAll();
				},
				setAll(cookiesToSet, headers) {
					cookiesToSet.forEach(({ name, value, options }) => {
						event.cookies.set(name, value, { ...options, path: '/' });
					});
					if (headers && Object.keys(headers).length > 0) {
						try {
							event.setHeaders(headers);
						} catch {
							// 응답 헤더가 이미 전송된 뒤에는 캐시 헤더를 덮어쓰지 않습니다.
						}
					}
				}
			}
		});
	}

	if (!isSkippable(event.url.pathname) && event.locals.supabase && hasAuthCookie(event.cookies)) {
		event.locals.user = await readUser(event.locals.supabase);
	}

	const pathname = event.url.pathname;

	if (!isSkippable(pathname) && !event.locals.user && isProtectedPath(pathname)) {
		if (pathname.startsWith('/api/')) {
			return json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 });
		}
		const next = pathname === '/' ? '' : `?redirect=${encodeURIComponent(pathname + event.url.search)}`;
		redirect(303, `/login${next}`);
	}

	if (event.locals.user && PUBLIC_PAGES.has(pathname)) {
		redirect(303, '/');
	}

	return resolve(event, { filterSerializedResponseHeaders });
}
