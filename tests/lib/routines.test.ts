/**
 * Tests for autonomy-routine control: device API calls and the heartbeat loop.
 */

import { ApiRequestError, setDeviceBaseUrl } from "@/lib/api";
import {
  createHeartbeatLoop,
  describeRoutine,
  fetchAvailableRoutines,
  heartbeatRoutine,
  startRoutine,
  startRoutineExclusive,
  stopAllRoutines,
  stopRoutine,
} from "@/lib/routines";

const DEVICE_URL = "https://device.test:8443";

const mockFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
global.fetch = mockFetch as unknown as typeof fetch;

function makeOkResponse(body: unknown, status = 200): Partial<Response> {
  return { ok: true, status, json: async () => body };
}

function makeErrorResponse(status: number, errorMsg: string): Partial<Response> {
  return {
    ok: false,
    status,
    json: async () => ({ error: errorMsg, timestamp: new Date().toISOString() }),
  };
}

function lastBody(): unknown {
  const init = mockFetch.mock.calls[0][1];
  return init?.body !== undefined ? JSON.parse(init.body as string) : undefined;
}

beforeEach(() => {
  mockFetch.mockReset();
  setDeviceBaseUrl(DEVICE_URL);
});

// ---------------------------------------------------------------------------
// Device API calls
// ---------------------------------------------------------------------------

describe("fetchAvailableRoutines", () => {
  it("GETs the catalogue from the device", async () => {
    mockFetch.mockResolvedValueOnce(
      makeOkResponse({
        routines: ["explore"],
        params_schema: {},
        version: "0.1.0",
        timestamp: "t",
      }) as Response,
    );

    const catalog = await fetchAvailableRoutines();

    expect(catalog.routines).toEqual(["explore"]);
    expect(catalog.version).toBe("0.1.0");
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${DEVICE_URL}/api/routines/available`);
    expect(init?.method).toBe("GET");
  });
});

describe("describeRoutine", () => {
  it("uses a friendly label for known routines", () => {
    expect(describeRoutine("explore").label).toContain("Explore");
  });

  it("humanises unknown routine names", () => {
    expect(describeRoutine("follow-user")).toEqual({
      name: "follow-user",
      label: "Follow User",
    });
  });
});

describe("startRoutine", () => {
  it("POSTs the routine, params, and lease bounds", async () => {
    mockFetch.mockResolvedValueOnce(
      makeOkResponse({ routine: "explore", status: "running" }) as Response,
    );

    const info = await startRoutine("explore", { speed: 1 }, { heartbeatTimeoutS: 60, maxDurationS: 1800 });

    expect(info.routine).toBe("explore");
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${DEVICE_URL}/api/routines/start`);
    expect(init?.method).toBe("POST");
    expect(lastBody()).toEqual({
      routine: "explore",
      params: { speed: 1 },
      heartbeat_timeout_s: 60,
      max_duration_s: 1800,
    });
  });

  it("defaults params to an empty object and omits unset bounds", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ routine: "explore" }) as Response);
    await startRoutine("explore");
    expect(lastBody()).toEqual({
      routine: "explore",
      params: {},
      heartbeat_timeout_s: undefined,
      max_duration_s: undefined,
    });
  });
});

describe("heartbeatRoutine", () => {
  it("POSTs the routine name to the heartbeat endpoint", async () => {
    mockFetch.mockResolvedValueOnce(
      makeOkResponse({
        routine: "explore",
        status: "running",
        heartbeat_timeout_s: 120,
        seconds_remaining: 120,
      }) as Response,
    );

    const info = await heartbeatRoutine("explore");

    expect(info.seconds_remaining).toBe(120);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${DEVICE_URL}/api/routines/heartbeat`);
    expect(init?.method).toBe("POST");
    expect(lastBody()).toEqual({ routine: "explore" });
  });

  it("rejects with ApiRequestError(404) when the routine is not running", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(404, "not running") as Response);
    await expect(heartbeatRoutine("explore")).rejects.toBeInstanceOf(ApiRequestError);
  });
});

describe("stopRoutine", () => {
  it("POSTs the routine name to the stop endpoint", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ routine: "explore" }) as Response);
    await stopRoutine("explore");
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${DEVICE_URL}/api/routines/stop`);
    expect(init?.method).toBe("POST");
    expect(lastBody()).toEqual({ routine: "explore" });
  });
});

describe("stopAllRoutines", () => {
  it("POSTs to stop-all with no body", async () => {
    mockFetch.mockResolvedValueOnce(makeOkResponse({ stopped: [], timestamp: "t" }) as Response);
    const result = await stopAllRoutines();
    expect(result.stopped).toEqual([]);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe(`${DEVICE_URL}/api/routines/stop-all`);
    expect(init?.method).toBe("POST");
    expect(init?.body).toBeUndefined();
  });
});

describe("startRoutineExclusive", () => {
  it("stops all routines before starting the new one (one-at-a-time)", async () => {
    mockFetch
      .mockResolvedValueOnce(makeOkResponse({ stopped: [], timestamp: "t" }) as Response) // stop-all
      .mockResolvedValueOnce(makeOkResponse({ routine: "explore", status: "running" }) as Response); // start

    const info = await startRoutineExclusive("explore", { x: 1 });

    expect(info.routine).toBe("explore");
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toBe(`${DEVICE_URL}/api/routines/stop-all`);
    expect(mockFetch.mock.calls[1][0]).toBe(`${DEVICE_URL}/api/routines/start`);
    expect(JSON.parse(mockFetch.mock.calls[1][1]?.body as string)).toMatchObject({
      routine: "explore",
      params: { x: 1 },
    });
  });

  it("does not start if stop-all fails", async () => {
    mockFetch.mockResolvedValueOnce(makeErrorResponse(503, "manager unavailable") as Response);
    await expect(startRoutineExclusive("explore")).rejects.toBeInstanceOf(ApiRequestError);
    expect(mockFetch).toHaveBeenCalledTimes(1); // start never attempted
  });
});

// ---------------------------------------------------------------------------
// Heartbeat scheduler
// ---------------------------------------------------------------------------

describe("createHeartbeatLoop", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(async () => {
    jest.clearAllTimers();
    jest.useRealTimers();
    // Drain microtasks queued by floating heartbeat ticks so the jest worker
    // exits cleanly (the loop fires-and-forgets each tick).
    await Promise.resolve();
  });

  it("beats immediately on resume and then on the interval", () => {
    const beat = jest.fn().mockResolvedValue({});
    const loop = createHeartbeatLoop("explore", { intervalMs: 1000, beat });

    loop.resume();
    expect(beat).toHaveBeenCalledTimes(1); // immediate
    jest.advanceTimersByTime(3000);
    expect(beat).toHaveBeenCalledTimes(4); // + 3 ticks
    loop.dispose();
  });

  it("pause stops beating; resume restarts it", () => {
    const beat = jest.fn().mockResolvedValue({});
    const loop = createHeartbeatLoop("explore", { intervalMs: 1000, beat });

    loop.resume();
    jest.advanceTimersByTime(1000); // 2 total
    loop.pause();
    jest.advanceTimersByTime(5000);
    expect(beat).toHaveBeenCalledTimes(2); // paused → no more

    loop.resume();
    expect(beat).toHaveBeenCalledTimes(3); // immediate on resume
    loop.dispose();
  });

  it("dispose stops all further beats", () => {
    const beat = jest.fn().mockResolvedValue({});
    const loop = createHeartbeatLoop("explore", { intervalMs: 1000, beat });

    loop.resume();
    loop.dispose();
    jest.advanceTimersByTime(5000);
    expect(beat).toHaveBeenCalledTimes(1);
  });

  it("disposes and fires onExpired when the device reports a 404", async () => {
    const beat = jest.fn().mockRejectedValue(new ApiRequestError("not running", 404));
    const onExpired = jest.fn();
    const loop = createHeartbeatLoop("explore", { intervalMs: 1000, beat, onExpired });

    loop.resume();
    expect(beat).toHaveBeenCalledTimes(1);
    await Promise.resolve();
    await Promise.resolve();
    expect(onExpired).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(5000);
    expect(beat).toHaveBeenCalledTimes(1); // disposed → no further beats
  });

  it("keeps beating after a transient (non-404) error", async () => {
    const beat = jest.fn().mockRejectedValue(new ApiRequestError("timeout", 0));
    const loop = createHeartbeatLoop("explore", { intervalMs: 1000, beat });

    loop.resume();
    await Promise.resolve();
    await Promise.resolve();
    jest.advanceTimersByTime(1000);
    expect(beat).toHaveBeenCalledTimes(2); // not disposed
    loop.dispose();
  });
});
