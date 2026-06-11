"use client";

import { useEffect, useState, type ButtonHTMLAttributes, type MouseEvent } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "./Button";

type FormActionButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children"> & {
  idleLabel: string;
  pendingLabel?: string;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
};

function matchesPendingSubmitter(
  data: FormData | null,
  name: string | undefined,
  value: ButtonHTMLAttributes<HTMLButtonElement>["value"]
) {
  if (!data || !name) return true;
  const submittedValue = data.get(name);
  if (submittedValue == null) return false;
  return String(submittedValue) === String(value ?? "");
}

export function FormActionButton({
  idleLabel,
  pendingLabel = "Working...",
  disabled,
  variant,
  size,
  fullWidth,
  className,
  name,
  value,
  ...props
}: FormActionButtonProps) {
  const { pending, data } = useFormStatus();
  const [clickedPending, setClickedPending] = useState(false);
  const activePending = (pending && matchesPendingSubmitter(data, typeof name === "string" ? name : undefined, value)) || clickedPending;

  useEffect(() => {
    if (pending) return;
    if (!clickedPending) return;
    const timer = window.setTimeout(() => setClickedPending(false), 12000);
    return () => window.clearTimeout(timer);
  }, [clickedPending, pending]);

  function handleClick(event: MouseEvent<HTMLButtonElement>) {
    props.onClick?.(event);
    if (event.defaultPrevented || disabled) return;
    const form = event.currentTarget.form;
    if (form && !form.reportValidity()) return;
    setClickedPending(true);
  }

  return (
    <Button
      aria-busy={activePending}
      className={className}
      disabled={disabled || pending}
      fullWidth={fullWidth}
      onClick={handleClick}
      name={name}
      size={size}
      type="submit"
      value={value}
      variant={variant}
      {...props}
    >
      {activePending ? pendingLabel : idleLabel}
    </Button>
  );
}
