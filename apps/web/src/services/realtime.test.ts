// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { connectRealtime } from "./realtime";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onmessage: ((event: { data: string }) => void) | null = null;
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  close = vi.fn();
  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }
}

function socketAt(index: number): MockWebSocket {
  const socket = MockWebSocket.instances[index];
  if (!socket) throw new Error(`expected MockWebSocket #${index} to have been constructed`);
  return socket;
}

beforeEach(() => {
  vi.useFakeTimers();
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("connectRealtime reconnection", () => {
  it("schedules a backoff reconnect after the socket closes", () => {
    const teardown = connectRealtime({ onMessage: () => {} });
    expect(MockWebSocket.instances).toHaveLength(1);

    socketAt(0).onclose?.();
    expect(MockWebSocket.instances).toHaveLength(1);

    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances).toHaveLength(2);

    teardown();
  });

  it("widens the backoff on repeated failures and resets it after a healthy open", () => {
    const teardown = connectRealtime({ onMessage: () => {} });

    socketAt(0).onclose?.();
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances).toHaveLength(2);

    socketAt(1).onclose?.();
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances).toHaveLength(2);
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances).toHaveLength(3);

    socketAt(2).onopen?.();
    socketAt(2).onclose?.();
    vi.advanceTimersByTime(1000);
    expect(MockWebSocket.instances).toHaveLength(4);

    teardown();
  });

  it("stops reconnecting once the caller tears down", () => {
    const teardown = connectRealtime({ onMessage: () => {} });
    teardown();

    socketAt(0).onclose?.();
    vi.advanceTimersByTime(60000);
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(socketAt(0).close).toHaveBeenCalled();
  });
});

describe("connectRealtime message parsing", () => {
  it("drops a malformed frame without throwing and keeps delivering later valid ones", () => {
    const onMessage = vi.fn();
    const teardown = connectRealtime({ onMessage });

    expect(() => socketAt(0).onmessage?.({ data: "not json" })).not.toThrow();
    expect(onMessage).not.toHaveBeenCalled();

    socketAt(0).onmessage?.({ data: '{"kind":"pose","id":"agv-1"}' });
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledWith({ kind: "pose", id: "agv-1" });

    teardown();
  });
});
