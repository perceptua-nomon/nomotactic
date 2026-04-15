/**
 * Binary protocol codec for BLE GATT communication.
 *
 * Matches the nomopractic ADR-002 binary protocol: compact fixed-format
 * frames with opcode/seq_nr/length header and little-endian payloads.
 */

// ---------------------------------------------------------------------------
// Opcodes
// ---------------------------------------------------------------------------

/** Request opcodes sent from client to device. */
export enum Opcode {
  Heartbeat = 0x01,
  GetBattery = 0x02,
  SetMotorSpeed = 0x03,
  StopAllMotors = 0x04,
  SetServoAngle = 0x05,
  Drive = 0x06,
  Steer = 0x07,
  ReadUltrasonic = 0x08,
  ReadGrayscale = 0x09,
  GetHealth = 0x0a,
}

/** Response opcodes (request opcode | 0x80). */
export enum ResponseOpcode {
  HeartbeatAck = 0x81,
  BatteryResult = 0x82,
  MotorAck = 0x83,
  StopAck = 0x84,
  ServoAck = 0x85,
  DriveAck = 0x86,
  SteerAck = 0x87,
  UltrasonicResult = 0x88,
  GrayscaleResult = 0x89,
  HealthResult = 0x8a,
  Error = 0xff,
}

/** BLE-level error codes returned in Error response. */
export enum BleErrorCode {
  UnknownCommand = 0x01,
  InvalidParams = 0x02,
  HardwareError = 0x03,
  NotAuthenticated = 0x04,
  NotReady = 0x05,
  InternalError = 0x06,
}

// ---------------------------------------------------------------------------
// Frame header
// ---------------------------------------------------------------------------

/** Header size: opcode (1) + seq_nr (1) + length (1). */
const HEADER_SIZE = 3;

/** Maximum payload length per ADR-002 (244 - 3 header bytes). */
const MAX_PAYLOAD_LENGTH = 241;

// ---------------------------------------------------------------------------
// Encode / Decode
// ---------------------------------------------------------------------------

/** Parsed response frame. */
export interface BleFrame {
  opcode: number;
  seqNr: number;
  payload: Uint8Array;
}

/**
 * Build a binary request frame: [opcode, seqNr, length, ...payload].
 */
export function encodeRequest(
  opcode: Opcode,
  seqNr: number,
  payload: Uint8Array,
): Uint8Array {
  if (payload.length > MAX_PAYLOAD_LENGTH) {
    throw new RangeError(
      `Payload length ${payload.length} exceeds max ${MAX_PAYLOAD_LENGTH}`,
    );
  }
  const frame = new Uint8Array(HEADER_SIZE + payload.length);
  frame[0] = opcode;
  frame[1] = seqNr & 0xff;
  frame[2] = payload.length;
  frame.set(payload, HEADER_SIZE);
  return frame;
}

/**
 * Parse a binary response frame into opcode, seqNr, and payload.
 */
export function decodeResponse(data: Uint8Array): BleFrame {
  if (data.length < HEADER_SIZE) {
    throw new RangeError(
      `Frame too short: ${data.length} bytes (min ${HEADER_SIZE})`,
    );
  }
  const opcode = data[0];
  const seqNr = data[1];
  const length = data[2];

  if (data.length < HEADER_SIZE + length) {
    throw new RangeError(
      `Frame truncated: declared ${length} payload bytes but only ${data.length - HEADER_SIZE} available`,
    );
  }

  return {
    opcode,
    seqNr,
    payload: data.slice(HEADER_SIZE, HEADER_SIZE + length),
  };
}

// ---------------------------------------------------------------------------
// Fixed-point conversion helpers
// ---------------------------------------------------------------------------

/** Convert speed percentage (-100.0 .. 100.0) to i16 × 100. */
export function speedToI16(speed: number): number {
  const clamped = Math.max(-100, Math.min(100, speed));
  const scaled = Math.round(clamped * 100);
  // Clamp to i16 range
  return Math.max(-32768, Math.min(32767, scaled));
}

/** Convert i16 × 100 back to speed percentage. */
export function i16ToSpeed(raw: number): number {
  // Sign-extend from i16 if needed
  const signed = raw > 32767 ? raw - 65536 : raw;
  return signed / 100;
}

/** Convert angle in degrees (0.0 .. 180.0) to u16 × 10. */
export function angleToU16(angle: number): number {
  const clamped = Math.max(0, Math.min(180, angle));
  return Math.round(clamped * 10);
}

/** Convert u16 × 10 back to angle in degrees. */
export function u16ToAngle(raw: number): number {
  return raw / 10;
}

/** Convert millivolts to volts. */
export function mvToVoltage(mv: number): number {
  return mv / 1000;
}

// ---------------------------------------------------------------------------
// Typed response decoders
// ---------------------------------------------------------------------------

/** Decoded battery response. */
export interface BatteryResult {
  voltageMv: number;
  rawAdc: number;
}

/** Decode a BatteryResult payload (4 bytes: voltage_mv u16 + raw_adc u16). */
export function decodeBatteryResult(payload: Uint8Array): BatteryResult {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  return {
    voltageMv: view.getUint16(0, true),
    rawAdc: view.getUint16(2, true),
  };
}

/** Decoded drive acknowledgement. */
export interface DriveAckResult {
  speedX100: number;
  motors: number;
}

/** Decode a DriveAck payload (3 bytes: speed_x100 i16 + motors u8). */
export function decodeDriveAck(payload: Uint8Array): DriveAckResult {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  return {
    speedX100: view.getInt16(0, true),
    motors: payload[2],
  };
}

/** Decoded steer acknowledgement. */
export interface SteerAckResult {
  angleX10: number;
  channel: number;
}

/** Decode a SteerAck payload (3 bytes: angle_x10 u16 + channel u8). */
export function decodeSteerAck(payload: Uint8Array): SteerAckResult {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  return {
    angleX10: view.getUint16(0, true),
    channel: payload[2],
  };
}

/** Decoded ultrasonic result. */
export interface UltrasonicResult {
  distanceX10: number;
}

/** Decode an UltrasonicResult payload (2 bytes: distance_x10 u16). */
export function decodeUltrasonicResult(payload: Uint8Array): UltrasonicResult {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  return {
    distanceX10: view.getUint16(0, true),
  };
}

/** Decoded grayscale result. */
export interface GrayscaleResult {
  v0: number;
  v1: number;
  v2: number;
}

/** Decode a GrayscaleResult payload (6 bytes: v0 u16 + v1 u16 + v2 u16). */
export function decodeGrayscaleResult(payload: Uint8Array): GrayscaleResult {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  return {
    v0: view.getUint16(0, true),
    v1: view.getUint16(2, true),
    v2: view.getUint16(4, true),
  };
}

/** Decoded health result. */
export interface HealthResult {
  status: number;
  uptimeS: number;
}

/** Decode a HealthResult payload (5 bytes: status u8 + uptime_s u32). */
export function decodeHealthResult(payload: Uint8Array): HealthResult {
  const view = new DataView(payload.buffer, payload.byteOffset, payload.byteLength);
  return {
    status: payload[0],
    uptimeS: view.getUint32(1, true),
  };
}

/** Decoded BLE error response. */
export interface BleErrorResult {
  errorCode: number;
  refSeq: number;
}

/** Decode an Error payload (2 bytes: error_code u8 + ref_seq u8). */
export function decodeError(payload: Uint8Array): BleErrorResult {
  return {
    errorCode: payload[0],
    refSeq: payload[1],
  };
}

// ---------------------------------------------------------------------------
// Payload encoding helpers (for building request payloads)
// ---------------------------------------------------------------------------

/** Encode a Drive request payload: speed_x100 (i16 LE) + ttl_ms (u16 LE). */
export function encodeDrivePayload(speedPct: number, ttlMs: number): Uint8Array {
  const buf = new Uint8Array(4);
  const view = new DataView(buf.buffer);
  view.setInt16(0, speedToI16(speedPct), true);
  view.setUint16(2, ttlMs & 0xffff, true);
  return buf;
}

/** Encode a Steer request payload: angle_x10 (u16 LE) + ttl_ms (u16 LE). */
export function encodeSteerPayload(angleDeg: number, ttlMs: number): Uint8Array {
  const buf = new Uint8Array(4);
  const view = new DataView(buf.buffer);
  view.setUint16(0, angleToU16(angleDeg), true);
  view.setUint16(2, ttlMs & 0xffff, true);
  return buf;
}

/** Encode a SetMotorSpeed payload: channel (u8) + speed_x100 (i16 LE) + ttl_ms (u16 LE). */
export function encodeSetMotorSpeedPayload(
  channel: number,
  speedPct: number,
  ttlMs: number,
): Uint8Array {
  const buf = new Uint8Array(5);
  const view = new DataView(buf.buffer);
  buf[0] = channel & 0xff;
  view.setInt16(1, speedToI16(speedPct), true);
  view.setUint16(3, ttlMs & 0xffff, true);
  return buf;
}

/** Encode a SetServoAngle payload: channel (u8) + angle_x10 (u16 LE) + ttl_ms (u16 LE). */
export function encodeSetServoAnglePayload(
  channel: number,
  angleDeg: number,
  ttlMs: number,
): Uint8Array {
  const buf = new Uint8Array(5);
  const view = new DataView(buf.buffer);
  buf[0] = channel & 0xff;
  view.setUint16(1, angleToU16(angleDeg), true);
  view.setUint16(3, ttlMs & 0xffff, true);
  return buf;
}
