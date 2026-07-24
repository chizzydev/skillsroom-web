"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { ErrorState } from "@/components/ui/ErrorState";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const query = searchParams.toString();
  const redirectTarget = `${pathname || "/"}${query ? `?${query}` : ""}`;

  return (
    <main className="min-h-screen bg-bg p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <ErrorState
          description="Try loading it again. If your session has ended, sign in and Skillsroom will bring you back here."
          reset={reset}
          signInHref={`/sign-in?redirect=${encodeURIComponent(redirectTarget)}`}
          title="This page needs a refresh"
        />
      </div>
    </main>
  );
}
