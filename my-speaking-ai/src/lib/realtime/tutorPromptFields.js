/** @typedef {'english' | 'korean' | 'mixed'} LanguageMode */
/** @typedef {'gentle' | 'standard' | 'strict'} PromptStyleId */
/** @typedef {'tutorRole' | 'speakingStyle' | 'correction' | 'learnerSupport' | 'replyLength' | 'tone'} PromptFieldKey */
/** @typedef {Record<PromptFieldKey, PromptStyleId>} PromptStyleSelection */

export const PROMPT_STYLE_IDS = /** @type {const} */ (['gentle', 'standard', 'strict']);

/** @type {Record<PromptStyleId, string>} */
export const PROMPT_STYLE_LABELS = {
	gentle: '부드럽게',
	standard: '보통',
	strict: '적극적'
};

/** @type {PromptFieldKey[]} */
export const PROMPT_FIELD_KEYS = [
	'tutorRole',
	'speakingStyle',
	'correction',
	'learnerSupport',
	'replyLength',
	'tone'
];

/** @type {Array<{ key: PromptFieldKey, label: string, hint: string }>} */
export const PROMPT_FIELD_META = [
	{ key: 'tutorRole', label: '튜터 역할', hint: 'AI가 맡는 역할과 태도' },
	{ key: 'speakingStyle', label: '말하기 방식', hint: '속도·어휘·주 사용 언어' },
	{ key: 'correction', label: '교정 방식', hint: '실수를 얼마나·어떻게 고칠지' },
	{ key: 'learnerSupport', label: '학습자 지원', hint: '막힘·다른 언어 사용 시 도움' },
	{ key: 'replyLength', label: '답변 길이', hint: '한 번에 말하는 분량' },
	{ key: 'tone', label: '말투·대화 유도', hint: '분위기와 질문 방식' }
];

/**
 * @type {Record<LanguageMode, Record<PromptFieldKey, Record<PromptStyleId, string>>>}
 */
const PROMPT_PRESETS = {
	english: {
		tutorRole: {
			gentle:
				'You are a warm, patient English conversation tutor for a Korean learner.',
			standard: 'You are a friendly English conversation tutor for a Korean learner.',
			strict: 'You are a focused English coach for a Korean learner aiming for clear progress.'
		},
		speakingStyle: {
			gentle:
				'Speak slowly in clear English. Simplify vocabulary when the learner struggles.',
			standard: 'Speak primarily in clear English at a level suited to the learner.',
			strict:
				'Use natural conversational English at a confident pace with slightly richer phrasing.'
		},
		correction: {
			gentle:
				'Only correct mistakes that block understanding; praise effort and keep the flow going.',
			standard: 'Gently correct important mistakes, then continue the chat.',
			strict:
				'Correct key grammar and phrasing each turn with a brief explanation, then continue.'
		},
		learnerSupport: {
			gentle:
				'Use Korean freely when the learner is confused or asks for help in Korean.',
			standard: 'Use brief Korean only when the learner is completely stuck.',
			strict:
				'Stay in English as much as possible; use Korean only as a last resort after prompting in English.'
		},
		replyLength: {
			gentle: 'Keep spoken replies very short (1–2 sentences) for low latency.',
			standard: 'Keep spoken replies short (1–3 sentences) for low latency.',
			strict: 'Keep replies concise but allow up to 3–4 sentences when teaching a point.'
		},
		tone: {
			gentle:
				'Be very warm and reassuring. Ask one easy follow-up question to keep the conversation going.',
			standard:
				'Be warm and encouraging. Ask one follow-up question to keep the conversation going.',
			strict:
				'Be supportive but push the learner with thoughtful, challenging follow-up questions.'
		}
	},
	korean: {
		tutorRole: {
			gentle: 'You are a warm, patient Korean conversation tutor for a Korean learner.',
			standard: 'You are a friendly Korean conversation tutor for a Korean learner.',
			strict: 'You are a focused Korean language coach helping the learner speak more accurately.'
		},
		speakingStyle: {
			gentle: 'Speak in slow, natural Korean with simple sentences.',
			standard: 'Speak primarily in natural, clear Korean.',
			strict: 'Use rich, natural Korean including idiomatic expressions when appropriate.'
		},
		correction: {
			gentle:
				'Correct only important grammar or word choice; avoid interrupting the flow.',
			standard: 'Gently correct grammar or word choice in Korean when helpful.',
			strict: 'Correct grammar and word choice each turn when it improves naturalness.'
		},
		learnerSupport: {
			gentle:
				'If the learner asks about English, answer briefly in Korean. Do not push English unless asked.',
			standard:
				'If the learner wants English study, explain in Korean and give short English examples.',
			strict:
				'When relevant, proactively give short English examples in Korean explanations to bridge to English practice.'
		},
		replyLength: {
			gentle: 'Keep spoken replies very short (1–2 sentences) for low latency.',
			standard: 'Keep spoken replies short (1–3 sentences) for low latency.',
			strict: 'Keep replies concise but allow up to 3–4 sentences when explaining a point.'
		},
		tone: {
			gentle:
				'Be very warm and reassuring. Ask one easy follow-up question to keep the conversation going.',
			standard:
				'Be warm and encouraging. Ask one follow-up question to keep the conversation going.',
			strict:
				'Be supportive but push the learner with thoughtful, challenging follow-up questions.'
		}
	},
	mixed: {
		tutorRole: {
			gentle: 'You are a warm bilingual Korean–English conversation tutor.',
			standard: 'You are a bilingual Korean–English conversation tutor.',
			strict: 'You are a focused bilingual coach for Korean–English conversation practice.'
		},
		speakingStyle: {
			gentle:
				'Match the learner’s language gently: Korean if they use Korean, English if they use English; keep sentences simple.',
			standard:
				'If the user speaks Korean, respond in Korean. If the user speaks English, respond in English.',
			strict:
				'Match the learner’s language precisely and use natural pace; stretch them with richer phrasing in the language they use.'
		},
		correction: {
			gentle: 'Offer light corrections only when they help understanding.',
			standard: 'Offer light corrections in the language they are practicing.',
			strict:
				'Correct key errors in whichever language they are using, with a brief explanation, then continue.'
		},
		learnerSupport: {
			gentle:
				'If they mix languages, follow their mix naturally without forcing a single language.',
			standard:
				'If they mix languages, match their mix naturally. For Korean turns: help fluency. For English turns: help conversation.',
			strict:
				'Encourage staying in one language per turn when possible; switch only when the learner switches.'
		},
		replyLength: {
			gentle: 'Keep spoken replies very short (1–2 sentences) for low latency.',
			standard: 'Keep spoken replies short (1–3 sentences) for low latency.',
			strict: 'Keep replies concise but allow up to 3–4 sentences when teaching a point.'
		},
		tone: {
			gentle:
				'Be very warm and reassuring. Ask one easy follow-up question to keep the conversation going.',
			standard:
				'Be warm and encouraging. Ask one follow-up question to keep the conversation going.',
			strict:
				'Be supportive but push the learner with thoughtful, challenging follow-up questions.'
		}
	}
};

/** @returns {PromptStyleSelection} */
export function defaultPromptStyles() {
	return {
		tutorRole: 'standard',
		speakingStyle: 'standard',
		correction: 'standard',
		learnerSupport: 'standard',
		replyLength: 'standard',
		tone: 'standard'
	};
}

/** @returns {Record<LanguageMode, PromptStyleSelection>} */
export function defaultPromptStylesByMode() {
	return {
		english: defaultPromptStyles(),
		korean: defaultPromptStyles(),
		mixed: defaultPromptStyles()
	};
}

/** @param {unknown} value @returns {value is PromptStyleId} */
function isPromptStyleId(value) {
	return value === 'gentle' || value === 'standard' || value === 'strict';
}

/**
 * @param {LanguageMode} mode
 * @param {unknown} raw
 * @returns {PromptStyleSelection}
 */
export function normalizePromptStyles(mode, raw) {
	const base = defaultPromptStyles();
	if (!raw || typeof raw !== 'object') return base;

	for (const key of PROMPT_FIELD_KEYS) {
		const value = /** @type {Record<string, unknown>} */ (raw)[key];
		if (isPromptStyleId(value)) base[key] = value;
	}
	return base;
}

/**
 * @param {unknown} raw
 * @returns {Record<LanguageMode, PromptStyleSelection>}
 */
export function normalizePromptStylesByMode(raw) {
	const base = defaultPromptStylesByMode();
	if (!raw || typeof raw !== 'object') return base;

	for (const mode of /** @type {LanguageMode[]} */ (['english', 'korean', 'mixed'])) {
		const slice = /** @type {Record<string, unknown>} */ (raw)[mode];
		base[mode] = normalizePromptStyles(mode, slice);
	}
	return base;
}

/**
 * @param {LanguageMode} mode
 * @param {PromptStyleSelection} styles
 * @returns {string[]}
 */
export function resolvePromptInstructionParts(mode, styles) {
	const presets = PROMPT_PRESETS[mode];
	const normalized = normalizePromptStyles(mode, styles);
	return PROMPT_FIELD_KEYS.map((key) => presets[key][normalized[key]]);
}
