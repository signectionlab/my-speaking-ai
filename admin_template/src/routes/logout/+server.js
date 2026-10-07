import { redirect } from '@sveltejs/kit';

/** @type {import('./$types').RequestHandler} */
export async function POST({ locals }) {
	await locals.supabase?.auth.signOut();
	redirect(303, '/');
}
