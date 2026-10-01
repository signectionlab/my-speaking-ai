/** @typedef {'english' | 'korean' | 'mixed'} LanguageMode */
/** @typedef {{ content: string, updatedAt: string }} PromptDraft */
/** @typedef {{ id: string, title: string, languageMode: LanguageMode, content: string, updatedAt: string, createdAt: string }} SavedPrompt */
/** @typedef {{ drafts: Partial<Record<LanguageMode, PromptDraft>>, saved: SavedPrompt[] }} UserPromptsBundle */

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

/** @returns {Promise<UserPromptsBundle>} */
export async function fetchUserPrompts() {
	const res = await fetch('/api/prompts');
	const { json, raw } = await readJson(res);
	if (!res.ok) {
		const msg = json?.error || raw || '프롬프트를 불러오지 못했습니다.';
		throw new Error(typeof msg === 'string' ? msg : '프롬프트를 불러오지 못했습니다.');
	}
	return {
		drafts: json?.drafts ?? {},
		saved: Array.isArray(json?.saved) ? json.saved : []
	};
}

/**
 * @param {LanguageMode} languageMode
 * @param {string} content
 */
export async function savePromptDraft(languageMode, content) {
	const res = await fetch('/api/prompts', {
		method: 'PUT',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ languageMode, content })
	});
	const { json, raw } = await readJson(res);
	if (!res.ok) {
		const msg = json?.error || raw || '프롬프트 초안 저장에 실패했습니다.';
		throw new Error(typeof msg === 'string' ? msg : '프롬프트 초안 저장에 실패했습니다.');
	}
}

/**
 * @param {{ title: string, languageMode: LanguageMode, content: string }} input
 * @returns {Promise<SavedPrompt>}
 */
export async function createSavedPrompt(input) {
	const res = await fetch('/api/prompts', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(input)
	});
	const { json, raw } = await readJson(res);
	if (!res.ok) {
		const msg = json?.error || raw || '프롬프트 저장에 실패했습니다.';
		throw new Error(typeof msg === 'string' ? msg : '프롬프트 저장에 실패했습니다.');
	}
	if (!json?.prompt) throw new Error('저장된 프롬프트 응답이 올바르지 않습니다.');
	return json.prompt;
}

/** @param {string} id */
export async function deleteSavedPrompt(id) {
	const res = await fetch(`/api/prompts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
	const { json, raw } = await readJson(res);
	if (!res.ok) {
		const msg = json?.error || raw || '프롬프트 삭제에 실패했습니다.';
		throw new Error(typeof msg === 'string' ? msg : '프롬프트 삭제에 실패했습니다.');
	}
}
