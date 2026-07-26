"use client";

import { useRef } from "react";

export function RoomCodeInput() {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <input
      autoCapitalize="characters"
      autoComplete="off"
      className="mt-2 min-h-11 w-full rounded-md border border-white/10 bg-white px-3 font-mono text-base font-black uppercase text-ink outline-none focus:border-action"
      enterKeyHint="go"
      inputMode="text"
      maxLength={12}
      name="room_code"
      onInput={(event) => {
        const input = event.currentTarget;
        const value = input.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
        if (input.value !== value) input.value = value;
      }}
      placeholder="SR8K21"
      ref={inputRef}
      required
      spellCheck={false}
    />
  );
}
