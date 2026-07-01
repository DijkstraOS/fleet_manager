export type RealtimeHandler = (message: Record<string, unknown>) => void;

export interface ConnectRealtimeOptions {
  onMessage: RealtimeHandler;
  onOpen?: () => void;
  onClose?: () => void;
}

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

function realtimeUrl(): string {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/ws`;
}

export function connectRealtime(options: ConnectRealtimeOptions) {
  let socket: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let backoffMs = RECONNECT_BASE_MS;
  let disposed = false;

  function open() {
    socket = new WebSocket(realtimeUrl());
    socket.onmessage = (event) => {
      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(event.data) as Record<string, unknown>;
      } catch {
        return;
      }
      options.onMessage(payload);
    };
    socket.onopen = () => {
      backoffMs = RECONNECT_BASE_MS;
      options.onOpen?.();
    };
    socket.onclose = () => {
      options.onClose?.();
      if (disposed) return;
      reconnectTimer = setTimeout(open, backoffMs);
      backoffMs = Math.min(backoffMs * 2, RECONNECT_MAX_MS);
    };
  }

  open();

  return () => {
    disposed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    socket?.close();
  };
}
