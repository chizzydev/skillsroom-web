"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type CountUpProps = {
  value: string;
  durationMs?: number;
};

function parseCount(value: string) {
  const trimmed = value.trim();
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
  const numeric = Number(trimmed);
  return Number.isFinite(numeric) ? numeric : null;
}

function formatCount(value: number, decimals: number) {
  return new Intl.NumberFormat("en-NG", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals
  }).format(value);
}

export function CountUp({ value, durationMs = 900 }: CountUpProps) {
  const target = useMemo(() => parseCount(value), [value]);
  const decimals = value.includes(".") ? value.split(".")[1]?.length ?? 0 : 0;
  const [current, setCurrent] = useState(target ?? null);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    if (target === null) return;
    const targetValue = target;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      setCurrent(targetValue);
      return;
    }

    const start = performance.now();
    const from = 0;

    function tick(now: number) {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(from + (targetValue - from) * eased);
      if (progress < 1) frameRef.current = window.requestAnimationFrame(tick);
    }

    frameRef.current = window.requestAnimationFrame(tick);

    return () => {
      if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current);
    };
  }, [durationMs, target]);

  if (target === null || current === null) return <>{value}</>;
  return <>{formatCount(current, decimals)}</>;
}
