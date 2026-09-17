<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { widgetStore, sessionStore, dispatchWidgetEvent, startNewWidgetForChat, abortedMessageIds, registerConnection } from '$lib/stores/liveSessionWidget';
  import { generateWidgetStream } from '$lib/apis/live_session_widget/sse';
  import { reportSessionStatus } from '$lib/apis/live_session_widget/socket';
  import { connectionState } from '$lib/stores';

  export let chatId: string;
  export let messageId: string;
  export let done: boolean = false;

  const key = `${chatId}:${messageId}`;

  $: widgetState = $widgetStore[key];
  $: sessionState = $sessionStore[chatId];
 
  let lastReportedStatus: string | undefined;
 
  $: if (widgetState && widgetState.status !== lastReportedStatus) {
    lastReportedStatus = widgetState.status;
    if (widgetState.status === 'streaming' || widgetState.status === 'complete' || widgetState.status === 'error') {
      reportSessionStatus(chatId, widgetState.status);
    }
  }

  $: displayStatus = widgetState?.status ?? sessionState.sessionStatus ?? 'starting';

  let stopStream: () => void;

  // Stopping generation will be treated as the steps erroring. 
  $: if ($abortedMessageIds.has(key)) {
	stopStream?.();
	widgetStore.update((states) => ({
		...states,
		[key]: { ...states[key], status: 'error'}
	}));
	reportSessionStatus(chatId, 'error');
  }

  onMount(async () => {
	const key = `${chatId}:${messageId}`;
	const existing = widgetState;
	if (!existing && !done) {
		startNewWidgetForChat(chatId, messageId);
		stopStream = await generateWidgetStream(messageId, 'http://localhost:4000', (parsed) => {
			dispatchWidgetEvent(key, parsed.type, parsed)
		})
		registerConnection(key, stopStream);
	}
  });

  onDestroy(() => {
  })

</script>

{#if widgetState}
	<div class="rounded-lg border border-gray-200 dark:border-gray-800 p-3 text-sm">
		<div class="flex items-center justify-between mb-2">
			<span class="font-medium">
				{#if displayStatus === 'starting'}Starting…
				{:else if displayStatus === 'streaming'}Generating…
				{:else if displayStatus === 'complete'}Done
				{:else}Error{/if}
			</span>
			{#if sessionState}
				<span class="text-xs text-gray-500" aria-label={sessionState.sessionStatus ? 'Connected' : 'Offline'}>
					{#if $connectionState === 'connected'}🟢
  						{:else if $connectionState === 'reconnecting'}🟡
  						{:else}🔴
					{/if} · {sessionState.activeViewers} viewing
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
		{#if sessionState?.activeViewers !== undefined}
			<span class="text-xs text-gray-500">
				{sessionState.activeViewers} {sessionState.activeViewers === 1 ? 'viewer' : 'viewers'}
			</span>
		{/if}
	</div>
{/if}