import { dispatchWidgetEvent } from '$lib/stores/liveSessionWidget';

type StepStatus = "running" | "complete" | "error";

export interface StepDelta {
  messageId: string;
  type: "step";
  id: string;
  label?: string;
  status?: StepStatus;
}

export interface MetricDelta {
  messageId: string;
  type: "metric";
  key: string;
  label?: string;
  value: number;
}

interface WidgetDoneEvent {
  messageId: string;
}

interface WidgetErrorEvent {
  messageId: string;
  error: string;
}

type WidgetDeltaEvent = StepDelta | MetricDelta;
export type WidgetEvent = WidgetDeltaEvent | WidgetDoneEvent | WidgetErrorEvent;

// Parser type validates widget events
const parseWidgetEvent = (event: any): WidgetEvent | null => {
    if (event.event !== "widget_delta" && event.event !== "widget_done") return null;
    
    let json: any;
    try {
        json = JSON.parse(event.data);
    } catch {
        return null;
    }
    if (typeof json?.messageId !== 'string') return null;

    if (event.event === "widget_done") {
        const widgetDoneEvent: WidgetDoneEvent = {
            messageId: json.messageId
        }
        return widgetDoneEvent;
    }

    if (event.event === "widget_delta") {
        if (json.type === "step" && typeof json.id === 'string') {
            const stepDeltaEvent: StepDelta = {
                messageId: json.messageId,
                type: "step",
                id: json.id,
                ...(typeof json.label === 'string' && { label: json.label }),
                ...(typeof json.status === 'string' 
                    && (json.status === 'running' || json.status === 'complete' || json.status === 'error') 
                    && { status: json.status })
            };
            return stepDeltaEvent;
        }
        if (json.type === "metric" && typeof json.key === 'string' && typeof json.value === 'number') {
            const metricDeltaEvent: MetricDelta = {
                messageId: json.messageId,
                type: "metric",
                key: json.key,
                value: json.value,
                ...(typeof json.label === 'string' && { label: json.label })
            };
            return metricDeltaEvent;
        }
    }
    return null;
}

export const generateWidgetStream = async (
    chatId: string = '',
    messageId: string = '',
    url: string = ''
) => {
    const evtSource = new EventSource(`${url}/widget/sse_events/${messageId}`);
    const key = `${chatId}:${messageId}`;
    
    evtSource.addEventListener('widget_delta', (e) => {
        const parsed: WidgetEvent | null = parseWidgetEvent({ event: e });
        if (parsed) {
            const deltaEvent = parsed as WidgetDeltaEvent;
            dispatchWidgetEvent(key, deltaEvent.type, deltaEvent);
        }
    });

    evtSource.addEventListener('widget_done', (e) => {
        const parsed: WidgetEvent | null = parseWidgetEvent({ event: e });
        if (parsed) {
            dispatchWidgetEvent(key, 'done', parsed);
        }
        evtSource.close();
    });

    evtSource.onerror = () => {
        if (evtSource.readyState === EventSource.CLOSED) {
            dispatchWidgetEvent(key, 'error', { messageId: messageId, error: 'An error occurred while attempting to connect.' });
        }
    }

    return () => evtSource.close();
};

