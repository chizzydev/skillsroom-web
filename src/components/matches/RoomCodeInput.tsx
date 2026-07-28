"use client";

import { useEffect, useRef } from "react";

export function RoomCodeInput({ variant = "dark" }: { variant?: "dark" | "light" }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const pointerFocusRef = useRef(false);
  const className = variant === "light"
    ? "min-h-11 rounded-md border border-line bg-white px-3 font-mono text-sm font-bold outline-none focus:border-action"
    : "mt-2 min-h-11 w-full rounded-md border border-white/10 bg-white px-3 font-mono text-base font-black text-ink outline-none focus:border-action";

  useEffect(() => {
    const input = inputRef.current;
    if (!input) return;
    const mobilePointer = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    if (mobilePointer && document.activeElement === input) {
      input.blur();
    }
  }, []);

  return (
    <input
      autoCapitalize="none"
      autoComplete="off"
      className={className}
      enterKeyHint="go"
      inputMode="text"
      maxLength={12}
      name="room_code"
      onBlur={() => {
        pointerFocusRef.current = false;
      }}
      onFocus={(event) => {
        const mobilePointer = window.matchMedia("(hover: none) and (pointer: coarse)").matches;
        if (mobilePointer && !pointerFocusRef.current) {
          event.currentTarget.blur();
        }
      }}
      onPointerDown={() => {
        pointerFocusRef.current = true;
      }}
      pattern="[A-Za-z0-9]+"
      placeholder="SR8K21"
      ref={inputRef}
      required
      spellCheck={false}
    />
  );
}
