<script>
	import LegalDocumentView from '$lib/components/LegalDocumentView.svelte';

	let { data } = $props();
</script>

<svelte:head><title>개인정보 처리방침 · 실시간 AI 영어 회화</title></svelte:head>

<LegalDocumentView
	title={data.policy.title}
	version={data.policy.version}
	effectiveAt={data.policy.effective_at}
	content={data.policy.content}
/>
