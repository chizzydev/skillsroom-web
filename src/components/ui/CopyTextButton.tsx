"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type CopyTextButtonProps = {
  value: string;
  label?: string;
  className?: string;
};

export function CopyTextButton({ value, label = "Value", className = "" }: CopyTextButtonProps) {
  const [copied, setCopied] = useState(false);

  async function fallbackCopy(text: string) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const success = document.execCommand("copy");
    document.body.removeChild(textarea);
    if (!success) {
      throw new Error("Copy failed");
    }
  }

  async function handleCopy() {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        await fallbackCopy(value);
      }
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      try {
        await fallbackCopy(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } catch {
        setCopied(false);
      }
    }
  }

  return (
    <Button
      aria-label={`Copy ${label}`}
      className={className}
      onClick={handleCopy}
      size="sm"
      type="button"
      variant="secondary"
    >
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}
