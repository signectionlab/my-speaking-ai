<script>
	import SpeakingApp from '$lib/components/SpeakingApp.svelte';

	let { data } = $props();
</script>

{#if data.user}
	<SpeakingApp />
{/if}
