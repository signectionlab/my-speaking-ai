<script>
	let { title, version, effectiveAt, content } = $props();

	const effectiveLabel = $derived(
		effectiveAt
			? new Date(effectiveAt).toLocaleDateString('ko-KR', {
					year: 'numeric',
					month: 'long',
					day: 'numeric'
				})
			: ''
	);
</script>

<main class="px-4 py-10">
	<article class="mx-auto w-full max-w-2xl rounded-[28px] bg-white px-8 py-10 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
		<header class="border-b border-[#e5e7eb] pb-6">
			<h1 class="text-[22px] font-bold tracking-tight text-black">{title}</h1>
			<p class="mt-2 text-[13px] text-[#6b7280]">
				버전 {version}
				{#if effectiveLabel}
					· 시행일 {effectiveLabel}
				{/if}
			</p>
		</header>
		<div class="prose-policy mt-6 whitespace-pre-wrap text-[14px] leading-relaxed text-[#374151]">
			{content}
		</div>
	</article>
</main>
