from open_webui.socket.main import sio
from pydantic import BaseModel

from typing import Literal

# in-memory, dev-only — not meant to survive a restart or scale past one process
chat_viewers: dict[str, set[str]] = {}

class SessionStatusBody(BaseModel):
    status: Literal["starting", "streaming", "complete", "error"] = "starting"

@sio.on('disconnect')
async def disconnect(sid):
    affected_chats = []
    for chat_id, viewers in chat_viewers.items():
        if sid in viewers:
            viewers.discard(sid)
            affected_chats.append(chat_id)

    for chat_id in affected_chats:
        await sio.emit("presence", {
            "chatId": chat_id,
            "activeViewers": len(chat_viewers[chat_id])
        })

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