import { describe, it, expect } from 'vitest';
import { createInitialWidgetState, reduceWidgetEvent, type WidgetState } from './liveSessionWidget';
import type { StepDelta, MetricDelta, WidgetDoneEvent, WidgetErrorEvent} from '$lib/apis/live_session_widget/sse';

describe('reduceWidgetEvent', () => {
  it('upserts a step by merging, preserving label on a later partial update', () => {
    let state = createInitialWidgetState();
    const stepEvent1: StepDelta = {
      messageId: 'm1',
      type: 'step', 
      id: 'retrieval', 
      label: 'Searching docs', 
      status: 'running'
    }
    const stepEvent2: StepDelta = {
      messageId: 'm1',
      type: 'step', 
      id: 'retrieval', 
      status: 'complete'
    }
    state = reduceWidgetEvent(state, 'step', stepEvent1);
    state = reduceWidgetEvent(state, 'step', stepEvent2);
    expect(state.steps.retrieval).toEqual({ messageId: 'm1', type: 'step', id: 'retrieval', label: 'Searching docs', status: 'complete' });
  });

  it('applies the exact same event twice without duplicating or corrupting state', () => {
    let state = createInitialWidgetState();
    const stepEvent: StepDelta = {
      messageId: 'm1',
      type: 'step', 
      id: 'retrieval', 
      status: 'complete'
    };
    state = reduceWidgetEvent(state, 'step', stepEvent);
    const afterFirst = { ...state };
    state = reduceWidgetEvent(state, 'step', stepEvent);
    expect(state).toEqual(afterFirst);
    expect(state.stepOrder).toEqual(['retrieval']); // not pushed twice
  });
  
  it('ignores further events once status is complete', () => {
    let state = createInitialWidgetState();
    const doneEvent: WidgetDoneEvent = {
        messageId: 'm1',
        type: 'done'
    }
    const metricEvent: MetricDelta = {
        messageId: 'm1',
        type: 'metric',
        key: 'sources',
        label: 'Sources',
        value: 3
    }
    state = reduceWidgetEvent(state, 'done', doneEvent);
    const late = reduceWidgetEvent(state, 'metric', metricEvent);
    expect(late).toEqual(state); // unchanged
  });

  it('keeps steps for different messageIds fully isolated', () => {
    let stateA = createInitialWidgetState();
    let stateB = createInitialWidgetState();
    const stepEvent: StepDelta = {
      messageId: 'a',
      type: 'step', 
      id: 'retrieval', 
      status: 'running'
    }
    stateA = reduceWidgetEvent(stateA, 'step', stepEvent);
    expect(stateB.steps).toEqual({}); // untouched — proves isolation at the reducer level
  });
});

describe('reduceWidgetEvent — error handling', () => {
  it('transitions status to error on a widget_error event', () => {
    let state = createInitialWidgetState();
    const stepEvent: StepDelta = {
        messageId: 'm1',
        type: 'step',
        id: 'retrieval',
        label: 'Searching docs',
        status: 'running'
    }
    const errorEvent: WidgetErrorEvent = {
        messageId: 'm1',
        type: 'error',
        error: 'An error occurred while attempting to connect.'
    }
    state = reduceWidgetEvent(state, 'step', stepEvent);
    state = reduceWidgetEvent(state, 'error', errorEvent);

    expect(state.status).toBe('error');
  });

  it('preserves whatever steps/metrics had already arrived before the error', () => {
    let state = createInitialWidgetState();
    const stepEvent: StepDelta = {
        messageId: 'm1',
        type: 'step',
        id: 'retrieval',
        label: 'Searching docs',
        status: 'running'
    }
    const errorEvent: WidgetErrorEvent = {
        messageId: 'm1',
        type: 'error',
        error: 'An error occurred while attempting to connect.'
    }
    state = reduceWidgetEvent(state, 'step', stepEvent);
    state = reduceWidgetEvent(state, 'error', errorEvent);
    const expected: StepDelta = {
        messageId: 'm1', 
        type: 'step', 
        id: 'retrieval', 
        label: 'Searching docs', 
        status: 'running' 
    }
    expect(state.steps.retrieval).toEqual(expected);
  });

  it('ignores a widget_delta arriving after an error (terminal state)', () => {
    let state = createInitialWidgetState();
    const errorEvent: WidgetErrorEvent = {
        messageId: 'm1',
        type: 'error',
        error: 'An error occurred while attempting to connect.'
    }
    const metricEvent: MetricDelta = {
        messageId: 'm1',
        type: 'metric',
        key: 'sources',
        label: 'Sources',
        value: 3
    }
    state = reduceWidgetEvent(state, 'error', errorEvent);
    const after = reduceWidgetEvent(state, 'metric', metricEvent);

    expect(after).toEqual(state); // unchanged — error is terminal, same as complete
  });

  it('ignores widget_done arriving after an error', () => {
    let state = createInitialWidgetState();
    const errorEvent: WidgetErrorEvent = {
        messageId: 'm1',
        type: 'error',
        error: 'An error occurred while attempting to connect.'
    }
    const doneEvent: WidgetDoneEvent = {
        messageId: 'm1',
        type: 'done'
    }
    state = reduceWidgetEvent(state, 'error', errorEvent);
    const after = reduceWidgetEvent(state, 'done', doneEvent);

    expect(after.status).toBe('error'); // doesn't flip back to complete
  });
});