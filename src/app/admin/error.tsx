"use client";

import { ErrorState } from "@/components/ui/ErrorState";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-bg p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <ErrorState
          description="The admin page could not load one or more sections. Refresh the page or sign in again if your session expired."
          reset={reset}
          title="Admin command center unavailable"
        />
      </div>
    </main>
  );
}
