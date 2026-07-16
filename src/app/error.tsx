"use client";

import { ErrorState } from "@/components/ui/ErrorState";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-bg p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <ErrorState
          description="The page could not finish loading. Try again, and sign in again if your session has expired."
          reset={reset}
          title="Skillsroom could not load this page"
        />
      </div>
    </main>
  );
}
