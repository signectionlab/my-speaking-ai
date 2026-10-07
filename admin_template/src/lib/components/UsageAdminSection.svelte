<script>
	import { goto } from '$app/navigation';
	import { formatSavedDateLong } from '$lib/realtime/formatSavedDate.js';
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

	/** @type {import('$lib/server/profiles.js').ProfileRow[]} */
	export let profiles = [];

	/** @type {import('$lib/server/conversationUsage.js').UserUsageAggregate[]} */
	export let byUser = [];

	/** @type {import('$lib/server/conversationUsage.js').ConversationUsageItem[]} */
	export let selectedConversations = [];

	/** @type {string} */
	export let selectedUserId = '';

	/** @type {boolean} */
	export let usageReady = true;

	/** @type {string | null} */
	export let usageError = null;

	/** @type {string | null} */
	export let usageAccessError = null;

	/** @type {{ rate: number, date: string } | null} */
	export let exchange = null;

	/** @type {number} */
	export let rowsLoaded = 0;

	/** @type {Map<string, import('$lib/server/profiles.js').ProfileRow>} */
	$: profileById = new Map(profiles.map((profile) => [profile.id, profile]));

	$: selectedAggregate =
		byUser.find((item) => item.userId === selectedUserId) ??
		/** @type {import('$lib/server/conversationUsage.js').UserUsageAggregate | null} */ (null);

	$: measuredConversations = selectedConversations.filter(
		(item) => item.usage && (hasMeasuredUsage(item.usage) || item.usage.durationMs > 0)
	);

	$: selectedUsage = selectedAggregate?.usage ?? sumUsages([]);
	$: selectedCost = estimateCost(selectedUsage);
	$: selectedTimes = usageTimes(selectedUsage);
	$: rate = exchange?.rate ?? 0;

	/** @param {import('$lib/server/profiles.js').ProfileRow} profile */
	function profileLabel(profile) {
		const name = profile.display_name?.trim();
		if (name) return `${name} (${profile.email})`;
		return profile.email;
	}

	/** @param {string} userId */
	function labelForUserId(userId) {
		const profile = profileById.get(userId);
		if (!profile) return userId.slice(0, 8);
		return profileLabel(profile);
	}

	/** @param {Event} event */
	function onUserChange(event) {
		const value = /** @type {HTMLSelectElement} */ (event.currentTarget).value;
		const url = new URL(window.location.href);
		if (value) {
			url.searchParams.set('usageUser', value);
		} else {
			url.searchParams.delete('usageUser');
		}
		goto(`${url.pathname}${url.search}`, { keepFocus: true, noScroll: true });
	}

	/** @param {import('$lib/server/conversationUsage.js').ConversationUsageItem} item */
	function itemCostUsd(item) {
		if (item.storedCostUsd > 0) return item.storedCostUsd;
		if (!item.usage) return 0;
		return estimateCost(item.usage).totalUsd;
	}
</script>

<section class="usage-section">
	<header class="usage-header">
		<div>
			<h2 class="usage-title">API 사용량</h2>
			<p class="usage-desc">
				{REALTIME_MODEL} 대화 토큰과 {TRANSCRIPTION_MODEL} 전사 기준 예상 요금입니다. 사용자를 선택해
				대화별 내역을 확인하세요.
			</p>
		</div>
		{#if rowsLoaded > 0}
			<p class="usage-meta">전체 대화 {rowsLoaded.toLocaleString('ko-KR')}건</p>
		{/if}
	</header>

	{#if usageAccessError}
		<p class="banner warn" role="status">{usageAccessError}</p>
	{:else if usageError}
		<p class="banner error" role="alert">{usageError}</p>
	{:else if !usageReady}
		<p class="banner warn" role="status">
			사용량 저장 열이 아직 없습니다. 서비스 DB에
			<code>007_conversation_usage.sql</code>
			·
			<code>008_conversation_usage_billing.sql</code>
			을 적용하면 이후 대화부터 사용량이 쌓입니다.
		</p>
	{/if}

	<div class="user-picker">
		<label for="usage-user">사용자 선택</label>
		<div class="select-wrap">
			<select id="usage-user" class="user-select" value={selectedUserId} on:change={onUserChange}>
				{#if profiles.length === 0}
					<option value="">사용자 없음</option>
				{:else}
					{#each profiles as profile (profile.id)}
						<option value={profile.id}>{profileLabel(profile)}</option>
					{/each}
				{/if}
			</select>
			<span class="select-chevron" aria-hidden="true">
				<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
					<path
						d="M6 9l6 6 6-6"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			</span>
		</div>
	</div>

	{#if selectedUserId}
		<p class="selected-user">
			<span class="selected-label">조회 중</span>
			{labelForUserId(selectedUserId)}
		</p>

		<div class="summary-grid usage-summary">
			<article class="stat-card accent">
				<p class="stat-label">예상 요금</p>
				<p class="stat-value accent">
					{rate ? formatKrw(selectedCost.totalUsd, rate) : formatUsd(selectedCost.totalUsd)}
				</p>
				<p class="stat-sub">{formatUsd(selectedCost.totalUsd)}</p>
				<p class="stat-sub">
					대화 {rate ? formatKrw(selectedCost.realtimeUsd, rate) : formatUsd(selectedCost.realtimeUsd)}
					· 전사 {rate ? formatKrw(selectedCost.transcriptionUsd, rate) : formatUsd(selectedCost.transcriptionUsd)}
				</p>
			</article>
			<article class="stat-card">
				<p class="stat-label">사용 시간</p>
				<p class="stat-value">{formatDuration(selectedTimes.sessionMs)}</p>
				<p class="stat-sub">
					대화 {selectedAggregate?.conversationCount ?? 0}건 · 측정 {selectedAggregate?.measuredCount ?? 0}건
				</p>
			</article>
			<article class="stat-card">
				<p class="stat-label">토큰</p>
				<p class="stat-value">{formatTokenCount(realtimeTokenTotal(selectedUsage))}</p>
				<p class="stat-sub">응답 {formatTokenCount(selectedUsage.responseCount)}회</p>
			</article>
		</div>

		<div class="summary-grid usage-summary secondary">
			<article class="stat-card">
				<p class="stat-label">사용자 발화</p>
				<p class="stat-value sm">{formatDuration(selectedTimes.userSpeechMs)}</p>
			</article>
			<article class="stat-card">
				<p class="stat-label">AI 음성</p>
				<p class="stat-value sm">{formatDuration(selectedTimes.assistantSpeechMs)}</p>
			</article>
		</div>

		<section class="token-panel">
			<h3>토큰 내역</h3>
			<dl>
				<div>
					<dt>텍스트 입력</dt>
					<dd>
						{formatTokenCount(selectedCost.freshTextTokens)}
						<span class="muted">· 캐시 {formatTokenCount(selectedCost.cachedTextTokens)}</span>
					</dd>
				</div>
				<div>
					<dt>오디오 입력</dt>
					<dd>
						{formatTokenCount(selectedCost.freshAudioTokens)}
						<span class="muted">· 캐시 {formatTokenCount(selectedCost.cachedAudioTokens)}</span>
					</dd>
				</div>
				<div>
					<dt>텍스트 출력</dt>
					<dd>{formatTokenCount(selectedUsage.outputTextTokens)}</dd>
				</div>
				<div>
					<dt>오디오 출력</dt>
					<dd>{formatTokenCount(selectedUsage.outputAudioTokens)}</dd>
				</div>
				<div>
					<dt>전사 오디오</dt>
					<dd>{formatTokenCount(selectedUsage.transcriptionAudioTokens)}</dd>
				</div>
			</dl>
		</section>

		<section class="conv-section">
			<h3>대화별 사용량</h3>
			{#if selectedConversations.length === 0}
				<p class="empty-card">저장된 대화가 없습니다.</p>
			{:else}
				<div class="conv-list">
					{#each selectedConversations as item (item.id)}
						{@const usage = item.usage}
						{@const measured = usage && (hasMeasuredUsage(usage) || usage.durationMs > 0)}
						<article class="conv-card">
							<div class="conv-head">
								<div>
									<p class="conv-title">영어회화</p>
									<p class="conv-date">{formatSavedDateLong(item.savedAt)}</p>
								</div>
								{#if measured && usage}
									{@const usd = itemCostUsd(item)}
									<div class="conv-cost">
										<p>{rate ? formatKrw(usd, rate) : formatUsd(usd)}</p>
										{#if rate}
											<p class="muted">{formatUsd(usd)}</p>
										{/if}
									</div>
								{/if}
							</div>
							{#if measured && usage}
								{@const times = usageTimes(usage)}
								<p class="conv-meta">
									사용 {formatDuration(times.sessionMs)} · 발화 {formatDuration(times.userSpeechMs)} · AI
									{formatDuration(times.assistantSpeechMs)} · 토큰 {formatTokenCount(realtimeTokenTotal(usage))}
								</p>
							{:else}
								<p class="conv-meta muted">사용량 기록 없음</p>
							{/if}
						</article>
					{/each}
				</div>
				{#if selectedConversations.length - measuredConversations.length > 0}
					<p class="conv-foot">
						사용량 없는 이전 대화 {selectedConversations.length - measuredConversations.length}건은 합계에서
						제외됩니다.
					</p>
				{/if}
			{/if}
		</section>
	{/if}

	<p class="footnote">
		예상 요금은 OpenAI 공개 단가 기준입니다.
		{#if exchange}
			{exchange.date || '최근'} USD/KRW {exchange.rate.toLocaleString('ko-KR')}원 환산을 함께 표시합니다.
		{/if}
	</p>
</section>

<style>
	.usage-section {
		margin-top: 2rem;
	}

	.usage-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 1rem;
		margin-bottom: 1rem;
		flex-wrap: wrap;
	}

	.usage-title {
		font-size: 1.25rem;
		font-weight: 700;
		color: #1e293b;
	}

	.usage-desc {
		margin: 0.35rem 0 0;
		font-size: 0.875rem;
		color: #64748b;
		max-width: 42rem;
		line-height: 1.5;
	}

	.usage-meta {
		margin: 0;
		font-size: 0.8125rem;
		color: #94a3b8;
	}

	.banner {
		border-radius: 8px;
		padding: 0.75rem 1rem;
		margin-bottom: 1rem;
		font-size: 0.875rem;
		line-height: 1.5;
	}

	.banner.error {
		background: #fef2f2;
		color: #b91c1c;
		border: 1px solid #fecaca;
	}

	.banner.warn {
		background: #fff7ed;
		color: #9a3412;
		border: 1px solid #fed7aa;
	}

	.banner code {
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.user-picker {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		margin-bottom: 0.75rem;
		width: 100%;
		max-width: 36rem;
	}

	.user-picker label {
		font-size: 0.8125rem;
		font-weight: 600;
		color: #475569;
	}

	.select-wrap {
		position: relative;
		display: block;
		width: 100%;
	}

	.user-select {
		display: block;
		width: 100%;
		box-sizing: border-box;
		min-height: 2.75rem;
		padding: 0.625rem 2.75rem 0.625rem 0.875rem;
		border-radius: 8px;
		border: 1px solid #cbd5e1;
		background: #fff;
		font-size: 0.875rem;
		line-height: 1.35;
		color: #1e293b;
		cursor: pointer;
		appearance: none;
		-webkit-appearance: none;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
	}

	.user-select:hover {
		border-color: #94a3b8;
	}

	.user-select:focus {
		outline: none;
		border-color: #60a5fa;
		box-shadow: 0 0 0 3px rgb(96 165 250 / 25%);
	}

	.select-chevron {
		position: absolute;
		top: 1px;
		right: 1px;
		bottom: 1px;
		width: 2.5rem;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
		color: #64748b;
		background: linear-gradient(to left, #fff 70%, rgb(255 255 255 / 0));
		border-left: 1px solid #e2e8f0;
		border-radius: 0 7px 7px 0;
	}

	.select-wrap:focus-within .select-chevron {
		border-left-color: #bfdbfe;
		color: #1d4ed8;
	}

	.selected-user {
		margin: 0 0 1rem;
		font-size: 0.875rem;
		color: #64748b;
	}

	.selected-label {
		display: inline-block;
		margin-right: 0.35rem;
		padding: 0.1rem 0.45rem;
		border-radius: 999px;
		background: #dbeafe;
		color: #1d4ed8;
		font-size: 0.6875rem;
		font-weight: 700;
	}

	.summary-grid.usage-summary {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 0.75rem;
		margin-bottom: 0.75rem;
	}

	.summary-grid.secondary {
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		margin-bottom: 1rem;
	}

	.stat-card {
		background: white;
		border-radius: 16px;
		padding: 1rem 1.1rem;
		box-shadow: 0 12px 32px rgb(15 23 42 / 6%);
	}

	.stat-label {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 500;
		color: #98a2b3;
	}

	.stat-value {
		margin: 0.25rem 0 0;
		font-size: 1.5rem;
		font-weight: 700;
		color: #111827;
	}

	.stat-value.sm {
		font-size: 1.125rem;
	}

	.stat-value.accent {
		color: #1d4ed8;
	}

	.stat-sub {
		margin: 0.2rem 0 0;
		font-size: 0.75rem;
		color: #64748b;
	}

	.token-panel {
		background: white;
		border-radius: 16px;
		padding: 1rem 1.1rem;
		box-shadow: 0 12px 32px rgb(15 23 42 / 6%);
		margin-bottom: 1.25rem;
	}

	.token-panel h3 {
		margin: 0 0 0.5rem;
		font-size: 0.9375rem;
		color: #111827;
	}

	.token-panel dl {
		margin: 0;
		font-size: 0.8125rem;
	}

	.token-panel dl div {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.35rem 0;
		border-bottom: 1px solid #eef2f6;
	}

	.token-panel dt {
		color: #64748b;
	}

	.token-panel dd {
		margin: 0;
		font-weight: 500;
		color: #111827;
	}

	.conv-section h3 {
		margin: 0 0 0.75rem;
		font-size: 1rem;
		color: #1e293b;
	}

	.conv-list {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
	}

	.conv-card {
		background: white;
		border-radius: 16px;
		padding: 1rem 1.1rem;
		box-shadow: 0 12px 32px rgb(15 23 42 / 6%);
	}

	.conv-head {
		display: flex;
		justify-content: space-between;
		gap: 0.75rem;
	}

	.conv-title {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 700;
		color: #111827;
	}

	.conv-date {
		margin: 0.2rem 0 0;
		font-size: 0.75rem;
		color: #6b7280;
	}

	.conv-cost {
		text-align: right;
		font-size: 0.9375rem;
		font-weight: 700;
		color: #1d4ed8;
	}

	.conv-meta {
		margin: 0.65rem 0 0;
		font-size: 0.8125rem;
		color: #64748b;
		line-height: 1.45;
	}

	.conv-foot {
		margin: 0.75rem 0 0;
		font-size: 0.75rem;
		color: #94a3b8;
	}

	.empty-card {
		background: white;
		border-radius: 16px;
		padding: 2rem 1rem;
		text-align: center;
		font-size: 0.8125rem;
		color: #9ca3af;
		box-shadow: 0 1px 3px rgb(0 0 0 / 8%);
	}

	.muted {
		color: #94a3b8;
		font-size: 0.75rem;
	}

	.footnote {
		margin: 1.25rem 0 0;
		font-size: 0.75rem;
		color: #94a3b8;
		line-height: 1.5;
	}
</style>
