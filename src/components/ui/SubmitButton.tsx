"use client";

import type { ButtonHTMLAttributes } from "react";
import { FormActionButton } from "./FormActionButton";

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
  return (
    <FormActionButton
      className={className}
      disabled={disabled}
      fullWidth={fullWidth}
      idleLabel={idleLabel}
      pendingLabel={pendingLabel}
      size={size}
      variant={variant}
      {...props}
    />
  );
}
