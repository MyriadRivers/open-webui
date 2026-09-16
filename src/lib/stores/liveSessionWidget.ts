import { writable } from "svelte/store";
import { type MetricDelta, type ParsedWidgetEvent, type SessionStatus, type StepDelta } from "$lib/apis/live_session_widget";

type WidgetStatus = 'starting' | 'streaming' | 'complete' | 'error';

interface WidgetState {
    status: WidgetStatus;
    stepOrder: string[];
    steps: Record<string, StepDelta>;
    metrics: Record<string, MetricDelta>;
};

interface SessionState {
    sessionStatus: SessionStatus;
    activeViewers: number;
}

const createInitialWidgetState = (): WidgetState => ({
    status: 'starting',
    stepOrder: [],
    steps: {},
    metrics: {}
});

const reduceWidgetEvent = (state: WidgetState, event: "step" | "metric" | "done" | "error", parsed: ParsedWidgetEvent): WidgetState => {
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

export const dispatchWidgetEvent = (key: string, event: "step" | "metric" | "done" | "error", parsed: ParsedWidgetEvent) => {
    if (!parsed) return;
    widgetStore.update((store) => ({
        ...store,
        [key]: reduceWidgetEvent(store[key] ?? createInitialWidgetState(), event, parsed)
    }));
}

export const widgetStore = writable<Record<string, WidgetState>>({});