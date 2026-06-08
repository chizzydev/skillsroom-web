import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-bridge";
import { Badge } from "@/components/ui/Badge";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { PasswordField } from "@/components/auth/PasswordField";

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
    <main className="grid min-h-screen place-items-center bg-bg px-4 py-10">
      <section className="w-full max-w-md min-w-0 rounded-lg border border-line bg-surface p-5 shadow-panel sm:p-6">
        <Badge tone="cyan">Player access</Badge>
        <h1 className="mt-3 text-2xl font-black text-ink sm:text-3xl">Create your account</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Your account keeps rooms, COD Mobile handles, evidence, notifications, and funding history tied to you.
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
              className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
              maxLength={24}
              minLength={3}
              name="username"
              pattern="[A-Za-z0-9_]+"
              placeholder="ChizzyCOD"
              type="text"
              autoComplete="username"
              required
            />
            <span className="text-xs font-semibold text-muted">Letters, numbers, and underscores only.</span>
          </label>
          <label className="grid gap-2 text-sm font-bold text-ink">
            Email
            <input
              className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>
          <PasswordField autoComplete="new-password" helperText="Use at least 10 characters." label="Password" minLength={10} name="password" />
          <PasswordField autoComplete="new-password" label="Confirm password" minLength={10} name="password_confirm" />
          <button className="min-h-11 rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" type="submit">
            Create account
          </button>
        </form>
        <p className="mt-5 text-sm font-semibold text-muted">
          Already have an account?{" "}
          <Link className="text-ink underline decoration-action decoration-2 underline-offset-4" href={`/sign-in?redirect=${encodeURIComponent(redirectTo)}`}>
            Sign in
          </Link>
        </p>
      </section>
    </main>
  );
}
