<script>
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Navbar from '$lib/components/Navbar.svelte';

	let { children, data } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>

<div class="min-h-screen bg-[#eef1f8]">
	<Navbar user={data.user} />
	{@render children()}
</div>
<!-- 주석 단축키 cmd + / -->