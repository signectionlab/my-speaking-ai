import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { buildSessionConfig, normalizePromptStyles } from '$lib/realtime/tutorLevels.js';
import { resolveSessionInstructions } from '$lib/realtime/tutorPersonalities.js';
import {
	interpretTokenGrant,
	missingTokenGrantFunction,
	tokenGrantLimitMessage
} from '$lib/server/tokenGrant.js';

/** @param {string | undefined} level */
function parseLevel(level) {
	if (level === 'intermediate' || level === 'advanced') return level;
	return 'beginner';
}

/** @param {string | undefined} vad */
function parseVad(vad) {
	if (vad === 'fast' || vad === 'patient') return vad;
	return 'balanced';
}

/** @param {string | undefined} lang */
function parseLanguageMode(lang) {
	if (lang === 'korean' || lang === 'mixed') return lang;
	return 'english';
}

/** @param {string | undefined} value */
function parsePersonality(value) {
	if (value === 'strict' || value === 'business' || value === 'casual' || value === 'custom') {
		return value;
	}
	return 'friendly';
}

/** @param {string} raw */
function parseMaybeJson(raw) {
	try {
		return JSON.parse(raw);
	} catch {
		return raw;
	}
}

function fail(status, message, extra = {}) {
	return json(
		{
			ok: false,
			error: message,
			status,
			...extra
		},
		{ status }
	);
}

export async function POST({ request, locals }) {
	if (!locals.user) {
		return fail(401, '로그인이 필요합니다.');
	}

	const apiKey =
		env.OPENAI_API_KEY ??
		(typeof process !== 'undefined' ? process.env.OPENAI_API_KEY : undefined);
	if (!apiKey?.trim()) {
		console.error(
			'api/token missing OPENAI_API_KEY',
			process.env.VERCEL ? 'vercel' : 'local'
		);
		return fail(503, '음성 세션을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
	}

	/** @type {Record<string, unknown>} */
	let body;
	try {
		body = await request.json();
	} catch {
		body = {};
	}

	const level = parseLevel(body.level);
	const vadPreset = parseVad(body.vadPreset);
	const languageMode = parseLanguageMode(body.languageMode);
	const personalityId = parsePersonality(body.teacherPersonality);
	const customPromptText =
		typeof body.customPromptText === 'string' ? body.customPromptText : '';
	const instructions = resolveSessionInstructions({
		level,
		languageMode,
		personalityId,
		customPromptText,
		promptStyles: normalizePromptStyles(languageMode, body.promptStyles)
	});
	const sessionConfig = buildSessionConfig(level, vadPreset, languageMode, instructions);

	if (!locals.supabase) {
		return fail(503, 'Supabase가 설정되지 않았습니다.');
	}

	const { data: grant, error: grantError } = await locals.supabase.rpc('consume_realtime_token_grant');
	if (grantError) {
		console.error('consume_realtime_token_grant:', grantError.message);
		if (missingTokenGrantFunction(grantError.message)) {
			console.error('Supabase SQL Editor에서 012_security_bounds.sql 을 실행해 주세요.');
		}
		return fail(503, '음성 세션을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
	}

	const decision = interpretTokenGrant(grant);
	if (!decision.allowed) {
		if (decision.reason === 'profile_missing') {
			return fail(403, '프로필을 확인한 뒤 다시 시도해 주세요.');
		}
		return fail(429, tokenGrantLimitMessage(decision.retryAfterSeconds));
	}

	let res;
	try {
		res = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${apiKey}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify(sessionConfig)
		});
	} catch (err) {
		const cause = err instanceof Error && err.cause instanceof Error ? err.cause : null;
		console.error('api/token openai fetch failed', {
			message: err instanceof Error ? err.message : String(err),
			code: cause && 'code' in cause ? String(cause.code) : undefined,
			cause: cause?.message
		});
		return fail(502, '음성 세션을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
	}

	const raw = await res.text();
	const parsed = parseMaybeJson(raw);

	if (!res.ok) {
		const openaiMessage =
			parsed && typeof parsed === 'object'
				? parsed.error?.message || parsed.message || null
				: String(raw).slice(0, 400);
		console.error('api/token openai rejected', { status: res.status, openaiMessage });
		return fail(502, '음성 세션을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
	}

	const data = typeof parsed === 'object' && parsed ? parsed : {};
	const value = data.value ?? data.client_secret?.value ?? null;
	if (!value) {
		console.error('api/token openai response missing ephemeral key', { keys: Object.keys(data) });
		return fail(502, '음성 세션을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.');
	}

	return json({
		ok: true,
		value,
		level,
		vadPreset,
		languageMode
	});
}
