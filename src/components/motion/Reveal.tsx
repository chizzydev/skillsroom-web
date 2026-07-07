"use client";

import { useEffect, useRef, useState, type CSSProperties, type HTMLAttributes } from "react";

type RevealTag = "div" | "section" | "article" | "header" | "footer" | "li" | "aside";
type RevealVariant = "fade" | "up" | "down" | "left" | "right" | "scale" | "blur";

type RevealProps = HTMLAttributes<HTMLElement> & {
  as?: RevealTag;
  delayMs?: number;
  staggerIndex?: number;
  staggerMs?: number;
  threshold?: number;
  once?: boolean;
  variant?: RevealVariant;
};

function prefersReducedMotion() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function Reveal({
  as: Tag = "div",
  children,
  className = "",
  delayMs = 0,
  staggerIndex = 0,
  staggerMs = 75,
  threshold = 0.16,
  once = true,
  variant = "up",
  style,
  ...props
}: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const delay = delayMs + staggerIndex * staggerMs;

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.unobserve(entry.target);
          return;
        }

        if (!once) setIsVisible(false);
      },
      { rootMargin: "0px 0px -8% 0px", threshold }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [once, threshold]);

  return (
    <Tag
      className={["motion-reveal", isVisible ? "is-visible" : "", className].join(" ")}
      data-motion-variant={variant}
      ref={ref as never}
      style={
        {
          ...style,
          "--motion-delay": `${delay}ms`
        } as CSSProperties
      }
      {...props}
    >
      {children}
    </Tag>
  );
}
