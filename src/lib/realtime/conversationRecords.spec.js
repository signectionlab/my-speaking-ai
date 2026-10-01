import { describe, expect, it } from 'vitest';
import {
	buildConversationInsertPayload,
	countDialogMessages,
	payloadToInsertRow,
	rowToSavedConversation,
	splitSessionMessages
} from './conversationRecords.js';

describe('conversationRecords', () => {
	it('merges dialog and system logs with session start as savedAt', () => {
		const payload = buildConversationInsertPayload({
			sessionStartedAt: '2026-09-30T06:00:00.000Z',
			level: 'beginner',
			vadPreset: 'fast',
			languageMode: 'english',
			dialogMessages: [
				{ role: 'user', text: 'Hello' },
				{ role: 'assistant', text: 'Hi there' }
			],
			systemMessages: [{ role: 'system', text: '10:00:01 · 새로운 영어회화 세션이 시작되었습니다.' }]
		});

		expect(payload.savedAt).toBe('2026-09-30T06:00:00.000Z');
		expect(payload.messages).toHaveLength(3);
		expect(payload.messages[2].text).toContain('새로운 영어회화 세션이 시작되었습니다.');
	});

	it('maps rows to SavedConversation and back to insert', () => {
		const row = {
			id: 'uuid-1',
			saved_at: '2026-09-30T06:00:00.000Z',
			level: 'intermediate',
			vad_preset: 'balanced',
			language_mode: 'mixed',
			messages: [
				{ role: 'user', text: 'A' },
				{ role: 'system', text: 'log' }
			]
		};
		const saved = rowToSavedConversation(row);
		expect(saved.vadPreset).toBe('balanced');
		expect(countDialogMessages(saved)).toBe(1);

		const insert = payloadToInsertRow('user-1', {
			savedAt: saved.savedAt,
			level: saved.level,
			vadPreset: saved.vadPreset,
			languageMode: saved.languageMode,
			messages: saved.messages
		});
		expect(insert.user_id).toBe('user-1');
		expect(insert.vad_preset).toBe('balanced');
	});

	it('splitSessionMessages separates dialog and system', () => {
		const { dialog, system } = splitSessionMessages([
			{ role: 'user', text: 'x' },
			{ role: 'system', text: 'y' },
			{ role: 'assistant', text: 'z' }
		]);
		expect(dialog).toHaveLength(2);
		expect(system).toHaveLength(1);
	});
});
