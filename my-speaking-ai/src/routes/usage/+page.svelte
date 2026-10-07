<script>
	import { resolve } from '$app/paths';
	import { formatSavedDateLong } from '$lib/realtime/conversationRecords.js';
	import {
		REALTIME_MODEL,
		TRANSCRIPTION_MODEL,
		estimateCost,
		formatDuration,
		formatKrw,
		formatTokenCount,
		formatUsd,
		hasMeasuredUsage,
		realtimeTokenTotal,
		sumUsages,
		usageTimes
	} from '$lib/realtime/realtimeUsage.js';

	let { data } = $props();

	const measured = $derived(
		data.conversations.filter((item) => item.usage && (hasMeasuredUsage(item.usage) || item.usage.durationMs > 0))
	);
	const totals = $derived(sumUsages(measured.map((item) => item.usage)));
	const totalCost = $derived(estimateCost(totals));
	const totalTimes = $derived(usageTimes(totals));
	const unmeasuredCount = $derived(data.conversations.length - measured.length);
	const rate = $derived(data.exchange?.rate ?? 0);
</script>

<svelte:head><title>사용량 · 실시간 AI 영어 회화</title></svelte:head>

<main class="px-4 py-8 sm:py-10">
	<section class="mx-auto w-full max-w-3xl">
		<header class="mb-5">
			<h1 class="text-[22px] font-bold tracking-tight text-[#111827]">API 사용량</h1>
			<p class="mt-2 text-[14px] leading-relaxed text-[#4b5563]">
				{REALTIME_MODEL} 대화 토큰과 {TRANSCRIPTION_MODEL} 전사 기준의 예상 요금입니다. 사용 시간은 대화를 연결한 시간이고, 발화 시간은 실제 음성 길이입니다.
			</p>
		</header>

		{#if !data.usageReady}
			<p class="mb-4 rounded-xl bg-[#fff7ed] px-4 py-3 text-[13px] leading-relaxed text-[#9a3412]" role="status">
				사용량 저장 열이 아직 없습니다. Supabase SQL Editor에서
				<code class="font-semibold">supabase/migrations/007_conversation_usage.sql</code>
				을 실행하면 이후 대화부터 사용량이 쌓입니다.
			</p>
		{/if}

		<div class="grid gap-3 sm:grid-cols-3">
			<article class="rounded-2xl bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
				<p class="text-[12px] font-medium text-[#98a2b3]">총 예상 요금</p>
				<p class="mt-1 text-[24px] font-bold text-[#1d4ed8]">
					{rate ? formatKrw(totalCost.totalUsd, rate) : formatUsd(totalCost.totalUsd)}
				</p>
				<p class="mt-1 text-[12px] text-[#64748b]">{formatUsd(totalCost.totalUsd)}</p>
				<p class="mt-1 text-[12px] text-[#64748b]">
					대화 {rate ? formatKrw(totalCost.realtimeUsd, rate) : formatUsd(totalCost.realtimeUsd)}
					· 전사 {rate ? formatKrw(totalCost.transcriptionUsd, rate) : formatUsd(totalCost.transcriptionUsd)}
				</p>
			</article>
			<article class="rounded-2xl bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
				<p class="text-[12px] font-medium text-[#98a2b3]">총 사용 시간</p>
				<p class="mt-1 text-[24px] font-bold text-[#111827]">{formatDuration(totalTimes.sessionMs)}</p>
				<p class="mt-1 text-[12px] text-[#64748b]">기록된 대화 {measured.length}건</p>
			</article>
			<article class="rounded-2xl bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
				<p class="text-[12px] font-medium text-[#98a2b3]">총 토큰</p>
				<p class="mt-1 text-[24px] font-bold text-[#111827]">{formatTokenCount(realtimeTokenTotal(totals))}</p>
				<p class="mt-1 text-[12px] text-[#64748b]">응답 {formatTokenCount(totals.responseCount)}회</p>
			</article>
		</div>

		<div class="mt-3 grid gap-3 sm:grid-cols-2">
			<article class="rounded-2xl bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
				<p class="text-[12px] font-medium text-[#98a2b3]">내 발화 시간</p>
				<p class="mt-1 text-[18px] font-bold text-[#111827]">{formatDuration(totalTimes.userSpeechMs)}</p>
				<p class="mt-1 text-[12px] text-[#64748b]">전사된 사용자 음성</p>
			</article>
			<article class="rounded-2xl bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
				<p class="text-[12px] font-medium text-[#98a2b3]">AI 음성 시간</p>
				<p class="mt-1 text-[18px] font-bold text-[#111827]">{formatDuration(totalTimes.assistantSpeechMs)}</p>
				<p class="mt-1 text-[12px] text-[#64748b]">모델이 새로 만든 음성</p>
			</article>
		</div>

		<section class="mt-4 rounded-2xl bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
			<h2 class="text-[15px] font-bold text-[#111827]">토큰 내역</h2>
			<dl class="mt-3 divide-y divide-[#eef2f6] text-[13px]">
				<div class="flex items-center justify-between gap-3 py-2">
					<dt class="text-[#64748b]">텍스트 입력</dt>
					<dd class="font-medium text-[#111827]">
						{formatTokenCount(totalCost.freshTextTokens)}
						<span class="text-[#94a3b8]">· 캐시 {formatTokenCount(totalCost.cachedTextTokens)}</span>
					</dd>
				</div>
				<div class="flex items-center justify-between gap-3 py-2">
					<dt class="text-[#64748b]">오디오 입력</dt>
					<dd class="font-medium text-[#111827]">
						{formatTokenCount(totalCost.freshAudioTokens)}
						<span class="text-[#94a3b8]">· 캐시 {formatTokenCount(totalCost.cachedAudioTokens)}</span>
					</dd>
				</div>
				<div class="flex items-center justify-between gap-3 py-2">
					<dt class="text-[#64748b]">텍스트 출력</dt>
					<dd class="font-medium text-[#111827]">{formatTokenCount(totals.outputTextTokens)}</dd>
				</div>
				<div class="flex items-center justify-between gap-3 py-2">
					<dt class="text-[#64748b]">오디오 출력</dt>
					<dd class="font-medium text-[#111827]">{formatTokenCount(totals.outputAudioTokens)}</dd>
				</div>
				<div class="flex items-center justify-between gap-3 py-2">
					<dt class="text-[#64748b]">전사 오디오</dt>
					<dd class="font-medium text-[#111827]">{formatTokenCount(totals.transcriptionAudioTokens)}</dd>
				</div>
			</dl>
		</section>

		<section class="mt-8">
			<div class="flex items-end justify-between gap-3">
				<h2 class="text-[16px] font-bold text-[#111827]">대화별 사용량</h2>
				<a class="text-[13px] font-semibold text-[#4a90e2] hover:underline" href={resolve('/')}>대화 화면</a>
			</div>
			{#if unmeasuredCount > 0}
				<p class="mt-2 text-[12px] text-[#64748b]">
					사용량이 없는 이전 대화 {unmeasuredCount}건은 합계에 포함되지 않습니다.
				</p>
			{/if}

			<div class="mt-3 space-y-3">
				{#if data.conversations.length === 0}
					<p class="rounded-2xl bg-white px-4 py-8 text-center text-[13px] text-[#9ca3af] shadow-sm">
						저장된 대화가 없습니다.
					</p>
				{:else}
					{#each data.conversations as item (item.id)}
						{@const usage = item.usage}
						{@const measuredItem = usage && (hasMeasuredUsage(usage) || usage.durationMs > 0)}
						<article class="rounded-2xl bg-white px-4 py-4 shadow-[0_12px_32px_rgba(15,23,42,0.06)]">
							<div class="flex items-start justify-between gap-3">
								<div>
									<p class="text-[14px] font-bold text-[#111827]">영어회화</p>
									<p class="mt-0.5 text-[12px] text-[#6b7280]">{formatSavedDateLong(item.savedAt)}</p>
								</div>
								{#if measuredItem && usage}
									{@const itemUsd = estimateCost(usage).totalUsd}
									<div class="text-right">
										<p class="text-[15px] font-bold text-[#1d4ed8]">
											{rate ? formatKrw(itemUsd, rate) : formatUsd(itemUsd)}
										</p>
										{#if rate}
											<p class="text-[11px] text-[#64748b]">{formatUsd(itemUsd)}</p>
										{/if}
									</div>
								{/if}
							</div>
							{#if measuredItem && usage}
								{@const times = usageTimes(usage)}
								<p class="mt-3 text-[13px] font-medium text-[#1e293b]">
									사용 시간 {formatDuration(times.sessionMs)}
								</p>
								<p class="mt-1 text-[12px] leading-relaxed text-[#64748b]">
									내 발화 {formatDuration(times.userSpeechMs)}
									· AI 음성 {formatDuration(times.assistantSpeechMs)}
									· 토큰 {formatTokenCount(realtimeTokenTotal(usage))}
									· 응답 {formatTokenCount(usage.responseCount)}회
								</p>
							{:else}
								<p class="mt-3 text-[13px] text-[#9ca3af]">이 대화는 사용량이 저장되기 전에 만들어졌습니다.</p>
							{/if}
						</article>
					{/each}
				{/if}
			</div>
		</section>

		<p class="mt-6 text-[12px] leading-relaxed text-[#94a3b8]">
			예상 요금은 OpenAI 공개 단가로 계산한 값입니다. 원화는
			{#if data.exchange}
				{data.exchange.date || '최근'} USD/KRW 기준환율 1달러당 {data.exchange.rate.toLocaleString('ko-KR')}원으로 환산했습니다.
			{:else}
				환율을 불러오지 못해 이번에는 달러만 표시합니다.
			{/if}
			입력 토큰에는 이전 대화 맥락이 포함되므로 발화 시간보다 사용량이 클 수 있고, 실제 청구 환율·청구서와 차이가 날 수 있습니다.
		</p>
	</section>
</main>
