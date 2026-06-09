"use client";

import { useId, useState } from "react";
import { authFieldClassName } from "./field-styles";

type PasswordFieldProps = {
  label: string;
  name: string;
  autoComplete: string;
  minLength?: number;
  helperText?: string;
  enterKeyHint?: "next" | "done" | "go" | "search" | "send";
};

export function PasswordField({ label, name, autoComplete, minLength, helperText, enterKeyHint }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  const id = useId();

  return (
    <label className="grid gap-2 text-sm font-bold text-ink" htmlFor={id}>
      {label}
      <span className="relative block">
        <input
          autoComplete={autoComplete}
          className={`${authFieldClassName} w-full pr-12`}
          id={id}
          enterKeyHint={enterKeyHint}
          minLength={minLength}
          name={name}
          required
          spellCheck={false}
          type={visible ? "text" : "password"}
        />
        <button
          aria-label={visible ? "Hide password" : "Show password"}
          className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-md text-muted hover:bg-surfaceWarm hover:text-ink focus:outline-none focus:ring-2 focus:ring-action sm:h-8 sm:w-8"
          onClick={() => setVisible((current) => !current)}
          type="button"
        >
          {visible ? (
            <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
              <path d="M3 3l18 18" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
              <path d="M10.6 10.6a2 2 0 002.8 2.8" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
              <path d="M9.5 5.5A8.6 8.6 0 0112 5c5 0 8 4.5 8 7a5.9 5.9 0 01-1.3 3.1" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
              <path d="M6.4 6.8C4.9 8 4 10 4 12c0 2.5 3 7 8 7a8.3 8.3 0 004-.9" stroke="currentColor" strokeLinecap="round" strokeWidth="2" />
            </svg>
          ) : (
            <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24">
              <path d="M4 12c0-2.5 3-7 8-7s8 4.5 8 7-3 7-8 7-8-4.5-8-7z" stroke="currentColor" strokeWidth="2" />
              <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="2" />
            </svg>
          )}
        </button>
      </span>
      {helperText ? <span className="text-xs font-semibold text-muted">{helperText}</span> : null}
    </label>
  );
}
