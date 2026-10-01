import {
	defaultPromptStyles,
	normalizePromptStyles,
	resolvePromptInstructionParts
} from './tutorPromptFields.js';
import { levelInstructionParts } from './tutorLevels.js';

/** @typedef {'friendly' | 'strict' | 'business' | 'casual' | 'custom'} TeacherPersonalityId */
/** @typedef {'english' | 'korean' | 'mixed'} LanguageMode */
/** @typedef {'beginner' | 'intermediate' | 'advanced'} TutorLevel */
/** @typedef {import('./tutorPromptFields.js').PromptStyleSelection} PromptStyleSelection */

export const TEACHER_PERSONALITIES = [
	{
		id: 'friendly',
		emoji: '😊',
		title: '친근한 선생님',
		subtitle: '부드럽고 격려하는 스타일'
	},
	{
		id: 'strict',
		emoji: '🎯',
		title: '엄격한 선생님',
		subtitle: '정확한 교정과 반복 연습'
	},
	{
		id: 'business',
		emoji: '💼',
		title: '비즈니스 전문가',
		subtitle: '업무 영어와 전문 표현'
	},
	{
		id: 'casual',
		emoji: '🎉',
		title: '캐주얼 친구',
		subtitle: '일상 대화와 재미있는 주제'
	}
];

/** @param {TeacherPersonalityId | string | undefined | null} id */
export function getTeacherPersonalityDisplay(id) {
	if (id === 'custom') {
		return { emoji: '✏️', title: '직접 작성', subtitle: '사용자 지정 프롬프트' };
	}
	const found = TEACHER_PERSONALITIES.find((p) => p.id === id);
	if (found) return found;
	return { emoji: '🤖', title: 'AI 설정', subtitle: '저장된 설정 없음' };
}

/** @param {unknown} value @returns {value is TeacherPersonalityId} */
export function isTeacherPersonalityId(value) {
	return (
		value === 'friendly' ||
		value === 'strict' ||
		value === 'business' ||
		value === 'casual' ||
		value === 'custom'
	);
}

/** @type {Record<Exclude<TeacherPersonalityId, 'custom'>, string>} */
export const PERSONALITY_PREVIEW_KO = {
	friendly:
		'당신은 친근하고 따뜻한 영어 회화 선생님입니다. 학습자를 격려하고 부드럽게 대화하며, 이해를 방해하는 실수만 가볍게 교정합니다. 막히면 짧은 한국어로 돕고, 대화는 주로 영어로 이어갑니다.',
	strict:
		'당신은 엄격하지만 효과적인 영어 회화 선생님입니다. 사용자의 문법·표현 실수를 즉시 짚고 교정해 주세요. 정확한 영어 사용을 위해 필요하면 반복 연습을 요청하고, 실수한 부분은 다시 말하도록 유도하세요. 대화는 가능한 한 영어로만 진행하고 한국어 사용은 최소화하세요.',
	business:
		'당신은 비즈니스 영어 전문 튜터입니다. 회의, 이메일, 프레젠테이션, 직장 스몰토크에 맞는 전문적이고 정중한 표현을 연습시킵니다. 실무에서 쓰는 표현을 제안하고, 톤을 비즈니스 상황에 맞게 교정합니다.',
	casual:
		'당신은 편안한 영어 대화 친구 같은 튜터입니다. 일상, 취미, 여행, 음식 등 가벼운 주제로 재미있게 대화합니다. 분위기를 부담 없이 유지하고, 자연스러운 구어 표현을 알려 줍니다.'
};

export const DEFAULT_CUSTOM_PROMPT_KO =
	'당신은 사용자가 원하는 스타일의 영어 회화 선생님입니다. 원하는 성격, 교정 방식, 주제, 한국어 사용 빈도를 자유롭게 적어 주세요.';

export const CUSTOM_PROMPT_MAX_LEN = 2000;

/**
 * @param {TeacherPersonalityId} personalityId
 * @param {LanguageMode} languageMode
 * @returns {PromptStyleSelection}
 */
export function stylesForPersonality(personalityId, languageMode) {
	void languageMode;
	const gentle = /** @type {PromptStyleSelection} */ ({
		tutorRole: 'gentle',
		speakingStyle: 'gentle',
		correction: 'gentle',
		learnerSupport: 'gentle',
		replyLength: 'gentle',
		tone: 'gentle'
	});
	const strict = /** @type {PromptStyleSelection} */ ({
		tutorRole: 'strict',
		speakingStyle: 'strict',
		correction: 'strict',
		learnerSupport: 'strict',
		replyLength: 'standard',
		tone: 'strict'
	});

	switch (personalityId) {
		case 'strict':
			return strict;
		case 'business':
			return { ...strict, speakingStyle: 'standard', tone: 'standard' };
		case 'casual':
			return { ...gentle, tone: 'standard', replyLength: 'standard' };
		case 'friendly':
		default:
			return gentle;
	}
}

/** @param {TeacherPersonalityId} personalityId */
function personalityExtraEnglish(personalityId) {
	if (personalityId === 'business') {
		return 'Focus on business English: meetings, emails, presentations, and professional small talk.';
	}
	if (personalityId === 'casual') {
		return 'Prefer fun everyday topics: hobbies, travel, food, and casual small talk.';
	}
	return '';
}

/**
 * @param {{
 *   level: TutorLevel,
 *   languageMode: LanguageMode,
 *   personalityId?: TeacherPersonalityId,
 *   customPromptText?: string,
 *   promptStyles?: Partial<PromptStyleSelection>
 * }} input
 */
export function resolveSessionInstructions(input) {
	const personalityId = input.personalityId ?? 'friendly';
	const custom = input.customPromptText?.trim() ?? '';
	const levelParts = levelInstructionParts(input.level);

	if (personalityId === 'custom' && custom) {
		return `${custom.slice(0, CUSTOM_PROMPT_MAX_LEN)} ${levelParts.join(' ')}`.trim();
	}

	const styles =
		personalityId === 'custom'
			? normalizePromptStyles(input.languageMode, input.promptStyles)
			: stylesForPersonality(personalityId, input.languageMode);
	const extra = personalityExtraEnglish(personalityId);

	return [...resolvePromptInstructionParts(input.languageMode, styles), extra, ...levelParts]
		.filter(Boolean)
		.join(' ');
}

/**
 * @param {{
 *   personalityId: TeacherPersonalityId,
 *   customPromptText?: string,
 *   languageMode: LanguageMode
 * }} input
 */
export function previewPromptKo(input) {
	if (input.personalityId === 'custom') {
		const text = input.customPromptText?.trim();
		return text || DEFAULT_CUSTOM_PROMPT_KO;
	}
	return PERSONALITY_PREVIEW_KO[input.personalityId];
}

/** @param {TeacherPersonalityId} personalityId @param {LanguageMode} languageMode */
export function applyPersonalityToStyles(personalityId, languageMode) {
	if (personalityId === 'custom') return defaultPromptStyles();
	return stylesForPersonality(personalityId, languageMode);
}
