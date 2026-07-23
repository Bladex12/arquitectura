import { useEffect, useRef } from 'react';

interface UseRoomSyncOptions {
  /** TabletConnection.team_session_token (localStorage 'team_session_token'). */
  token: string | null | undefined;
  /** GameSession.room_code (localStorage 'roomCode'). */
  roomCode: string | null | undefined;
  /** Poll interval used only when VITE_WS_URL isn't configured (local dev). */
  intervalMs?: number;
  enabled?: boolean;
}

/**
 * Keeps a tablet page's state fresh, calling `onUpdate` either:
 * - on every `state_changed` WebSocket push from game_sessions/broadcast.py
 *   (production, when VITE_WS_URL is set), with auto-reconnect and a
 *   catch-up call on every (re)connect, or
 * - on a plain setInterval tick (local Docker Compose dev, which has no
 *   deployed WebSocket API) -- same behavior every tablet page already had
 *   before this hook existed.
 *
 * `onUpdate` is read via a ref so callers don't need to memoize it.
 */
export function useRoomSync(
  onUpdate: () => void,
  { token, roomCode, intervalMs = 5000, enabled = true }: UseRoomSyncOptions
) {
  const onUpdateRef = useRef(onUpdate);
  onUpdateRef.current = onUpdate;

  useEffect(() => {
    if (!enabled || !token || !roomCode) return;

    const wsBase = import.meta.env.VITE_WS_URL;
    if (!wsBase) {
      const id = setInterval(() => onUpdateRef.current(), intervalMs);
      return () => clearInterval(id);
    }

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    let backoffMs = 1000;

    const connect = () => {
      socket = new WebSocket(
        `${wsBase}?token=${encodeURIComponent(token)}&room_code=${encodeURIComponent(roomCode)}`
      );

      socket.onopen = () => {
        backoffMs = 1000;
        onUpdateRef.current();
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'state_changed') {
            onUpdateRef.current();
          }
        } catch {
          // ignore malformed messages
        }
      };

      socket.onclose = () => {
        if (stopped) return;
        reconnectTimer = setTimeout(connect, backoffMs);
        backoffMs = Math.min(backoffMs * 2, 30000);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      stopped = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [token, roomCode, intervalMs, enabled]);
}
