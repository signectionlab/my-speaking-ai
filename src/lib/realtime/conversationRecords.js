/**
 * @typedef {{ role: 'user' | 'assistant' | 'system', text: string }} ChatMessage
 * @typedef {{ id: string, savedAt: string, level: string, vadPreset: string, languageMode?: string, messages: ChatMessage[] }} SavedConversation
 * @typedef {{ savedAt: string, level: string, vadPreset: string, languageMode?: string, messages: ChatMessage[] }} ConversationInsertPayload
 * @typedef {{ role: 'user' | 'assistant', text: string }} DialogMessage
 */

const TECH_SYSTEM_PATTERN =
	/POST\s+\/|RTCPeerConnection|WebRTC|SDP|getUserMedia|oai-events|session\.close|ephemeral|Authorization|hasKey|chars|tokenPrefix|ICE:/i;

/**
 * @param {ChatMessage[]} messages
 */
export function splitSessionMessages(messages) {
	/** @type {DialogMessage[]} */
	const dialog = [];
	/** @type {ChatMessage[]} */
	const system = [];
	for (const m of messages) {
		if (!m || typeof m.text !== 'string') continue;
		if (m.role === 'system') system.push({ role: 'system', text: m.text });
		else if (m.role === 'user' || m.role === 'assistant') {
			dialog.push({ role: m.role, text: m.text });
		}
	}
	return { dialog, system };
}

/**
 * @param {{ messages: ChatMessage[] }} entry
 */
export function countDialogMessages(entry) {
	return entry.messages.filter((m) => m.role === 'user' || m.role === 'assistant').length;
}

/** @param {string} iso */
export function formatRecordShortDate(iso) {
	try {
		return new Intl.DateTimeFormat('en-US', {
			month: '2-digit',
			day: '2-digit',
			year: 'numeric'
		}).format(new Date(iso));
	} catch {
		return iso;
	}
}

/** @param {string} iso */
export function formatSavedDateLong(iso) {
	try {
		return new Intl.DateTimeFormat('ko-KR', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(iso));
	} catch {
		return iso;
	}
}

/**
 * @param {string} baseIso
 * @param {number} index
 */
export function dialogMessageClock(baseIso, index) {
	const base = Date.parse(baseIso);
	if (Number.isNaN(base)) return '';
	try {
		return new Intl.DateTimeFormat('ko-KR', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		}).format(new Date(base + index * 1000));
	} catch {
		return '';
	}
}

/** @param {string} iso */
export function formatSystemClock(iso) {
	try {
		return new Intl.DateTimeFormat('ko-KR', {
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
			hour12: false
		}).format(new Date(iso));
	} catch {
		return '';
	}
}

/** @param {string} atIso @param {string} body @returns {ChatMessage} */
export function createUserSystemMessage(atIso, body) {
	const clock = formatSystemClock(atIso);
	const label = body.trim();
	const text = clock ? `${clock} · ${label}` : label;
	return { role: 'system', text };
}

/** @param {string} text */
export function parseSystemMessageText(text) {
	const firstLine = text.split('\n')[0] ?? text;
	const rest = text.includes('\n') ? text.slice(text.indexOf('\n') + 1).trim() : '';
	const match = firstLine.match(/^(\d{1,2}:\d{2}:\d{2})\s·\s(.+)$/);
	if (match) {
		const inlineBody = match[2].trim();
		const body = rest && !isTechnicalSystemDetail(rest) ? `${inlineBody}\n${rest}` : inlineBody;
		return { time: match[1], body };
	}
	return { time: '', body: isTechnicalSystemDetail(text) ? '' : text.trim() };
}

/** @param {string} detail */
function isTechnicalSystemDetail(detail) {
	const trimmed = detail.trim();
	if (!trimmed) return false;
	if (TECH_SYSTEM_PATTERN.test(trimmed)) return true;
	if (trimmed.length > 120 && /[{[\]}"]/.test(trimmed)) return true;
	return false;
}

/** @param {ChatMessage[]} messages */
export function filterUserFacingSystemMessages(messages) {
	return messages.filter((m) => {
		if (m.role !== 'system') return false;
		const parsed = parseSystemMessageText(m.text);
		if (!parsed.body) return false;
		if (isTechnicalSystemDetail(m.text)) return false;
		if (TECH_SYSTEM_PATTERN.test(parsed.body)) return false;
		const rawLines = m.text.split('\n').filter(Boolean);
		if (rawLines.length > 1 && isTechnicalSystemDetail(rawLines.slice(1).join('\n'))) {
			const first = parseSystemMessageText(rawLines[0]).body;
			return Boolean(first);
		}
		return true;
	});
}

/**
 * 음성 대화(user/assistant)와 세션 디버그(system)를 하나의 messages 배열로 묶습니다.
 * savedAt은 세션 시작 시각(사용 시각)입니다.
 *
 * @param {{
 *   sessionStartedAt: string,
 *   level: string,
 *   vadPreset: string,
 *   languageMode?: string,
 *   dialogMessages: DialogMessage[],
 *   systemMessages?: ChatMessage[]
 * }} input
 * @returns {ConversationInsertPayload}
 */
export function buildConversationInsertPayload(input) {
	/** @type {ChatMessage[]} */
	const messages = input.dialogMessages.map((m) => ({ role: m.role, text: m.text }));

	for (const item of input.systemMessages ?? []) {
		if (item.role !== 'system' || typeof item.text !== 'string') continue;
		const trimmed = item.text.trim();
		if (trimmed) messages.push({ role: 'system', text: trimmed });
	}

	return {
		savedAt: input.sessionStartedAt,
		level: input.level,
		vadPreset: input.vadPreset,
		languageMode: input.languageMode,
		messages
	};
}

/**
 * @param {string} userId
 * @param {ConversationInsertPayload} payload
 */
export function payloadToInsertRow(userId, payload) {
	return {
		user_id: userId,
		saved_at: payload.savedAt,
		level: payload.level,
		vad_preset: payload.vadPreset,
		language_mode: payload.languageMode ?? null,
		messages: payload.messages
	};
}

/**
 * @param {{
 *   id: string,
 *   saved_at: string,
 *   level: string,
 *   vad_preset: string,
 *   language_mode?: string | null,
 *   messages?: unknown
 * }} row
 * @returns {SavedConversation}
 */
export function rowToSavedConversation(row) {
	return {
		id: row.id,
		savedAt: row.saved_at,
		level: row.level,
		vadPreset: row.vad_preset,
		languageMode: row.language_mode ?? undefined,
		messages: normalizeMessages(row.messages)
	};
}

/** @param {unknown} raw */
function normalizeMessages(raw) {
	if (!Array.isArray(raw)) return [];
	/** @type {ChatMessage[]} */
	const out = [];
	for (const item of raw) {
		if (!item || typeof item !== 'object') continue;
		const role = /** @type {{ role?: string, text?: string }} */ (item).role;
		const text = /** @type {{ role?: string, text?: string }} */ (item).text;
		if (
			(role === 'user' || role === 'assistant' || role === 'system') &&
			typeof text === 'string'
		) {
			out.push({ role, text });
		}
	}
	return out;
}
