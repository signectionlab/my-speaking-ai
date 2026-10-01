<script>
	import LegalDocumentView from '$lib/components/LegalDocumentView.svelte';

	let { data } = $props();
</script>

<svelte:head><title>서비스 이용약관 · 실시간 AI 영어 회화</title></svelte:head>

<LegalDocumentView
	title={data.policy.title}
	version={data.policy.version}
	effectiveAt={data.policy.effective_at}
	content={data.policy.content}
/>
