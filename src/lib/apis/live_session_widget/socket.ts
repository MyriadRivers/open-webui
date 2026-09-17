import { get } from 'svelte/store';
import { socket } from '$lib/stores';
import { dispatchPresence, dispatchSessionStatus } from '$lib/stores/liveSessionWidget';

export type SessionStatus = "starting" |"streaming" | "complete" | "error";

export interface SessionPresenceEvent {
    chatId: string;
    activeViewers: number;
}

export interface SessionStatusEvent {
    chatId: string;
    status:SessionStatus;
}

export type SessionEvent = SessionPresenceEvent | SessionStatusEvent;

const parsePresence = (data: any): SessionPresenceEvent | null => {
    if (typeof data.chatId !== 'string' ) return null;
    if (typeof data.activeViewers !== 'number') return null;
    
    const presenceEvent: SessionPresenceEvent = {
        chatId: data.chatId,
        activeViewers: data.activeViewers
    }

    return presenceEvent;
}

const parseSessionStatus = (data: any): SessionStatusEvent | null => {
    if (typeof data.chatId !== 'string' ) return null;
    if (typeof data.status !== 'string') return null;
    
    const sessionStatusEvent: SessionStatusEvent = {
        chatId: data.chatId,
        status: data.status as SessionStatus
    }

    return sessionStatusEvent;
}

export const joinChatRoom = (chatId: string) => {
  get(socket)?.emit('join_chat', { chatId });
}

export const leaveChatRoom = (chatId: string) => {
  get(socket)?.emit('leave_chat', { chatId });
}

export const subscribeToChatEvents = () => {
  const s = get(socket);

  s?.onAnyOutgoing((eventName, ...args) => {
    console.log('Outgoing event:', eventName, args);
  });

  console.log("subscribed to chat events!")
  const onPresence = (data: any) => {
    console.log("presence detected")
    const parsed: SessionPresenceEvent | null = parsePresence(data);
    if (parsed) {
      dispatchPresence(parsed);
    }
  };
  const onSessionStatus = (data: any) => {
    console.log("session status event detected")
    const parsed: SessionStatusEvent | null = parseSessionStatus(data);
    if (parsed) {
      dispatchSessionStatus(parsed);
    }
  };

  s?.on('presence', onPresence);
  s?.on('session_status', onSessionStatus);

  return () => {
    s?.off('presence', onPresence);
    s?.off('session_status', onSessionStatus);
  };
}

export const reportSessionStatus = async (chatId: string, status: SessionStatus) => {
    console.log("reporting session status")
    get(socket)?.emit('session_status', { chatId, status });
}