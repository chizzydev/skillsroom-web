import { apiBaseUrl } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { PendingLink } from "@/components/ui/PendingLink";

type VerifyEmailPageProps = {
  searchParams?: Promise<{ token?: string }>;
};

export default async function VerifyEmailPage({ searchParams }: VerifyEmailPageProps) {
  const params = await searchParams;
  const token = params?.token ?? "";

  let verified = false;
  let message = "Verification link is missing or invalid.";

  if (token) {
    const response = await fetch(`${apiBaseUrl()}/auth/email-verification/complete`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify({ token }),
      cache: "no-store"
    }).catch(() => null);

    if (response?.ok) {
      verified = true;
      message = "Your email has been confirmed. You can sign in now.";
    } else {
      message = "This verification link is no longer valid. Go back to sign in and request a fresh one.";
    }
  }

  return (
    <main className="min-h-screen bg-[#07111c] px-4 py-6 sm:py-10">
      <div className="mx-auto grid max-w-xl gap-4">
        <section className="rounded-[1.5rem] border border-white/10 bg-white/95 p-5 shadow-[0_30px_80px_rgba(3,10,20,0.3)] backdrop-blur sm:p-6">
          <Badge tone={verified ? "success" : "warning"}>{verified ? "Verified" : "Needs a fresh link"}</Badge>
          <h1 className="mt-3 text-2xl font-black text-ink sm:text-3xl">Email verification</h1>
          <p className="mt-4 rounded-md border border-line bg-surfaceWarm p-4 text-sm font-bold text-ink">{message}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <PendingLink className="inline-flex min-h-10 items-center justify-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" href="/sign-in" pendingLabel="Opening sign in...">
              Continue to sign in
            </PendingLink>
            <PendingLink className="inline-flex min-h-10 items-center justify-center rounded-md border border-line bg-white px-4 text-sm font-black text-ink hover:bg-surfaceHigh" href="/register" pendingLabel="Opening registration...">
              Back to account setup
            </PendingLink>
          </div>
        </section>
      </div>
    </main>
  );
}
