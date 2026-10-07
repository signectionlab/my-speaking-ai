<script>
	let { title, description, children } = $props();
</script>

<main class="px-4 py-10">
	<section class="mx-auto w-full max-w-md">
		<div
			class="overflow-hidden rounded-[28px] bg-white px-8 pb-10 pt-9 shadow-[0_20px_50px_rgba(15,23,42,0.08)]"
		>
			<header class="text-center">
				<h1 class="text-[22px] font-bold tracking-tight text-black">{title}</h1>
				<p class="mt-2 text-[15px] leading-relaxed text-[#4b5563]">{description}</p>
			</header>
			<div class="mt-8">
				{@render children()}
			</div>
		</div>
	</section>
</main>
