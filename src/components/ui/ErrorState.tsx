"use client";

import Link from "next/link";
import { Button } from "./Button";

type ErrorStateProps = {
  title?: string;
  description?: string;
  reset?: () => void;
  signInHref?: string;
};

export function ErrorState({
  title = "This page needs a refresh",
  description = "Try loading it again. If your session has ended, sign in and Skillsroom will bring you back here.",
  reset,
  signInHref
}: ErrorStateProps) {
  return (
    <div className="rounded-lg border border-line bg-white p-5 shadow-tight">
      <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Page status</p>
      <h2 className="mt-2 text-xl font-black text-ink">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">{description}</p>
      <div className="mt-4 flex flex-wrap gap-3">
        {reset ? (
          <Button onClick={reset} type="button" variant="secondary">
            Try again
          </Button>
        ) : null}
        {signInHref ? (
          <Link
            className="inline-flex min-h-control items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action transition hover:bg-actionHover"
            href={signInHref}
          >
            Sign in
          </Link>
        ) : null}
      </div>
    </div>
  );
}
