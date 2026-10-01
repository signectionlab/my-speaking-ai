<script>
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	let { user } = $props();

	const pathname = $derived(page.url.pathname);
</script>

<header class="sticky top-0 z-30 border-b border-[#e2e8f0] bg-white/80 backdrop-blur">
	<nav class="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
		<a
			class="flex items-center gap-2 text-[15px] font-bold tracking-tight text-black"
			href={resolve('/')}
		>
			<span
				class="flex h-8 w-8 items-center justify-center rounded-xl bg-[#4a90e2] text-white shadow-sm"
				aria-hidden="true"
			>
				<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<rect x="9" y="2" width="6" height="12" rx="3" />
					<path d="M5 10a7 7 0 0 0 14 0" />
					<path d="M12 17v4" />
					<path d="M8 21h8" />
				</svg>
			</span>
			<span class="hidden sm:inline">실시간 AI 영어 회화</span>
			<span class="sm:hidden">AI 영어 회화</span>
		</a>

		<div class="flex items-center gap-3">
			{#if user}
				<span class="hidden max-w-[160px] truncate text-[13px] text-[#6b7280] sm:inline">
					{user.email}
				</span>
				<form method="POST" action="/logout">
					<button
						type="submit"
						class="rounded-lg border border-[#d1d5db] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#334155] transition hover:border-[#94a3b8] hover:bg-[#f8fafc]"
					>
						로그아웃
					</button>
				</form>
			{:else if pathname === '/login'}
				<a
					class="rounded-lg bg-[#4a90e2] px-3 py-1.5 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#3b7fcf]"
					href={resolve('/signup')}
				>
					회원가입
				</a>
			{:else if pathname === '/signup'}
				<a
					class="rounded-lg border border-[#d1d5db] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#334155] transition hover:border-[#94a3b8] hover:bg-[#f8fafc]"
					href={resolve('/login')}
				>
					로그인
				</a>
			{/if}
		</div>
	</nav>
</header>
