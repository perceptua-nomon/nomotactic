/**
 * Dark theme palette, spacing, and typography constants.
 *
 * Primary: dark background with blue accents.
 * Used throughout the app for consistent styling.
 */

export const colors = {
  /** Primary background (near-black). */
  background: "#0D1117",
  /** Card / surface background. */
  surface: "#161B22",
  /** Elevated surface (modals, overlays). */
  surfaceElevated: "#1C2128",
  /** Primary accent (blue). */
  primary: "#58A6FF",
  /** Primary accent pressed state. */
  primaryPressed: "#388BFD",
  /** Secondary accent (teal). */
  secondary: "#3FB950",
  /** Warning (amber). */
  warning: "#D29922",
  /** Error / destructive (red). */
  error: "#F85149",
  /** Primary text (high contrast). */
  text: "#E6EDF3",
  /** Secondary text (muted). */
  textSecondary: "#8B949E",
  /** Placeholder / disabled text. */
  textMuted: "#484F58",
  /** Border / divider. */
  border: "#30363D",
  /** Transparent overlay for modals. */
  overlay: "rgba(0, 0, 0, 0.5)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const typography = {
  /** Hero / page title. */
  title: {
    fontSize: 28,
    fontWeight: "700" as const,
    color: colors.text,
  },
  /** Section heading. */
  heading: {
    fontSize: 20,
    fontWeight: "600" as const,
    color: colors.text,
  },
  /** Body text. */
  body: {
    fontSize: 16,
    fontWeight: "400" as const,
    color: colors.text,
  },
  /** Caption / secondary text. */
  caption: {
    fontSize: 13,
    fontWeight: "400" as const,
    color: colors.textSecondary,
  },
  /** Small label text. */
  label: {
    fontSize: 14,
    fontWeight: "500" as const,
    color: colors.textSecondary,
  },
} as const;

export const borderRadius = {
  sm: 6,
  md: 10,
  lg: 16,
} as const;
