import { json } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { buildSessionConfig, normalizePromptStyles } from '$lib/realtime/tutorLevels.js';
import { resolveSessionInstructions } from '$lib/realtime/tutorPersonalities.js';

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
		const onVercel = Boolean(process.env.VERCEL);
		const hint = onVercel
			? 'Vercel → Settings → Environment Variables에 OPENAI_API_KEY가 있는지 확인한 뒤, Deployments에서 Redeploy(재배포)하세요. 변수는 Production에 체크되어 있어야 합니다.'
			: '로컬: 프로젝트 루트 .env에 OPENAI_API_KEY=sk-... 를 넣고 npm run dev 를 다시 실행하세요.';
		return fail(503, '서버에 OPENAI_API_KEY가 없습니다.', {
			step: 'env',
			hint
		});
	}

	let body = {};
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
		return fail(502, 'OpenAI client_secrets 요청 중 네트워크 오류가 발생했습니다.', {
			step: 'client_secrets_fetch',
			openai: {
				message: err instanceof Error ? err.message : String(err),
				code: cause && 'code' in cause ? String(cause.code) : undefined,
				cause: cause?.message
			},
			hint:
				cause && 'code' in cause && cause.code === 'ENOTFOUND'
					? '개발 서버(Node)가 api.openai.com 주소를 찾지 못했습니다(DNS). 터미널에서 dev 서버를 완전히 종료(Ctrl+C)한 뒤 npm run dev 를 다시 실행하고, 브라우저 주소가 http://localhost:5173 인지 확인해 주세요. VPN·방화벽·인터넷도 점검해 주세요.'
					: '개발 서버가 api.openai.com 에 연결하지 못했습니다. 터미널에서 npm run dev 를 다시 실행하고, VPN·방화벽·인터넷 연결을 확인해 주세요.'
		});
	}

	const raw = await res.text();
	const parsed = parseMaybeJson(raw);

	if (!res.ok) {
		const openaiMessage =
			parsed && typeof parsed === 'object'
				? parsed.error?.message || parsed.message || null
				: String(raw).slice(0, 400);

		return fail(res.status, openaiMessage || '실시간 세션 토큰 발급에 실패했습니다.', {
			step: 'client_secrets',
			openai: parsed
		});
	}

	const data = typeof parsed === 'object' && parsed ? parsed : {};
	const value = data.value ?? data.client_secret?.value ?? null;
	if (!value) {
		return fail(502, '토큰 응답에 ephemeral 키가 없습니다.', {
			step: 'client_secrets_parse',
			openai: { keys: Object.keys(data) }
		});
	}

	return json({
		ok: true,
		value,
		level,
		vadPreset,
		languageMode
	});
}
