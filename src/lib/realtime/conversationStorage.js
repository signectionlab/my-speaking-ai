const PREFS_KEY = 'speaking-ai-realtime-prefs';

/** @typedef {import('./conversationRecords.js').SavedConversation} SavedConversation */
/** @typedef {import('./tutorPromptFields.js').LanguageMode} LanguageMode */
/** @typedef {import('./tutorPromptFields.js').PromptStyleSelection} PromptStyleSelection */
/** @typedef {import('./tutorPersonalities.js').TeacherPersonalityId} TeacherPersonalityId */
/** @typedef {{ level?: string, vadPreset?: string, languageMode?: string, teacherPersonality?: TeacherPersonalityId, customPromptByMode?: Partial<Record<LanguageMode, string>>, promptStylesByMode?: Partial<Record<LanguageMode, Partial<PromptStyleSelection>>> }} RealtimePrefs */

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
