import { createDemoMap } from "@agv/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { saveMap, stopLoop } from "./api";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.restoreAllMocks();
});

describe("api service requests", () => {
  it("only sends json content-type when a request has a body", async () => {
    const calls = mockFetch({ ok: true, stopped: true });

    await stopLoop("SIM-001");

    expect(calls[0]?.init?.headers).toEqual({});
  });

  it("sends json content-type with json request bodies", async () => {
    const map = createDemoMap();
    const calls = mockFetch(map);

    await saveMap(map);

    expect(calls[0]?.init?.headers).toEqual({ "content-type": "application/json" });
  });
});

function mockFetch(responseBody: unknown) {
  const calls: Array<{ path: string; init?: RequestInit }> = [];
  globalThis.fetch = vi.fn(async (path: string | URL | Request, init?: RequestInit) => {
    calls.push(init ? { path: String(path), init } : { path: String(path) });
    return new Response(JSON.stringify(responseBody), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as typeof fetch;
  return calls;
}
