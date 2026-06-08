"use client";

import { Button } from "./Button";

type ErrorStateProps = {
  title?: string;
  description?: string;
  reset?: () => void;
};

export function ErrorState({
  title = "Something could not load",
  description = "Refresh the page or try again after checking your connection and session.",
  reset
}: ErrorStateProps) {
  return (
    <div className="rounded-lg border border-danger bg-dangerSoft p-5 shadow-tight">
      <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-danger">Error</p>
      <h2 className="mt-2 text-xl font-black text-ink">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>
      {reset ? (
        <Button className="mt-4" onClick={reset} type="button" variant="danger">
          Try again
        </Button>
      ) : null}
    </div>
  );
}
