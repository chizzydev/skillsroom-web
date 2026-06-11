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

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
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
