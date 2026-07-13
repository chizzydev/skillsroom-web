"use client";

import { useEffect, useState } from "react";
import { realtimePatchEventName, type RealtimePatchDetail, type RealtimePatchTarget } from "./realtimePatches";

type RealtimePatchStatusProps = {
  className?: string;
  label: string;
  targets: RealtimePatchTarget[];
};

export function RealtimePatchStatus({ className, label, targets }: RealtimePatchStatusProps) {
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const targetSet = new Set(targets);
    const onPatch = (event: Event) => {
      const customEvent = event as CustomEvent<RealtimePatchDetail>;
      if (!targetSet.has(customEvent.detail.target)) return;
      customEvent.detail.handled = true;
      setCount((current) => current + 1);
      setUpdatedAt(new Date().toISOString());
    };

    window.addEventListener(realtimePatchEventName, onPatch);
    return () => window.removeEventListener(realtimePatchEventName, onPatch);
  }, [targets]);

  if (!updatedAt) return null;

  return (
    <div className={["rounded-md border border-cyan bg-cyanSoft px-3 py-2 text-xs font-black text-cyan", className ?? ""].join(" ")}>
      {label} patched live at {new Date(updatedAt).toLocaleTimeString("en-NG", { hour: "2-digit", minute: "2-digit" })}
      {count > 1 ? ` (${count})` : ""}
    </div>
  );
}
