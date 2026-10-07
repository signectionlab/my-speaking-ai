<script>
	import RealtimeChat from '$lib/components/RealtimeChat.svelte';
</script>

<main class="px-4 py-10">
	<section class="mx-auto w-full max-w-md">
		<div
			class="overflow-hidden rounded-[28px] bg-white px-8 pb-10 pt-9 shadow-[0_20px_50px_rgba(15,23,42,0.08)]"
		>
			<header class="text-center">
				<h1 class="text-[22px] font-bold tracking-tight text-black">실시간 AI 영어 회화</h1>
				<p class="mt-2 text-[15px] leading-relaxed text-[#4b5563]">
					설정을 고른 뒤 「AI와 대화 시작」으로 튜터와 대화하세요.
				</p>
			</header>

			<div class="mt-8">
				<RealtimeChat embedded />
			</div>
		</div>
	</section>
</main>
