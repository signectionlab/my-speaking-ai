import { describe, expect, it } from 'vitest';
import { isAdminOpenPath } from './adminAccess.js';

describe('isAdminOpenPath', () => {
	it('keeps login and logout available before an admin check', () => {
		expect(isAdminOpenPath('/')).toBe(true);
		expect(isAdminOpenPath('/logout')).toBe(true);
		expect(isAdminOpenPath('/api/db')).toBe(false);
	});
});
