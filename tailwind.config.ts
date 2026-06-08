import type { Config } from "tailwindcss";
import { tokens } from "./src/styles/tokens";

const config: Config = {
  content: ["./src/app/**/*.{ts,tsx}", "./src/components/**/*.{ts,tsx}", "./src/lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: tokens.color.bg,
        ink: tokens.color.ink,
        muted: tokens.color.muted,
        dim: tokens.color.dim,
        surface: tokens.color.surface,
        surfaceHigh: tokens.color.surfaceHigh,
        surfaceWarm: tokens.color.surfaceWarm,
        line: tokens.color.line,
        lineStrong: tokens.color.lineStrong,
        action: tokens.color.action,
        actionHover: tokens.color.actionHover,
        cyan: tokens.color.cyan,
        success: tokens.color.success,
        successSoft: tokens.color.successSoft,
        warning: tokens.color.warning,
        warningSoft: tokens.color.warningSoft,
        danger: tokens.color.danger,
        dangerSoft: tokens.color.dangerSoft,
        cyanSoft: tokens.color.cyanSoft,
        navy: {
          950: tokens.color.navy950,
          900: tokens.color.navy900,
          800: tokens.color.navy800
        },
        slate: {
          900: tokens.color.slate900,
          700: tokens.color.slate700,
          500: tokens.color.slate500,
          300: tokens.color.slate300
        }
      },
      fontFamily: {
        ui: ["var(--font-geist)", "Inter", "system-ui", "sans-serif"],
        display: ["var(--font-space)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "SFMono-Regular", "Consolas", "monospace"]
      },
      borderRadius: tokens.radius,
      boxShadow: tokens.shadow,
      fontSize: {
        xs: ["0.75rem", { lineHeight: "1rem" }],
        sm: ["0.875rem", { lineHeight: "1.35rem" }],
        base: ["1rem", { lineHeight: "1.625rem" }],
        lg: ["1.125rem", { lineHeight: "1.75rem" }],
        xl: ["1.375rem", { lineHeight: "1.9rem" }],
        "2xl": ["1.75rem", { lineHeight: "2.15rem" }],
        "3xl": ["2.25rem", { lineHeight: "2.6rem" }]
      },
      spacing: {
        page: tokens.spacing.pageX,
        section: tokens.spacing.sectionGap,
        card: tokens.spacing.cardPad,
        control: tokens.spacing.controlH
      }
    }
  },
  plugins: []
};

export default config;
