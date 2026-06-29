/**
 * Device-mode calibration API helpers.
 *
 * Typed wrappers over the nomothetic device API (:8443) calibration endpoints.
 * These talk to the device directly (deviceApi) — reachable over Tailscale or
 * the Soft AP — not the central fleet API.
 */

import { deviceApi } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MotorCalibration {
  channel: number;
  speed_scale: number;
  deadband_pct: number;
  reversed: boolean;
}

export interface ServoCalibration {
  trim_us: number;
}

export interface GrayscaleCalibration {
  channel: number;
  adc_channel: number;
  white_raw: number;
  black_raw: number;
}

/** Full calibration snapshot (GET /api/calibration). */
export interface CalibrationSnapshot {
  motors: MotorCalibration[];
  servos: Record<string, ServoCalibration>;
  grayscale: GrayscaleCalibration[];
  timestamp: string;
}

export interface NormalizedGrayscale {
  channels: number[];
  normalized: number[];
  timestamp: string;
}

export interface GrayscaleCaptureResult {
  channel: number;
  adc_channel: number;
  surface: "white" | "black";
  raw_value: number;
  stored: boolean;
  timestamp: string;
}

/** Partial motor calibration update body. */
export interface MotorCalibrationUpdate {
  speed_scale?: number;
  deadband_pct?: number;
  reversed?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch the full calibration snapshot. */
export async function getCalibration(): Promise<CalibrationSnapshot> {
  return deviceApi<CalibrationSnapshot>("/api/calibration");
}

/** Update one motor channel's calibration (partial). */
export async function setMotorCalibration(
  channel: number,
  body: MotorCalibrationUpdate,
): Promise<MotorCalibration> {
  return deviceApi<MotorCalibration>(`/api/calibration/motor/${channel}`, {
    method: "PUT",
    body,
  });
}

/** Set a named servo's trim (microseconds). */
export async function setServoCalibration(
  servo: string,
  trimUs: number,
): Promise<{ servo: string; trim_us: number }> {
  return deviceApi(`/api/calibration/servo/${encodeURIComponent(servo)}`, {
    method: "PUT",
    body: { trim_us: trimUs },
  });
}

/** Capture a grayscale white/black reference for one sensor position. */
export async function captureGrayscale(
  channel: number,
  surface: "white" | "black",
): Promise<GrayscaleCaptureResult> {
  return deviceApi<GrayscaleCaptureResult>(`/api/calibration/grayscale/${channel}/capture`, {
    method: "POST",
    body: { surface },
  });
}

/** Persist the in-memory calibration to disk on the device. */
export async function saveCalibration(): Promise<{ saved: boolean; path: string }> {
  return deviceApi("/api/calibration/save", { method: "POST" });
}

/** Revert in-memory calibration to defaults (not persisted until save). */
export async function resetCalibration(): Promise<{ reset: boolean }> {
  return deviceApi("/api/calibration/reset", { method: "POST" });
}

/** Read live normalized grayscale values (0.0 white – 1.0 black). */
export async function getNormalizedGrayscale(): Promise<NormalizedGrayscale> {
  return deviceApi<NormalizedGrayscale>("/api/sensor/grayscale/normalized");
}
