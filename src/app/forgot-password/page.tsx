import { Badge } from "@/components/ui/Badge";
import { authFieldClassName } from "@/components/auth/field-styles";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { PendingLink } from "@/components/ui/PendingLink";

type ForgotPasswordPageProps = {
  searchParams?: Promise<{ password_link?: string; email?: string }>;
};

export default async function ForgotPasswordPage({ searchParams }: ForgotPasswordPageProps) {
  const params = await searchParams;
  const email = params?.email ?? "";

  return (
    <main className="min-h-screen bg-[#07111c] px-4 py-6 sm:py-10">
      <div className="mx-auto grid max-w-xl gap-4">
        <section className="rounded-[1.5rem] border border-white/10 bg-white/95 p-5 shadow-[0_30px_80px_rgba(3,10,20,0.3)] backdrop-blur sm:p-6">
          <Badge tone="cyan">Password help</Badge>
          <h1 className="mt-3 text-2xl font-black text-ink sm:text-3xl">Get a password link</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Enter your email and we will send you a secure link to create or change your Skillsroom password.
          </p>

          {params?.password_link ? (
            <div className="mt-4 rounded-md border border-success bg-successSoft p-3 text-sm font-bold text-success">
              If that email is on Skillsroom, the link is on the way.
            </div>
          ) : null}

          <form action="/api/auth/password-reset/request" className="mt-6 grid gap-4" method="post">
            <input name="redirect" type="hidden" value="/forgot-password" />
            <label className="grid gap-2 text-sm font-bold text-ink">
              Email
              <input autoComplete="email" className={authFieldClassName} defaultValue={email} name="email" required type="email" />
            </label>
            <SubmitButton fullWidth idleLabel="Send password link" pendingLabel="Sending link..." />
          </form>

          <p className="mt-5 text-sm leading-6 text-muted">
            Remembered it already? Head back to{" "}
            <PendingLink className="text-ink underline decoration-action decoration-2 underline-offset-4" href="/sign-in" pendingLabel="Opening sign in...">
              sign in
            </PendingLink>
            .
          </p>
        </section>
      </div>
    </main>
  );
}
