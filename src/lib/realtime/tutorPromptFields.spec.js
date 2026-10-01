import { describe, expect, it } from 'vitest';
import { buildInstructions } from './tutorLevels.js';
import { defaultPromptStyles, normalizePromptStyles, resolvePromptInstructionParts } from './tutorPromptFields.js';

describe('prompt style presets', () => {
	it('builds instructions from style selections for every language mode', () => {
		for (const mode of /** @type {const} */ (['english', 'korean', 'mixed'])) {
			const strict = normalizePromptStyles(mode, { tutorRole: 'strict' });
			const text = buildInstructions('beginner', mode, strict);
			expect(text.length).toBeGreaterThan(40);
			expect(text).toContain('Use simple vocabulary');
		}
	});

	it('changes english tutor role text by style', () => {
		const gentle = resolvePromptInstructionParts('english', {
			...defaultPromptStyles(),
			tutorRole: 'gentle'
		});
		const strict = resolvePromptInstructionParts('english', {
			...defaultPromptStyles(),
			tutorRole: 'strict'
		});
		expect(gentle[0]).toContain('patient');
		expect(strict[0]).toContain('coach');
	});
});
