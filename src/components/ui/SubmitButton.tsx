"use client";

import type { ButtonHTMLAttributes } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./Button";

type SubmitButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type"> & {
  pendingLabel?: string;
  idleLabel: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
};

export function SubmitButton({
  pendingLabel = "Submitting...",
  idleLabel,
  disabled,
  variant,
  size,
  fullWidth,
  className,
  ...props
}: SubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <Button
      aria-busy={pending}
      className={className}
      disabled={disabled || pending}
      fullWidth={fullWidth}
      size={size}
      type="submit"
      variant={variant}
      {...props}
    >
      {pending ? pendingLabel : idleLabel}
    </Button>
  );
}
