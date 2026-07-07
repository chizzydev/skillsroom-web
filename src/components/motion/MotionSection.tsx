import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

type MotionSectionProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
  delayMs?: number;
  variant?: "page" | "section" | "hero";
};

export function MotionSection({
  children,
  className = "",
  delayMs = 0,
  variant = "section",
  style,
  ...props
}: MotionSectionProps) {
  const variantClass = {
    page: "motion-page-enter",
    section: "motion-section-enter",
    hero: "motion-hero-enter"
  }[variant];

  return (
    <section
      className={[variantClass, className].join(" ")}
      style={
        {
          ...style,
          "--motion-delay": `${delayMs}ms`
        } as CSSProperties
      }
      {...props}
    >
      {children}
    </section>
  );
}
