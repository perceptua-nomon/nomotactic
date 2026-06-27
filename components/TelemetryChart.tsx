/**
 * Telemetry history line chart.
 *
 * Renders a single metric (battery voltage, CPU temp, uptime) over time from a
 * list of telemetry readings, using react-native-svg primitives so it works on
 * web and mobile without a third-party chart kit.
 */

import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Svg, { Circle, Line, Path } from "react-native-svg";

import { type TelemetryReading } from "@/lib/fleet";
import { borderRadius, colors, spacing, typography } from "@/lib/theme";

/** Metric keys that can be charted. */
export type TelemetryMetric = "battery_voltage" | "cpu_temp_c" | "uptime_seconds";

interface TelemetryChartProps {
  readings: TelemetryReading[];
  metric: TelemetryMetric;
  /** Axis/series label (e.g. "Battery"). */
  label: string;
  /** Unit suffix shown on min/max labels (e.g. "V", "°C"). */
  unit?: string;
  /** Chart height in px (default 160). */
  height?: number;
}

const PADDING = 8;
const WIDTH = 300; // viewBox width; Svg scales to container width.

export function TelemetryChart({
  readings,
  metric,
  label,
  unit = "",
  height = 160,
}: TelemetryChartProps) {
  const series = useMemo(() => {
    // Oldest → newest for left-to-right plotting.
    const sorted = [...readings].sort(
      (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime(),
    );
    return sorted.map((r) => r[metric]);
  }, [readings, metric]);

  if (series.length === 0) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>No telemetry yet</Text>
      </View>
    );
  }

  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = max - min || 1; // avoid divide-by-zero for a flat series
  const innerW = WIDTH - PADDING * 2;
  const innerH = height - PADDING * 2;

  const points = series.map((value, i) => {
    const x = PADDING + (series.length === 1 ? innerW / 2 : (i / (series.length - 1)) * innerW);
    const y = PADDING + innerH - ((value - min) / span) * innerH;
    return { x, y };
  });

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(" ");
  const areaPath =
    `M${points[0].x.toFixed(1)},${(height - PADDING).toFixed(1)} ` +
    points.map((p) => `L${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ") +
    ` L${points[points.length - 1].x.toFixed(1)},${(height - PADDING).toFixed(1)} Z`;

  const fmt = (v: number) => `${v.toFixed(metric === "uptime_seconds" ? 0 : 1)}${unit}`;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.label}>{label}</Text>
        <Text style={styles.range}>
          {fmt(min)} – {fmt(max)}
        </Text>
      </View>
      <Svg width="100%" height={height} viewBox={`0 0 ${WIDTH} ${height}`}>
        {/* baseline */}
        <Line
          x1={PADDING}
          y1={height - PADDING}
          x2={WIDTH - PADDING}
          y2={height - PADDING}
          stroke={colors.border}
          strokeWidth={1}
        />
        <Path d={areaPath} fill={colors.primary} fillOpacity={0.12} />
        <Path
          d={linePath}
          stroke={colors.primary}
          strokeWidth={2}
          fill="none"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {points.length <= 30 &&
          points.map((p, i) => (
            <Circle key={i} cx={p.x} cy={p.y} r={2.5} fill={colors.primary} />
          ))}
      </Svg>
      <Text style={styles.caption}>{series.length} readings</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.md,
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    marginBottom: spacing.xs,
  },
  label: {
    ...typography.label,
    color: colors.text,
  },
  range: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  caption: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  empty: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceElevated,
    borderRadius: borderRadius.sm,
  },
  emptyText: {
    ...typography.caption,
    color: colors.textMuted,
  },
});
