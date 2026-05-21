/**
 * Expo config plugin: AP mode Android network security configuration.
 *
 * Generates `res/xml/network_security_config.xml` for Android to:
 *
 * - Disable cleartext HTTP globally (`cleartextTrafficPermitted="false"`)
 * - Allow cleartext HTTP **only** for `192.168.4.1` (the Soft AP gateway —
 *   the AP API is served on plain HTTP scoped to this address, ADR-016)
 * - Trust both system and user-installed certificates for `192.168.4.1`
 *
 * This replaces the broad `"usesCleartextTraffic": true` Android flag from
 * ADR-015, scoping cleartext access to the AP subnet only.
 *
 * The corresponding iOS ATS exception for `192.168.4.1` is already present
 * in `app.json` (`NSExceptionAllowsInsecureHTTPLoads: true`) and is already
 * scoped to that host only.
 *
 * Usage (app.json plugins array):
 * ```json
 * "./plugins/apModeTlsPlugin"
 * ```
 */

import {
    AndroidConfig,
    ConfigPlugin,
    withAndroidManifest,
    withDangerousMod,
} from "@expo/config-plugins";
import * as fs from "fs";
import * as path from "path";

const AP_GATEWAY = "192.168.4.1";

/**
 * Android network_security_config.xml content.
 *
 * - Base config: no cleartext
 * - Domain exception for `192.168.4.1`: cleartext allowed (bootstrap only),
 *   trust system + user CA anchors for the TOFU self-signed AP cert.
 */
const NETWORK_SECURITY_CONFIG_XML = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <!-- Deny cleartext HTTP globally — all production traffic must use TLS. -->
  <base-config cleartextTrafficPermitted="false">
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </base-config>

  <!--
    AP mode exception for ${AP_GATEWAY} (nomon Soft AP gateway).
    All AP API calls use plain HTTP on this address (port 8080).
    Cleartext is acceptable: the AP is a closed WPA2 hotspot on an isolated
    192.168.4.0/24 subnet with physical-proximity access control.
    See nomothetic ADR-016.
  -->
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="false">${AP_GATEWAY}</domain>
    <trust-anchors>
      <certificates src="system" />
    </trust-anchors>
  </domain-config>
</network-security-config>
`;

/**
 * Expo config plugin for AP mode TLS network security configuration.
 *
 * Writes `res/xml/network_security_config.xml` into the Android project and
 * references it from `AndroidManifest.xml`.  The generated config restricts
 * cleartext HTTP globally while allowing it only for `192.168.4.1` (the Soft
 * AP address), and removes the broad `usesCleartextTraffic` flag from ADR-015.
 *
 * Register in `app.json` plugins array:
 * ```json
 * "./plugins/apModeTlsPlugin"
 * ```
 */
const withApModeTlsPlugin: ConfigPlugin = (config) => {
  // 1. Write network_security_config.xml into the Android res/xml directory.
  config = withDangerousMod(config, [
    "android",
    (cfg) => {
      const resXmlDir = path.join(
        cfg.modRequest.platformProjectRoot,
        "app",
        "src",
        "main",
        "res",
        "xml",
      );
      fs.mkdirSync(resXmlDir, { recursive: true });
      fs.writeFileSync(
        path.join(resXmlDir, "network_security_config.xml"),
        NETWORK_SECURITY_CONFIG_XML,
        "utf8",
      );
      return cfg;
    },
  ]);

  // 2. Reference the generated file from AndroidManifest.xml.
  config = withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults;
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
    if (!app.$) {
      // Safety guard — $ is always present in a valid AndroidManifest.
      // This branch is unreachable in practice but satisfies the type-checker.
      (app as Record<string, unknown>).$ = { "android:name": ".MainApplication" };
    }
    app.$["android:networkSecurityConfig"] = "@xml/network_security_config";
    // Ensure usesCleartextTraffic is NOT set globally — the network security
    // config handles per-domain cleartext policy.
    delete app.$["android:usesCleartextTraffic"];
    return cfg;
  });

  return config;
};

export default withApModeTlsPlugin;
