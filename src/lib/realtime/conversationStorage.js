const STORAGE_KEY = 'speaking-ai-conversations';
const PREFS_KEY = 'speaking-ai-realtime-prefs';
const MAX_ENTRIES = 20;

/**
 * @typedef {{ role: 'user' | 'assistant', text: string }} ChatMessage
 * @typedef {{ id: string, savedAt: string, level: string, vadPreset: string, languageMode?: string, messages: ChatMessage[] }} SavedConversation
 * @typedef {{ level?: string, vadPreset?: string, languageMode?: string }} RealtimePrefs
 */

/** @returns {SavedConversation[]} */
export function loadConversations() {
	if (typeof localStorage === 'undefined') return [];
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return [];
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

/** @param {SavedConversation} entry */
export function saveConversation(entry) {
	const list = loadConversations();
	list.unshift(entry);
	localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_ENTRIES)));
}

/** @returns {RealtimePrefs} */
export function loadPrefs() {
	if (typeof localStorage === 'undefined') return {};
	try {
		const raw = localStorage.getItem(PREFS_KEY);
		return raw ? JSON.parse(raw) : {};
	} catch {
		return {};
	}
}

/** @param {RealtimePrefs} prefs */
export function savePrefs(prefs) {
	localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

/** @param {SavedConversation} conv */
export function downloadConversationJson(conv) {
	const blob = new Blob([JSON.stringify(conv, null, 2)], { type: 'application/json' });
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url;
	a.download = `tutor-chat-${conv.id}.json`;
	a.click();
	URL.revokeObjectURL(url);
}
