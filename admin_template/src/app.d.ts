import type { SupabaseClient } from '@supabase/supabase-js';

declare global {
	namespace App {
		interface Locals {
			supabase: SupabaseClient | null;
			user: { id: string; email: string } | null;
		}
		interface PageData {
			user: { id: string; email: string } | null;
			db: { ok: boolean; configured: boolean; message: string };
			isAdmin: boolean;
			profiles: import('$lib/server/profiles.js').ProfileRow[];
			profilesError: string | null;
			usageByUser: import('$lib/server/conversationUsage.js').UserUsageAggregate[];
			usageReady: boolean;
			usageError: string | null;
			usageAccessError: string | null;
			exchange: { rate: number; date: string } | null;
			usageRowsLoaded: number;
			selectedUserId: string;
			selectedConversations: import('$lib/server/conversationUsage.js').ConversationUsageItem[];
		}
	}
}

export {};
