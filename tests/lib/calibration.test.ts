/**
 * Unit tests for device-mode calibration API helpers.
 */

import { ApiRequestError, setDeviceBaseUrl } from "@/lib/api";
import {
  captureGrayscale,
  getCalibration,
  resetCalibration,
  setMotorCalibration,
} from "@/lib/calibration";

const DEVICE_URL = "https://device.test:8443";

const mockFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();
global.fetch = mockFetch as unknown as typeof fetch;

function okResponse(body: unknown, status = 200): Partial<Response> {
  return { ok: true, status, json: async () => body };
}

function errorResponse(status: number, error: string): Partial<Response> {
  return { ok: false, status, json: async () => ({ error, timestamp: "t" }) };
}

beforeEach(() => {
  mockFetch.mockReset();
  setDeviceBaseUrl(DEVICE_URL);
});

describe("getCalibration", () => {
  it("returns the calibration snapshot", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({
        motors: [{ channel: 0, speed_scale: 1.0, deadband_pct: 5.0, reversed: false }],
        servos: { steering: { trim_us: 0 } },
        grayscale: [{ channel: 0, adc_channel: 0, white_raw: 100, black_raw: 3000 }],
        timestamp: "t",
      }) as Response,
    );
    const snap = await getCalibration();
    expect(snap.motors[0].speed_scale).toBe(1.0);
    expect(snap.servos.steering.trim_us).toBe(0);
  });
});

describe("setMotorCalibration", () => {
  it("PUTs a partial update body", async () => {
    mockFetch.mockResolvedValueOnce(
      okResponse({ channel: 0, speed_scale: 1.2, deadband_pct: 5.0, reversed: true }) as Response,
    );
    const result = await setMotorCalibration(0, { speed_scale: 1.2, reversed: true });
    expect(result.speed_scale).toBe(1.2);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/api/calibration/motor/0");
    expect(init?.method).toBe("PUT");
    expect(JSON.parse(String(init?.body))).toEqual({ speed_scale: 1.2, reversed: true });
  });
});

describe("error mapping", () => {
  it("throws ApiRequestError with the status on 503", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(503, "HAT daemon unavailable") as Response);
    await expect(resetCalibration()).rejects.toBeInstanceOf(ApiRequestError);
  });

  it("propagates a 422 validation error", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(422, "invalid surface") as Response);
    await expect(captureGrayscale(0, "white")).rejects.toMatchObject({ status: 422 });
  });
});
