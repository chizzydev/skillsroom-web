"use client";

import { useEffect, useRef } from "react";

export function RoomCodeInput() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const resetEntryState = () => {
      const input = inputRef.current;
      if (input && document.activeElement === input) input.blur();
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    };

    const previousScrollRestoration = window.history.scrollRestoration;
    window.history.scrollRestoration = "manual";
    resetEntryState();
    const frame = window.requestAnimationFrame(resetEntryState);
    const timer = window.setTimeout(resetEntryState, 200);
    window.addEventListener("pageshow", resetEntryState);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
      window.removeEventListener("pageshow", resetEntryState);
      window.history.scrollRestoration = previousScrollRestoration;
    };
  }, []);

  return (
    <input
      autoCapitalize="characters"
      autoComplete="off"
      className="mt-2 min-h-11 w-full rounded-md border border-white/10 bg-white px-3 font-mono text-base font-black uppercase text-ink outline-none focus:border-action"
      enterKeyHint="go"
      maxLength={12}
      name="room_code"
      placeholder="SR8K21"
      ref={inputRef}
      required
      spellCheck={false}
    />
  );
}
