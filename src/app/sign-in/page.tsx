import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-bridge";
import { Badge } from "@/components/ui/Badge";
import Link from "next/link";
import { apiBaseUrl } from "@/lib/api";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { PasswordField } from "@/components/auth/PasswordField";

type SignInPageProps = {
  searchParams?: Promise<{ redirect?: string; error?: string; ref?: string }>;
};

function signInErrorMessage(error?: string) {
  switch (error) {
    case "GOOGLE_AUTH_NOT_CONFIGURED":
      return "Google sign-in is not configured on the API yet. Check the Railway GOOGLE_CLIENT_ID value and redeploy.";
    case "GOOGLE_ACCOUNT_NOT_VERIFIED":
      return "That Google account could not be verified. Make sure the account email is verified in Google.";
    case "GOOGLE_ALREADY_LINKED":
      return "That Google account is already linked to another Skillsroom account.";
    case "CROSS_ORIGIN_MUTATION_BLOCKED":
      return "Google sign-in request was blocked by the API origin policy. Check WEB_APP_ORIGIN on Railway.";
    case "google_api_unreachable":
      return "Google sign-in could not reach the API. Check NEXT_PUBLIC_API_BASE_URL on Vercel and confirm Railway is online.";
    case "google_failed":
      return "Google sign-in failed. If your client ID is correct, check that this exact origin is allowed in Google Authorized JavaScript origins.";
    default:
      return "Sign in failed. Check your email, username, or password.";
  }
}

export default async function SignInPage({ searchParams }: SignInPageProps) {
  const params = await searchParams;
  const existingUser = await getCurrentUser();
  const redirectTo = params?.redirect || "/";
  const referralCode = params?.ref?.trim() || "";

  if (existingUser) {
    redirect(redirectTo);
  }

  let setupAvailable = false;
  try {
    const response = await fetch(`${apiBaseUrl()}/auth/owner-setup`, {
      headers: { accept: "application/json" },
      cache: "no-store"
    });
    const payload = await response.json() as { ok?: boolean; data?: { setup_available?: boolean } };
    setupAvailable = Boolean(payload.ok && payload.data?.setup_available);
  } catch {
    setupAvailable = false;
  }

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4 py-10">
      <section className="w-full max-w-md min-w-0 rounded-lg border border-line bg-surface p-5 shadow-panel sm:p-6">
        <Badge tone="cyan">Closed beta</Badge>
        <h1 className="mt-3 text-2xl font-black text-ink sm:text-3xl">Welcome back</h1>
        <p className="mt-2 text-sm leading-6 text-muted">
          Sign in with your Skillsroom account to manage rooms, funding reviews, evidence, and payouts.
        </p>
        {params?.error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
            {signInErrorMessage(params.error)}
          </p>
        ) : null}

        <div className="mt-6">
          <GoogleAuthButton label="Sign in with Google" redirectTo={redirectTo} referralCode={referralCode || undefined} />
        </div>
        <div className="my-5 flex items-center gap-3 text-xs font-black uppercase tracking-[0.18em] text-muted">
          <span className="h-px flex-1 bg-line" />
          or
          <span className="h-px flex-1 bg-line" />
        </div>

        <form action="/api/auth/login" className="grid gap-4" method="post">
          <input name="redirect" type="hidden" value={redirectTo} />
          <label className="grid gap-2 text-sm font-bold text-ink">
            Email or username
            <input
              className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
              name="identifier"
              type="text"
              autoComplete="username"
              required
            />
          </label>
          <PasswordField autoComplete="current-password" label="Password" name="password" />
          <button className="min-h-11 rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action hover:bg-actionHover" type="submit">
            Sign in
          </button>
        </form>
        <p className="mt-5 text-sm font-semibold text-muted">
          {setupAvailable ? (
            <>
              Setting up the platform?{" "}
              <Link className="text-ink underline decoration-action decoration-2 underline-offset-4" href="/owner-setup">
                Create owner account
              </Link>
            </>
          ) : (
            <>
              New to Skillsroom?{" "}
          <Link className="text-ink underline decoration-action decoration-2 underline-offset-4" href={`/register?redirect=${encodeURIComponent(redirectTo)}${referralCode ? `&ref=${encodeURIComponent(referralCode)}` : ""}`}>
            Create an account
          </Link>
            </>
          )}
        </p>
      </section>
    </main>
  );
}
