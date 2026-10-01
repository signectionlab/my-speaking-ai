/** @typedef {import('./conversationRecords.js').SavedConversation} SavedConversation */
/** @typedef {import('./conversationRecords.js').ConversationInsertPayload} ConversationInsertPayload */

/**
 * @param {Response} res
 */
async function readJson(res) {
	const raw = await res.text();
	try {
		return { json: JSON.parse(raw), raw };
	} catch {
		return { json: null, raw };
	}
}

/** @returns {Promise<SavedConversation[]>} */
export async function fetchConversations() {
	const res = await fetch('/api/conversations');
	const { json, raw } = await readJson(res);
	if (!res.ok) {
		const msg = json?.error || raw || '대화 기록을 불러오지 못했습니다.';
		throw new Error(typeof msg === 'string' ? msg : '대화 기록을 불러오지 못했습니다.');
	}
	return Array.isArray(json?.conversations) ? json.conversations : [];
}

/** @param {ConversationInsertPayload} payload @returns {Promise<SavedConversation>} */
export async function createConversation(payload) {
	const res = await fetch('/api/conversations', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(payload)
	});
	const { json, raw } = await readJson(res);
	if (!res.ok) {
		const msg = json?.error || raw || '대화 저장에 실패했습니다.';
		throw new Error(typeof msg === 'string' ? msg : '대화 저장에 실패했습니다.');
	}
	if (!json?.conversation) throw new Error('저장된 대화 응답이 올바르지 않습니다.');
	return json.conversation;
}

/** @param {string} id */
export async function deleteConversation(id) {
	const res = await fetch(`/api/conversations?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
	const { json, raw } = await readJson(res);
	if (!res.ok) {
		const msg = json?.error || raw || '대화 기록을 삭제하지 못했습니다.';
		throw new Error(typeof msg === 'string' ? msg : '대화 기록을 삭제하지 못했습니다.');
	}
}
