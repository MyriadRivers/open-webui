from open_webui.socket import sio
from pydantic import BaseModel

from typing import Literal

# in-memory, dev-only — not meant to survive a restart or scale past one process
chat_viewers: dict[str, set[str]] = {}

class SessionStatusBody(BaseModel):
    status: Literal["starting", "streaming", "complete", "error"] = "starting"

@sio.on("session_status")
async def set_session_status(sid, data):
    chat_id = data["chatId"]
    status = data["status"]
    await sio.emit("session_status", {"chatId": chat_id, "status": status})

@sio.on("join_chat")
async def join_chat(sid, data):
    chat_id = data["chatId"]
    chat_viewers.setdefault(chat_id, set()).add(sid)
    await sio.emit("presence", {"chatId": chat_id, "activeViewers": len(chat_viewers[chat_id])})

@sio.on("leave_chat")
async def leave_chat(sid, data):
    chat_id = data["chatId"]
    chat_viewers.get(chat_id, set()).discard(sid)
    await sio.emit("presence", {"chatId": chat_id, "activeViewers": len(chat_viewers.get(chat_id, set()))})