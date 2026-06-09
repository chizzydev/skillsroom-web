import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-bridge";
import { Badge } from "@/components/ui/Badge";
import { AuthTrustPanel } from "@/components/auth/AuthTrustPanel";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { PasswordField } from "@/components/auth/PasswordField";
import { authFieldClassName } from "@/components/auth/field-styles";
import { SubmitButton } from "@/components/ui/SubmitButton";

type RegisterPageProps = {
  searchParams?: Promise<{ redirect?: string; error?: string; ref?: string }>;
};

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const existingUser = await getCurrentUser();
  const redirectTo = params?.redirect || "/profile";
  const referralCode = params?.ref?.trim() || "";

  if (existingUser) {
    redirect(redirectTo);
  }

  return (
    <main className="min-h-screen bg-bg px-4 py-6 sm:py-10">
      <div className="mx-auto grid max-w-6xl gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,28rem)] lg:items-center">
        <div className="order-2 lg:order-1">
          <AuthTrustPanel
            ctaHref="/rules"
            ctaLabel="Review competition rules first"
            summary="Create one account for verified rooms, tournament check-ins, evidence submissions, community identity, and future competitive history."
            title="Create a player identity you can keep across matches and tournaments."
          />
        </div>
        <section className="order-1 w-full min-w-0 rounded-lg border border-line bg-surface p-5 shadow-panel sm:p-6 lg:order-2">
          <Badge tone="cyan">Player access</Badge>
          <h1 className="mt-3 text-2xl font-black text-ink sm:text-3xl">Create your account</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Your account keeps rooms, game handles, evidence, notifications, dispute history, and competitive identity tied to you.
          </p>
          {params?.error ? (
            <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
              Could not create that account. Try another email or a stronger password.
            </p>
          ) : null}

          <div className="mt-6">
            <GoogleAuthButton label="Sign up with Google" redirectTo={redirectTo} referralCode={referralCode || undefined} />
          </div>
          <div className="my-5 flex items-center gap-3 text-xs font-black uppercase tracking-[0.18em] text-muted">
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>

          <form action="/api/auth/register" className="grid gap-4" method="post">
            <input name="redirect" type="hidden" value={redirectTo} />
            {referralCode ? <input name="referral_code" type="hidden" value={referralCode} /> : null}
            {referralCode ? (
              <div className="rounded-md border border-cyan bg-cyanSoft p-3 text-sm font-bold text-ink">
                Referral code applied: <span className="font-mono">{referralCode}</span>
              </div>
            ) : null}
            <label className="grid gap-2 text-sm font-bold text-ink">
              Username
              <input
                autoCapitalize="none"
                autoCorrect="off"
                className={authFieldClassName}
                enterKeyHint="next"
                maxLength={24}
                minLength={3}
                name="username"
                pattern="[A-Za-z0-9_]+"
                placeholder="ChizzyCOD"
                spellCheck={false}
                type="text"
                autoComplete="username"
                required
              />
              <span className="text-xs font-semibold text-muted">Letters, numbers, and underscores only.</span>
            </label>
            <label className="grid gap-2 text-sm font-bold text-ink">
              Email
              <input
                autoCapitalize="none"
                autoCorrect="off"
                className={authFieldClassName}
                enterKeyHint="next"
                name="email"
                spellCheck={false}
                type="email"
                autoComplete="email"
                required
              />
            </label>
            <PasswordField autoComplete="new-password" enterKeyHint="next" helperText="Use at least 10 characters." label="Password" minLength={10} name="password" />
            <PasswordField autoComplete="new-password" enterKeyHint="done" label="Confirm password" minLength={10} name="password_confirm" />
            <SubmitButton fullWidth idleLabel="Create account" pendingLabel="Creating account..." />
          </form>
          <div className="mt-5 grid gap-3 text-sm font-semibold text-muted">
            <p>
              Want to inspect the platform first?{" "}
              <Link className="text-ink underline decoration-action decoration-2 underline-offset-4" href="/community">
                Browse the public community pages
              </Link>
              .
            </p>
            <p>
              Already have an account?{" "}
              <Link className="text-ink underline decoration-action decoration-2 underline-offset-4" href={`/sign-in?redirect=${encodeURIComponent(redirectTo)}`}>
                Sign in
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
