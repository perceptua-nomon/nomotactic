/**
 * API base URLs for device and central nomothetic instances.
 *
 * Device URL targets the Raspberry Pi on the local network.
 * Central URL targets the fleet management server.
 */

/** Base URL for the device-mode API on the Raspberry Pi. */
export const DEVICE_API_URL =
  process.env.EXPO_PUBLIC_DEVICE_API_URL || "https://10.0.0.1:8443";

/**
 * Fixed HTTP address of the nomon device when broadcasting its Soft AP.
 * All device API calls during AP pairing use this URL.  Cleartext is
 * intentional: the AP is a closed WPA2 hotspot on an isolated 192.168.4.0/24
 * subnet (see ADR-016).
 */
export const SOFT_AP_URL = "http://192.168.4.1:8080";

/** Base URL for the central-mode API (fleet management). */
export const CENTRAL_API_URL =
  process.env.EXPO_PUBLIC_CENTRAL_API_URL || "https://nomon.example.com";

/** Default request timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 10_000;

/** Extended timeout for data-heavy queries (telemetry, etc.). */
export const DATA_TIMEOUT_MS = 30_000;

/** Interval for auto-refreshing status data (ms). */
export const STATUS_REFRESH_INTERVAL_MS = 1_000;
