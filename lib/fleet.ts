/**
 * Central fleet API helpers.
 *
 * Typed wrappers over the central-mode endpoints for fleet management:
 * device detail, telemetry history, and removal. Mirrors the helper style in
 * lib/api.ts (getDeviceIdentity / registerDeviceWithFleet).
 */

import { centralApi } from "@/lib/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single telemetry reading (matches nomothetic TelemetryReadingItem). */
export interface TelemetryReading {
  battery_voltage: number;
  cpu_temp_c: number;
  uptime_seconds: number;
  recorded_at: string;
}

/** Detail for one fleet device (GET /api/fleet/devices/{vin}). */
export interface FleetDeviceDetail {
  vin: string;
  model: string;
  firmware_version: string | null;
  last_seen_at: string | null;
  registered_at: string;
  role: string;
  latest_telemetry: TelemetryReading | null;
  timestamp: string;
}

interface DeviceTelemetryResponse {
  vin: string;
  readings: TelemetryReading[];
  timestamp: string;
}

interface DeviceRemoveResponse {
  vin: string;
  removed: boolean;
  timestamp: string;
}

/** Options for a telemetry history query. */
export interface TelemetryQuery {
  /** Max readings to return (1–1000; server default 100). */
  limit?: number;
  /** ISO-8601 lower bound (inclusive) on recorded_at. */
  since?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch detail (with latest telemetry) for one fleet device. */
export async function getFleetDevice(vin: string): Promise<FleetDeviceDetail> {
  return centralApi<FleetDeviceDetail>(`/api/fleet/devices/${encodeURIComponent(vin)}`);
}

/** Fetch telemetry history for a device, newest first. */
export async function getDeviceTelemetry(
  vin: string,
  query: TelemetryQuery = {},
): Promise<TelemetryReading[]> {
  const params = new URLSearchParams();
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.since !== undefined) params.set("since", query.since);
  const qs = params.toString();
  const path = `/api/fleet/devices/${encodeURIComponent(vin)}/telemetry${qs ? `?${qs}` : ""}`;
  const resp = await centralApi<DeviceTelemetryResponse>(path);
  return resp.readings;
}

/** Remove a device from the authenticated user's fleet (ownership edge only). */
export async function removeFleetDevice(vin: string): Promise<boolean> {
  const resp = await centralApi<DeviceRemoveResponse>(
    `/api/fleet/devices/${encodeURIComponent(vin)}`,
    { method: "DELETE" },
  );
  return resp.removed;
}
