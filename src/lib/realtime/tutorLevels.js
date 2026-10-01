import {
	normalizePromptStyles,
	resolvePromptInstructionParts
} from './tutorPromptFields.js';

/** @typedef {'beginner' | 'intermediate' | 'advanced'} TutorLevel */
/** @typedef {'fast' | 'balanced' | 'patient'} VadPreset */
/** @typedef {'english' | 'korean' | 'mixed'} LanguageMode */
/** @typedef {import('./tutorPromptFields.js').PromptStyleSelection} PromptStyleSelection */

/** @type {Record<TutorLevel, string>} */
export const LEVEL_LABELS = {
	beginner: '초급',
	intermediate: '중급',
	advanced: '고급'
};

/** @type {Record<TutorLevel, string>} */
export const LEVEL_HINTS = {
	beginner: '느리고 쉬운 표현 · 많은 격려',
	intermediate: '자연스러운 속도 · 가벼운 교정',
	advanced: '빠른 대화 · 뉘앙스·표현 확장'
};

/** @type {Record<LanguageMode, { label: string, hint: string }>} */
export const LANGUAGE_META = {
	english: {
		label: '영어 연습',
		hint: '튜터는 주로 영어로 대화 · 막힐 때만 짧게 한국어'
	},
	korean: {
		label: '한국어 대화',
		hint: '튜터는 한국어로 대화 · 영어 학습도 한국어로 안내'
	},
	mixed: {
		label: '영·한 자유',
		hint: '말하는 언어에 맞춰 튜터가 영어 또는 한국어로 답함'
	}
};

/** @type {Record<VadPreset, { label: string, hint: string }>} */
export const VAD_PRESET_META = {
	fast: { label: '빠른 응답', hint: '말을 멈추면 빨리 답함 (짧은 침묵)' },
	balanced: { label: '균형', hint: '일반 대화에 적합' },
	patient: { label: '여유', hint: '말하기 끝까지 기다림 · 끼어들기 적음' }
};

/**
 * @param {TutorLevel} level
 * @returns {string[]}
 */
/** @param {TutorLevel} level */
export function levelInstructionParts(level) {
	return {
		beginner: [
			'Use simple vocabulary and shorter sentences.',
			'One idea per sentence. One question at a time.'
		],
		intermediate: [
			'Use natural conversational pace.',
			'Correct 1–2 key errors per turn, not every mistake.'
		],
		advanced: [
			'Use rich vocabulary, idioms, and nuanced follow-ups when appropriate.',
			'Challenge the learner with thoughtful questions.'
		]
	}[level];
}

/**
 * @param {TutorLevel} level
 * @param {LanguageMode} languageMode
 * @param {Partial<PromptStyleSelection>} [promptStyles]
 * @returns {string}
 */
export function buildInstructions(level, languageMode, promptStyles) {
	const styles = normalizePromptStyles(languageMode, promptStyles);
	return [...resolvePromptInstructionParts(languageMode, styles), ...levelInstructionParts(level)].join(
		' '
	);
}

export {
	PROMPT_FIELD_META,
	PROMPT_STYLE_IDS,
	PROMPT_STYLE_LABELS,
	defaultPromptStyles,
	defaultPromptStylesByMode,
	normalizePromptStyles,
	normalizePromptStylesByMode
} from './tutorPromptFields.js';

/**
 * @param {VadPreset} preset
 * @returns {object}
 */
export function buildTurnDetection(preset) {
	switch (preset) {
		case 'fast':
			return {
				type: 'semantic_vad',
				eagerness: 'high',
				create_response: true,
				interrupt_response: true
			};
		case 'patient':
			return {
				type: 'semantic_vad',
				eagerness: 'low',
				create_response: true,
				interrupt_response: false
			};
		default:
			return {
				type: 'server_vad',
				threshold: 0.5,
				prefix_padding_ms: 300,
				silence_duration_ms: 450,
				create_response: true,
				interrupt_response: true
			};
	}
}

/** @param {string} instructions */
export function buildSessionConfig(level, vadPreset, languageMode, instructions) {
	return {
		session: {
			type: 'realtime',
			model: 'gpt-realtime-2.1',
			instructions,
			audio: {
				input: {
					transcription: { model: 'whisper-1' },
					turn_detection: buildTurnDetection(vadPreset)
				},
				output: {
					voice: 'marin'
				}
			}
		}
	};
}
