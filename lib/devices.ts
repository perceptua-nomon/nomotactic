/**
 * Device list hook and helpers.
 *
 * Fetches the fleet device list from the central API and maps
 * the wire format to a local Device interface. Falls back to a
 * stub local device when the fleet API is unreachable and a
 * device is paired.
 */

import { useCallback, useEffect, useState } from "react";

import { SOFT_AP_URL } from "@/constants/config";
import { centralApi, getDeviceBaseUrl } from "@/lib/api";

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
  source: "central" | "local";
}

/**
 * Local device discovery state, resolved when the central API is not available.
 *
 *   probing       — discovery in progress
 *   direct        — device reachable at the home-network URL (Tailscale / confirmed)
 *   ap_wifi       — device in AP mode with pairing currently closed on-device
 *                   (the app may still choose to show re-pair UI if it has no
 *                   valid local device session)
 *   ap_pair       — device in AP mode and openly advertising pairing
 *   needs_pairing — nothing reachable; show setup instructions
 */
export type LocalDiscoveryState =
  | "probing"
  | "direct"
  | "ap_wifi"
  | "ap_pair"
  | "needs_pairing";

/** Return value of the useDevices hook. */
export interface UseDevicesResult {
  centralDevices: Device[];
  localDiscovery: LocalDiscoveryState;
  directDevice: Device | null;
  centralAvailable: boolean;
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
    source: "central",
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
// Local discovery
// ---------------------------------------------------------------------------

interface DeviceStatusWire {
  paired: boolean;
  pairing_available: boolean;
}

async function probeDeviceStatus(url: string): Promise<DeviceStatusWire | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3_000);
    const resp = await fetch(`${url}/api/device/auth/status`, { signal: controller.signal });
    clearTimeout(timer);
    if (!resp.ok) return null;
    return (await resp.json()) as DeviceStatusWire;
  } catch {
    return null;
  }
}

async function runLocalDiscovery(): Promise<{ state: LocalDiscoveryState; device: Device | null }> {
  // 1. Try home-network URL (Tailscale FQDN or user-confirmed address).
  const homeUrl = getDeviceBaseUrl();
  const directStatus = await probeDeviceStatus(homeUrl);
  if (directStatus !== null) {
    return {
      state: "direct",
      device: {
        id: "local-direct",
        name: "Device",
        isOnline: true,
        batteryVoltage: null,
        lastSeenAt: new Date().toISOString(),
        firmwareVersion: null,
        registeredAt: new Date().toISOString(),
        source: "local",
      },
    };
  }

  // 2. Try Soft AP URL.
  const apStatus = await probeDeviceStatus(SOFT_AP_URL);
  if (apStatus !== null) {
    return {
      state: apStatus.pairing_available ? "ap_pair" : "ap_wifi",
      device: null,
    };
  }

  return { state: "needs_pairing", device: null };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Fetch fleet devices from the central API. When the central API is
 * unreachable, runs a three-stage local discovery:
 *   1. Home-network URL (Tailscale FQDN / confirmed address)
 *   2. Soft AP URL
 *   3. Needs pairing (nothing reachable)
 */
export function useDevices(): UseDevicesResult {
  const [centralDevices, setCentralDevices] = useState<Device[]>([]);
  const [localDiscovery, setLocalDiscovery] = useState<LocalDiscoveryState>("probing");
  const [directDevice, setDirectDevice] = useState<Device | null>(null);
  const [centralAvailable, setCentralAvailable] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setLocalDiscovery("probing");
    setDirectDevice(null);

    // Attempt central API first.
    let centralList: Device[] = [];
    let available = false;
    try {
      const result = await centralApi<{ devices: DeviceItemWire[] }>("/api/fleet/devices");
      centralList = result.devices.map(mapWireToDevice);
      available = true;
    } catch {
      available = false;
    }

    setCentralDevices(centralList);
    setCentralAvailable(available);
    setError(available ? null : "Fleet service unavailable");
    setIsLoading(false);

    // Always run local discovery so the UI can show re-pairing options when
    // the device is registered in the fleet but not locally paired.
    const { state, device } = await runLocalDiscovery();
    setLocalDiscovery(state);
    setDirectDevice(device);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { centralDevices, localDiscovery, directDevice, centralAvailable, isLoading, error, refresh };
}
