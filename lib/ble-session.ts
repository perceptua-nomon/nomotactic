/**
 * BLE session security — HKDF key derivation and AES-128-CCM encryption.
 *
 * Implements the nomon BLE security model (nomopractic ADR-003):
 * - HKDF-SHA256 derives a 16-byte AES key from the pairing secret + salt
 * - AES-128-CCM encrypts/decrypts command frames with counter-based nonces
 * - Counter monotonicity prevents replay attacks
 */

import { ccm } from "@noble/ciphers/aes";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha256";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** HKDF info string per ADR-003. */
const HKDF_INFO = "nomon-ble-session";

/** AES key length in bytes. */
const KEY_LENGTH = 16;

/** AES-CCM authentication tag length in bytes. */
const TAG_LENGTH = 4;

/** AES-CCM nonce length in bytes. */
const NONCE_LENGTH = 13;

/** Direction byte: client → server. */
const DIR_CLIENT_TO_SERVER = 0x00;

/** Direction byte: server → client. */
const DIR_SERVER_TO_CLIENT = 0x01;

// ---------------------------------------------------------------------------
// Key derivation
// ---------------------------------------------------------------------------

/**
 * Derive a 16-byte AES-128 session key from the pairing secret and salt.
 *
 * Uses HKDF-SHA256 with info="nomon-ble-session" per ADR-003.
 */
export function deriveSessionKey(secret: string, salt: Uint8Array): Uint8Array {
  const ikm = new TextEncoder().encode(secret);
  return hkdf(sha256, ikm, salt, HKDF_INFO, KEY_LENGTH);
}

// ---------------------------------------------------------------------------
// Nonce construction
// ---------------------------------------------------------------------------

/**
 * Build a 13-byte AES-CCM nonce per ADR-003:
 * "NM" (2 bytes) || direction (1 byte) || counter_le (2 bytes) || 0x00 × 8
 */
function buildNonce(direction: number, counter: number): Uint8Array {
  const nonce = new Uint8Array(NONCE_LENGTH);
  // "NM" prefix
  nonce[0] = 0x4e; // 'N'
  nonce[1] = 0x4d; // 'M'
  nonce[2] = direction;
  // Counter as u16 LE
  nonce[3] = counter & 0xff;
  nonce[4] = (counter >> 8) & 0xff;
  // Remaining 8 bytes are zero (already initialised)
  return nonce;
}

// ---------------------------------------------------------------------------
// BLE Session
// ---------------------------------------------------------------------------

/**
 * Manages encrypted BLE communication for a paired session.
 *
 * Holds the session key, JWT, and monotonic counters for both directions.
 */
export class BleSession {
  private _sessionKey: Uint8Array;
  private _jwt: string;
  private _txCounter: number;
  private _rxCounter: number;
  private _receivedFirstMessage: boolean;

  constructor(sessionKey: Uint8Array, jwt: string) {
    if (sessionKey.length !== KEY_LENGTH) {
      throw new RangeError(
        `Session key must be ${KEY_LENGTH} bytes, got ${sessionKey.length}`,
      );
    }
    this._sessionKey = sessionKey;
    this._jwt = jwt;
    this._txCounter = 0;
    this._rxCounter = 0;
    this._receivedFirstMessage = false;
  }

  /** The JWT token obtained during pairing, usable for HTTPS auth. */
  get jwt(): string {
    return this._jwt;
  }

  /** Current TX counter value. */
  get txCounter(): number {
    return this._txCounter;
  }

  /** Current RX counter value. */
  get rxCounter(): number {
    return this._rxCounter;
  }

  /**
   * Encrypt a plaintext payload for sending to the device.
   *
   * Returns: counter_le (2 bytes) || ciphertext || tag (4 bytes).
   * The AAD (opcode, seq_nr, length header bytes) is authenticated but not encrypted.
   */
  encrypt(plaintext: Uint8Array, aad: Uint8Array): Uint8Array {
    const counter = this._txCounter;
    if (counter >= 0xffff) {
      throw new Error("TX counter overflow — session must be re-established");
    }

    const nonce = buildNonce(DIR_CLIENT_TO_SERVER, counter);
    const cipher = ccm(this._sessionKey, nonce, aad, TAG_LENGTH);
    const encrypted = cipher.encrypt(plaintext);

    // Prepend counter as u16 LE
    const result = new Uint8Array(2 + encrypted.length);
    result[0] = counter & 0xff;
    result[1] = (counter >> 8) & 0xff;
    result.set(encrypted, 2);

    this._txCounter = counter + 1;
    return result;
  }

  /**
   * Decrypt a ciphertext received from the device.
   *
   * Input format: counter_le (2 bytes) || ciphertext || tag (4 bytes).
   * Verifies counter > rxCounter to reject replays.
   */
  decrypt(ciphertext: Uint8Array, aad: Uint8Array): Uint8Array {
    if (ciphertext.length < 2 + TAG_LENGTH) {
      throw new RangeError(
        `Encrypted frame too short: ${ciphertext.length} bytes`,
      );
    }

    // Extract counter (u16 LE)
    const counter = ciphertext[0] | (ciphertext[1] << 8);

    if (this._receivedFirstMessage && counter <= this._rxCounter) {
      throw new Error(
        `Replay detected: received counter ${counter}, expected > ${this._rxCounter}`,
      );
    }

    const nonce = buildNonce(DIR_SERVER_TO_CLIENT, counter);
    const cipher = ccm(this._sessionKey, nonce, aad, TAG_LENGTH);
    const payload = ciphertext.slice(2);
    const decrypted = cipher.decrypt(payload);

    this._rxCounter = counter;
    this._receivedFirstMessage = true;
    return decrypted;
  }
}
