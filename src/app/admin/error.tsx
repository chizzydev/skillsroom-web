"use client";

import { ErrorState } from "@/components/ui/ErrorState";

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="min-h-screen bg-bg p-4 md:p-6">
      <div className="mx-auto max-w-4xl">
        <ErrorState
          description="The command center could not load one or more live queues. Try again after confirming the API and your admin session are active."
          reset={reset}
          title="Admin command center unavailable"
        />
      </div>
    </main>
  );
}
