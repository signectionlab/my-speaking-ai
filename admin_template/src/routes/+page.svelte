<script>
	import AccessDenied from '../lib/components/AccessDenied.svelte';
	import Login from '../lib/components/Login.svelte';
	import Dashboard from '../lib/components/Dashboard.svelte';

	/** @type {import('./$types').PageData} */
	export let data;
	/** @type {import('./$types').ActionData} */
	export let form;
</script>

{#if data.user && data.isAdmin}
	<Dashboard
		user={data.user}
		profiles={data.profiles}
		profilesError={data.profilesError}
		usageByUser={data.usageByUser}
		usageReady={data.usageReady}
		usageError={data.usageError}
		usageAccessError={data.usageAccessError}
		exchange={data.exchange}
		usageRowsLoaded={data.usageRowsLoaded}
		selectedUserId={data.selectedUserId}
		selectedConversations={data.selectedConversations}
		{form}
	/>
{:else if data.user}
	<AccessDenied user={data.user} hint={data.profilesError} />
{:else}
	<Login db={data.db} {form} />
{/if}
