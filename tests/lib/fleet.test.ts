/**
 * Unit tests for central fleet API helpers.
 */

import { getDeviceTelemetry, getFleetDevice, removeFleetDevice } from "@/lib/fleet";

const mockFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
global.fetch = mockFetch as unknown as typeof fetch;

function okResponse(body: unknown, status = 200): Partial<Response> {
  return { ok: true, status, json: async () => body };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe("getFleetDevice", () => {
  it("returns device detail with latest telemetry", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        vin: "N001",
        model: "explorer-v1",
        firmware_version: "0.7.1",
        last_seen_at: null,
        registered_at: "2026-01-01T00:00:00+00:00",
        role: "owner",
        latest_telemetry: {
          battery_voltage: 8.0,
          cpu_temp_c: 45.0,
          uptime_seconds: 100,
          recorded_at: "2026-01-01T00:00:00+00:00",
        },
        timestamp: "2026-01-01T00:00:01+00:00",
      }) as Response,
    );
    const detail = await getFleetDevice("N001");
    expect(detail.vin).toBe("N001");
    expect(detail.latest_telemetry?.battery_voltage).toBe(8.0);
  });
});

describe("getDeviceTelemetry", () => {
  it("returns the readings array", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        vin: "N001",
        readings: [
          {
            battery_voltage: 8.0,
            cpu_temp_c: 45.0,
            uptime_seconds: 100,
            recorded_at: "2026-01-01T00:00:00+00:00",
          },
        ],
        timestamp: "2026-01-01T00:00:01+00:00",
      }) as Response,
    );
    const readings = await getDeviceTelemetry("N001");
    expect(readings).toHaveLength(1);
    expect(readings[0].cpu_temp_c).toBe(45.0);
  });

  it("encodes limit and since into the query string", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({ vin: "N001", readings: [], timestamp: "t" }) as Response,
    );
    await getDeviceTelemetry("N001", { limit: 50, since: "2026-01-01T00:00:00+00:00" });
    const url = String(mockFetch.mock.calls[0][0]);
    expect(url).toContain("/api/fleet/devices/N001/telemetry");
    expect(url).toContain("limit=50");
    expect(url).toContain("since=");
  });
});

describe("removeFleetDevice", () => {
  it("issues a DELETE and returns removed flag", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({ vin: "N001", removed: true, timestamp: "t" }) as Response,
    );
    const removed = await removeFleetDevice("N001");
    expect(removed).toBe(true);
    expect(mockFetch.mock.calls[0][1]?.method).toBe("DELETE");
  });
});
