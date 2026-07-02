import { Badge } from "@/components/ui/Badge";
import { PasswordField } from "@/components/auth/PasswordField";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PendingLink } from "@/components/ui/PendingLink";

type ResetPasswordPageProps = {
  searchParams?: Promise<{ token?: string; error?: string }>;
};

function resetErrorMessage(error?: string) {
  if (error === "password_mismatch") return "The two passwords did not match.";
  return "That link is no longer valid. Request a fresh one and try again.";
}

export default async function ResetPasswordPage({ searchParams }: ResetPasswordPageProps) {
  const params = await searchParams;
  const token = params?.token ?? "";

  return (
    <main className="min-h-screen bg-[#07111c] px-4 py-6 sm:py-10">
      <div className="mx-auto grid max-w-xl gap-4">
        <section className="rounded-[1.5rem] border border-white/10 bg-white/95 p-5 shadow-[0_30px_80px_rgba(3,10,20,0.3)] backdrop-blur sm:p-6">
          <Badge tone="cyan">Password setup</Badge>
          <h1 className="mt-3 text-2xl font-black text-ink sm:text-3xl">Choose your new password</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            This will be the password you use for normal Skillsroom sign-in. If you are an admin, it will also be the one used for sensitive-action unlocks.
          </p>

          {!token ? (
            <div className="mt-4 rounded-md border border-danger bg-red-50 p-3 text-sm font-bold text-danger">
              This page is missing the secure link details. Request a fresh password email.
            </div>
          ) : null}
          {params?.error ? (
            <div className="mt-4 rounded-md border border-danger bg-red-50 p-3 text-sm font-bold text-danger">
              {resetErrorMessage(params.error)}
            </div>
          ) : null}

          <form action="/api/auth/password-reset/complete" className="mt-6 grid gap-4" method="post">
            <input name="token" type="hidden" value={token} />
            <PasswordField autoComplete="new-password" enterKeyHint="next" label="New password" minLength={10} name="password" />
            <PasswordField autoComplete="new-password" enterKeyHint="done" label="Confirm password" minLength={10} name="password_confirm" />
            <SubmitButton fullWidth idleLabel="Save password" pendingLabel="Saving password..." />
          </form>

          <p className="mt-5 text-sm leading-6 text-muted">
            Need another link?{" "}
            <PendingLink className="text-ink underline decoration-action decoration-2 underline-offset-4" href="/forgot-password" pendingLabel="Opening password help...">
              Send a fresh password email
            </PendingLink>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
