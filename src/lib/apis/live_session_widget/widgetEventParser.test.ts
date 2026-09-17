import { describe, it, expect } from 'vitest';
import { parseWidgetEvent, type StepDelta, type MetricDelta } from './sse';

describe('parseWidgetEvent', () => {
  it('parses a valid step delta', () => {
    const result = parseWidgetEvent({
      event: 'widget_delta',
      data: JSON.stringify({ 
        messageId: 'm1', 
        type: 'step', 
        id: 'retrieval', 
        label: 'Searching', 
        status: 'running' 
      })
    });

    const expected: StepDelta = {
      messageId: 'm1',
      type: 'step', 
      id: 'retrieval', 
      label: 'Searching', 
      status: 'running' 
    }

    expect(result).toEqual(expected);
  });

  it('parses a widget step update with extraneous props', () => {
    const result = parseWidgetEvent({
      event: 'widget_delta',
      data: JSON.stringify({ 
        messageId: 'm3', 
        type: 'step', 
        id: 'tool_call',
        prop1: 'extra data', 
        label: 'Querying calculator tool', 
        status: 'running',
        prop2: 'extra data'
      })
    });

    const expected: StepDelta = {
      messageId: 'm3',
      type: 'step', 
      id: 'tool_call', 
      label: 'Querying calculator tool', 
      status: 'running' 
    }

    expect(result).toEqual(expected);
  });

  it('parses a partial step update missing label', () => {
    const result = parseWidgetEvent({
      event: 'widget_delta',
      data: JSON.stringify({ 
        messageId: 'm1', 
        type: 'step', 
        id: 'retrieval', 
        status: 'complete' 
      })
    });
    expect(result).not.toHaveProperty('label');
  });

  it('returns null on malformed JSON', () => {
    const result = parseWidgetEvent({ 
      event: 'widget_delta', 
      data: '{not valid json' }
    );
    expect(result).toBeNull();
  });

  it('returns null on missing messageId', () => {
    const result = parseWidgetEvent({ 
      event: 'widget_delta', 
      data: JSON.stringify({ 
        type: 'step', 
        id: 'x' 
      }) 
    });
    expect(result).toBeNull();
  });

  it('returns null on unrecognized event name', () => {
    const result = parseWidgetEvent({ 
      event: 'something_else', 
      data: JSON.stringify({
        messageId: 'm1', 
        type: 'step', 
        id: 'retrieval', 
        label: 'Searching', 
        status: 'running' 
      }) 
    });
    expect(result).toBeNull();
  });

  it('parses widget_metric', () => {
    const result = parseWidgetEvent({
      event: 'widget_delta',
      data: JSON.stringify({ 
        messageId: 'm2', 
        type: 'metric', 
        key: 'sources', 
        label: 'Sources',
        value: 5
      })
    });

    const expected: MetricDelta = {
      messageId: 'm2', 
      type: 'metric', 
      key: 'sources', 
      label: 'Sources',
      value: 5 
    }

    expect(result).toEqual(expected);
  });

  it('parses a partial metric update missing label', () => {
    const result = parseWidgetEvent({
      event: 'widget_delta',
      data: JSON.stringify({ 
        messageId: 'm2', 
        type: 'metric', 
        key: 'sources', 
        value: 12
      })
    });
    expect(result).not.toHaveProperty('label');
  });

  it('parses widget_done', () => {
    const result = parseWidgetEvent({ 
      event: 'widget_done', 
      data: JSON.stringify({ 
        messageId: 'm1' 
      })
    });
    expect(result).toEqual({ type: 'done', messageId: 'm1' });
  });
});