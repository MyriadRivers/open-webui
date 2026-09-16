<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { widgetStore, sessionStore } from '$lib/stores/liveSessionWidget';
  import { generateWidgetStream } from '$lib/apis/live_session_widget/sse';
  import { socketConnected } from '$lib/stores';
  import { WEBUI_BASE_URL } from '$lib/constants';

  export let chatId: string;
  export let messageId: string;

  const key = `${chatId}:${messageId}`;

  $: widgetState = $widgetStore[key];
  $: sessionState = $sessionStore[chatId];
  let stopStream: () => void;

  onMount(async () => {
	stopStream = await generateWidgetStream(chatId, messageId, 'http://localhost:4000')
  });

  onDestroy(() => {
	stopStream?.();
	widgetStore.update(({ [key]: _removed, ...rest }) => rest)
  })

</script>

{#if widgetState}
	<div class="rounded-lg border border-gray-200 dark:border-gray-800 p-3 text-sm">
		<div class="flex items-center justify-between mb-2">
			<span class="font-medium">
				{#if widgetState.status === 'starting'}Starting…
				{:else if widgetState.status === 'streaming'}Generating…
				{:else if widgetState.status === 'complete'}Done
				{:else}Error{/if}
			</span>
			{#if sessionState}
				<span class="text-xs text-gray-500" aria-label={$socketConnected ? 'Connected' : 'Offline'}>
					{$socketConnected ? '🟢' : '🔴'} · {sessionState.activeViewers} viewing
				</span>
			{/if}
		</div>
		<ul aria-live="polite" class="space-y-1">
			{#each widgetState.stepOrder as id (id)}
				{@const step = widgetState.steps[id]}
				<li class="flex items-center gap-2">
				<span>{step.status === 'complete' ? '✅' : step.status === 'error' ? '⚠️' : '⏳'}</span>
				<span>{step.label ?? id}</span>
				</li>
			{/each}
		</ul>
		{#if Object.keys(widgetState.metrics).length}
			<div class="mt-2 flex gap-3 text-xs text-gray-500">
				{#each Object.entries(widgetState.metrics) as [k, m] (k)}
					<span>{m.label ?? k}: {m.value}</span>
				{/each}
			</div>
		{/if}
	</div>
{/if}