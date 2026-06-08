export const tokens = {
  color: {
    bg: "#f4f7fb",
    ink: "#07111f",
    muted: "#435367",
    dim: "#7b8797",
    surface: "#ffffff",
    surfaceHigh: "#edf3f8",
    surfaceWarm: "#f9fbfd",
    line: "#d7e1ec",
    lineStrong: "#aebdce",
    action: "#18c58a",
    actionHover: "#10a978",
    cyan: "#24b8e8",
    success: "#13975a",
    warning: "#c97918",
    danger: "#d9364f",
    dangerSoft: "#fff0f3",
    warningSoft: "#fff6e8",
    successSoft: "#ecfbf3",
    cyanSoft: "#eafdff",
    navy950: "#050b14",
    navy900: "#08111f",
    navy800: "#111d2d",
    slate900: "#111827",
    slate700: "#334155",
    slate500: "#64748b",
    slate300: "#cbd5e1"
  },
  spacing: {
    pageX: "clamp(1rem, 4vw, 2rem)",
    sectionGap: "1.25rem",
    cardPad: "1rem",
    controlH: "2.75rem"
  },
  radius: {
    none: "0px",
    sm: "4px",
    md: "8px",
    lg: "10px",
    xl: "14px",
    full: "9999px"
  },
  shadow: {
    panel: "0 18px 45px rgba(7, 17, 31, 0.10)",
    tight: "0 8px 22px rgba(7, 17, 31, 0.075)",
    lift: "0 22px 60px rgba(7, 17, 31, 0.14)",
    action: "0 12px 24px rgba(24, 197, 138, 0.22)",
    inset: "inset 0 1px 0 rgba(255,255,255,0.08)"
  },
  fontSize: {
    xs: ["0.75rem", { lineHeight: "1rem" }],
    sm: ["0.875rem", { lineHeight: "1.35rem" }],
    base: ["1rem", { lineHeight: "1.625rem" }],
    lg: ["1.125rem", { lineHeight: "1.75rem" }],
    xl: ["1.375rem", { lineHeight: "1.9rem" }],
    "2xl": ["1.75rem", { lineHeight: "2.15rem" }],
    "3xl": ["2.25rem", { lineHeight: "2.6rem" }]
  }
} as const;
