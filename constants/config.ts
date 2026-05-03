/**
 * API base URLs for device and central nomothetic instances.
 *
 * Device URL targets the Raspberry Pi on the local network.
 * Central URL targets the fleet management server.
 */

/** Base URL for the device-mode API on the Raspberry Pi. */
export const DEVICE_API_URL =
  process.env.EXPO_PUBLIC_DEVICE_API_URL || "https://10.0.0.1:8443";

/** Base URL for the central-mode API (fleet management). */
export const CENTRAL_API_URL =
  process.env.EXPO_PUBLIC_CENTRAL_API_URL || "https://nomon.example.com";

/** Default request timeout in milliseconds. */
export const DEFAULT_TIMEOUT_MS = 10_000;

/** Extended timeout for data-heavy queries (telemetry, etc.). */
export const DATA_TIMEOUT_MS = 30_000;

/** Interval for auto-refreshing status data (ms). */
export const STATUS_REFRESH_INTERVAL_MS = 5_000;

/**
 * Enable mock BLE service on mobile for testing without provisioning.
 * On web, always uses Web Bluetooth API (real) regardless of this flag.
 */
export const ENABLE_BLE_MOCK_MODE = process.env.EXPO_PUBLIC_ENABLE_BLE_MOCK_MODE === "true";
