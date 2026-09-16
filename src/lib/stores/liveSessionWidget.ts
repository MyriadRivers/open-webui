import { writable } from "svelte/store";
import { type MetricDelta, type WidgetEvent, type StepDelta } from "$lib/apis/live_session_widget/sse";
import { type SessionPresenceEvent, type SessionStatusEvent, type SessionStatus } from "$lib/apis/live_session_widget/socket";

type WidgetStatus = 'starting' | 'streaming' | 'complete' | 'error';

interface WidgetState {
    status: WidgetStatus;
    stepOrder: string[];
    steps: Record<string, StepDelta>;
    metrics: Record<string, MetricDelta>;
};

const createInitialWidgetState = (): WidgetState => ({
    status: 'starting',
    stepOrder: [],
    steps: {},
    metrics: {}
});

const reduceWidgetEvent = (state: WidgetState, event: "step" | "metric" | "done" | "error", parsed: WidgetEvent): WidgetState => {
    // Ignore further events if the session is already complete or errored
    if (state.status === 'complete' || state.status === 'error') return state;
    if (event === "done") {
        return {
            ...state,
            status: 'complete'
        };
    }
    if (event === "error") {
        return {
            ...state,
            status: 'error'
        };
    }
    if (event === "step") {
        const parsedStep = parsed as StepDelta;
        const existingStep = state.steps[parsedStep.id];
        return {
            ...state,
            status: parsedStep.status === 'error' ? 'error' : 'streaming',
            steps: {
                ...state.steps,
                [parsedStep.id]: { ...existingStep, ...parsedStep }
            },
            stepOrder: existingStep ? state.stepOrder : [...state.stepOrder, parsedStep.id]
        };
    }
    const parsedMetric = parsed as MetricDelta;
    const existingMetric = state.metrics[parsedMetric.key];
    return {
        ...state,
        status: 'streaming',
        metrics: {
            ...state.metrics,
            [parsedMetric.key]: { ...existingMetric, ...parsedMetric }
        }
    };
}

export const dispatchWidgetEvent = (key: string, event: "step" | "metric" | "done" | "error", parsed: WidgetEvent) => {
    if (!parsed) return;
    widgetStore.update((store) => ({
        ...store,
        [key]: reduceWidgetEvent(store[key] ?? createInitialWidgetState(), event, parsed)
    }));
}

// Keyed by chatId and messageId, stores widget state for every active widget
export const widgetStore = writable<Record<string, WidgetState>>({});

interface SessionState {
    sessionStatus: SessionStatus;
    activeViewers: number;
}

const reduceSessionPresenceEvent = (state: SessionState, parsed: any): SessionState => {
    return {
        ...state,
        activeViewers: parsed.activeViewers
    };
}

const reduceSessionStatusEvent = (state: SessionState, parsed: any): SessionState => {
    return {
        ...state,
        sessionStatus: parsed.status
    };
}

export const dispatchPresence = (parsed: SessionPresenceEvent) => {
    const key = parsed.chatId;
    if (!parsed) return;
    sessionStore.update((store) => ({
        ...store,
        [key]: reduceSessionPresenceEvent(store[key] ?? { sessionStatus: 'complete', activeViewers: 1 }, parsed)
    }));
}

export const dispatchSessionStatus = (parsed: SessionStatusEvent) => {
    const key = parsed.chatId;
    if (!parsed) return;
    sessionStore.update((store) => ({
        ...store,
        [key]: reduceSessionStatusEvent(store[key] ?? { sessionStatus: 'complete', activeViewers: 1 }, parsed)
    }));
}

// Keyed only by chatId, stores session state for every active chat session.
// Our widget will only display the session state for the currently viewed chat though
export const sessionStore = writable<Record<string, SessionState>>({});