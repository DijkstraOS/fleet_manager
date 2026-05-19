export type RealtimeHandler = (message: Record<string, unknown>) => void;

export function connectRealtime(options: {
  onMessage: RealtimeHandler;
  onOpen?: () => void;
  onClose?: () => void;
}) {
  const wsUrl = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;
  const ws = new WebSocket(wsUrl);
  ws.onmessage = (event) => {
    options.onMessage(JSON.parse(event.data) as Record<string, unknown>);
  };
  ws.onopen = () => options.onOpen?.();
  ws.onclose = () => options.onClose?.();
  return () => ws.close();
}
