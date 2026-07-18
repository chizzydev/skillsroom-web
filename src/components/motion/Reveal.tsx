"use client";

import { type CSSProperties, type HTMLAttributes } from "react";

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

export function Reveal({
  as: Tag = "div",
  children,
  className = "",
  delayMs = 0,
  staggerIndex = 0,
  staggerMs = 75,
  threshold: _threshold = 0.16,
  once: _once = true,
  variant = "up",
  style,
  ...props
}: RevealProps) {
  const delay = delayMs + staggerIndex * staggerMs;
  void _threshold;
  void _once;

  return (
    <Tag
      className={["motion-reveal", "is-visible", className].join(" ")}
      data-motion-variant={variant}
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
