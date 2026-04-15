/**
 * Device list hook and helpers.
 *
 * Fetches the fleet device list from the central API and maps
 * the wire format to a local Device interface. Falls back to a
 * stub local device when the fleet API is unreachable and a
 * device is paired.
 */

import { useCallback, useEffect, useState } from "react";

import { centralApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Wire format returned by nomothetic /api/fleet/devices. */
interface DeviceItemWire {
  vin: string;
  model: string;
  firmware_version: string | null;
  last_seen_at: string | null;
  registered_at: string;
  role: string;
}

/** Normalised device representation used by the UI. */
export interface Device {
  id: string;
  name: string;
  isOnline: boolean;
  batteryVoltage: number | null;
  lastSeenAt: string | null;
  firmwareVersion: string | null;
  registeredAt: string;
}

/** Return value of the useDevices hook. */
export interface UseDevicesResult {
  devices: Device[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ONLINE_THRESHOLD_MS = 60_000;

function mapWireToDevice(wire: DeviceItemWire): Device {
  const lastSeenAt = wire.last_seen_at ?? null;
  const isOnline =
    lastSeenAt !== null &&
    Date.now() - new Date(lastSeenAt).getTime() < ONLINE_THRESHOLD_MS;

  return {
    id: wire.vin,
    name: wire.model,
    isOnline,
    batteryVoltage: null,
    lastSeenAt,
    firmwareVersion: wire.firmware_version ?? null,
    registeredAt: wire.registered_at,
  };
}

/**
 * Format a date string as a human-friendly relative time.
 *
 * Returns "just now", "2 min ago", "1 hour ago", "3 days ago",
 * or "—" when the input is null.
 */
export function formatLastSeen(dateStr: string | null): string {
  if (dateStr === null) return "—";

  const diffMs = Date.now() - new Date(dateStr).getTime();
  if (diffMs < 0) return "just now";

  const seconds = Math.floor(diffMs / 1_000);
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetch and manage the list of fleet devices.
 *
 * Falls back to a single stub device when the fleet API is
 * unreachable and a device is paired locally.
 */
export function useDevices(): UseDevicesResult {
  const { isDevicePaired } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await centralApi<{ devices: DeviceItemWire[] }>(
        "/api/fleet/devices",
      );
      setDevices(data.devices.map(mapWireToDevice));
      setError(null);
    } catch {
      if (isDevicePaired) {
        setDevices([
          {
            id: "local",
            name: "Local Device",
            isOnline: false,
            batteryVoltage: null,
            lastSeenAt: null,
            firmwareVersion: null,
            registeredAt: new Date().toISOString(),
          },
        ]);
        setError(
          "Fleet service unavailable \u2014 showing local devices only",
        );
      } else {
        setDevices([]);
        setError("Fleet service unavailable");
      }
    } finally {
      setIsLoading(false);
    }
  }, [isDevicePaired]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { devices, isLoading, error, refresh };
}
