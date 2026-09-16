from collections.abc import AsyncIterable

from fastapi import FastAPI, Request
from fastapi.responses import StreamingResponse, EventSourceResponse
from fastapi.sse import ServerSentEvent
from pydantic import BaseModel
import time, json, uuid, asyncio

from typing import Optional, Literal

app = FastAPI()

# Mock chat completion model

MODEL_ID = "mock-model-1"
CANNED_RESPONSE = (
    "lorem ipsum dolor sit amet consectetur adipiscing elit similique aliquip ducimus est tempore officia ut deleniti sint dolores et labore quis corrupti quas laboris cum qui praesentium qui assumenda mollit qui ducimus distinctio officia cumque id corrupti voluptas dignissimos deleniti nihil temporibus id quis aut excepturi et cupidatat repellendus maxime"
)

@app.get("/v1/models")
async def list_models():
    return {
        "object": "list",
        "data": [{"id": MODEL_ID, "object": "model", "created": int(time.time()), "owned_by": "mock"}],
    }

@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    body = await request.json()
    stream = body.get("stream", False)
    completion_id = f"chatcmpl-{uuid.uuid4().hex[:8]}"

    if not stream:
        return {
            "id": completion_id,
            "object": "chat.completion",
            "created": int(time.time()),
            "model": MODEL_ID,
            "choices": [{
                "index": 0,
                "message": {"role": "assistant", "content": CANNED_RESPONSE},
                "finish_reason": "stop",
            }],
        }

    def event_stream():
        for word in CANNED_RESPONSE.split(" "):
            chunk = {
                "id": completion_id, "object": "chat.completion.chunk",
                "created": int(time.time()), "model": MODEL_ID,
                "choices": [{"index": 0, "delta": {"content": word + " "}, "finish_reason": None}],
            }
            yield f"data: {json.dumps(chunk)}\n\n"
            time.sleep(0.15)  # simulate token pacing

        final = {
            "id": completion_id, "object": "chat.completion.chunk",
            "created": int(time.time()), "model": MODEL_ID,
            "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
        }
        yield f"data: {json.dumps(final)}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")

# Deterministic SSE emitter

class StepEvent(BaseModel):
    messageId: str
    type: Literal["step"] = "step"
    id: str
    label: Optional[str] = None
    status: Optional[Literal["running", "complete", "error"]] = None

class MetricEvent(BaseModel):
    messageId: str
    type: Literal["metric"] = "metric"
    key: str
    label: Optional[str] = None
    value: float

class DoneEvent(BaseModel):
    messageId: str

class SseEvent(BaseModel):
    event: Literal["widget_delta", "widget_done"]
    data: StepEvent | MetricEvent | DoneEvent

async def widget_event_stream(message_id: str):
    mock_events = [
        SseEvent(event="widget_delta", data=StepEvent(messageId=message_id, id="retrieval", label="Searching docs", status="running")),
        SseEvent(event="widget_delta", data=MetricEvent(messageId=message_id, key="sources", label="Sources", value=3)),
        SseEvent(event="widget_delta", data=StepEvent(messageId=message_id, id="retrieval", status="complete")),
        SseEvent(event="widget_done", data=DoneEvent(messageId=message_id)),
    ]

    for e in mock_events:
        yield ServerSentEvent(event=e.event, data=e.data)
        await asyncio.sleep(0.4)

@app.get("/widget/sse_events/{message_id}", response_class=EventSourceResponse)
async def sse_items(message_id: str) -> AsyncIterable[ServerSentEvent]:
    return StreamingResponse(widget_event_stream(message_id), media_type="text/event-stream")

