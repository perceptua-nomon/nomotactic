/**
 * API endpoint constants — single source of truth for all REST paths.
 */

export const ENDPOINTS = {
  DRIVE: "/api/drive",
  STEER: "/api/steer",
  MOTOR_STOP: "/api/hat/motor/stop",
  MOTOR_SPEED: "/api/hat/motor/speed",
  SERVO_ANGLE: "/api/hat/servo/angle",
  BATTERY: "/api/hat/battery",
  CAMERA_CAPTURE: "/api/camera/capture",
  STREAM_START: "/api/stream/start",
  STREAM_STOP: "/api/stream/stop",
  ULTRASONIC: "/api/sensor/ultrasonic",
  GRAYSCALE: "/api/sensor/grayscale",
  ROUTINE_STATUS: "/api/routine/status",
  ROUTINE_START: "/api/routine/start",
  ROUTINE_STOP: "/api/routine/stop",
} as const;
