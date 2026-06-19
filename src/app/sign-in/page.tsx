import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth-bridge";
import { Badge } from "@/components/ui/Badge";
import { apiBaseUrl } from "@/lib/api";
import { GoogleAuthButton } from "@/components/auth/GoogleAuthButton";
import { AuthTrustPanel } from "@/components/auth/AuthTrustPanel";
import { PasswordField } from "@/components/auth/PasswordField";
import { authFieldClassName } from "@/components/auth/field-styles";
import { PendingLink } from "@/components/ui/PendingLink";
import { SubmitButton } from "@/components/ui/SubmitButton";

const premiumArtwork = {
  hero: "/marketing/skillsroom-premium/hero-premium.png",
  community: "/marketing/skillsroom-premium/community-premium.png"
} as const;

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
    <main className="min-h-screen overflow-x-hidden bg-[#07111c] px-4 py-6 sm:py-10">
      <div className="mx-auto grid max-w-6xl gap-4 sm:gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(22rem,28rem)] lg:items-center">
        <div className="order-2 lg:order-1">
          <AuthTrustPanel
            artworkAlt="Competitive gaming community artwork"
            artworkSrc={premiumArtwork.community}
            ctaHref="/community"
            ctaLabel="Review public community pages"
            eyebrow="Account access"
            summary="Structured rooms, tournament operations, evidence review, dispute handling, and controlled settlement workflows for competitive players."
            title="Competitive gaming with visible rules and review."
          />
        </div>
        <section className="order-1 w-full min-w-0 rounded-[1.5rem] border border-white/10 bg-white/95 p-5 shadow-[0_30px_80px_rgba(3,10,20,0.3)] backdrop-blur sm:p-6 lg:order-2">
          <Badge tone="cyan">Account access</Badge>
          <h1 className="mt-3 text-2xl font-black text-ink sm:text-3xl">Welcome back</h1>
          <p className="mt-2 text-sm leading-6 text-muted">
            Sign in with your Skillsroom account to manage rooms, tournament entries, funding reviews, evidence, and disputes.
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
                autoCapitalize="none"
                autoCorrect="off"
                className={authFieldClassName}
                enterKeyHint="next"
                name="identifier"
                spellCheck={false}
                type="text"
                autoComplete="username"
                required
              />
            </label>
            <PasswordField autoComplete="current-password" enterKeyHint="go" label="Password" name="password" />
            <SubmitButton fullWidth idleLabel="Sign in" pendingLabel="Signing in..." />
          </form>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-line bg-surfaceWarm p-4">
              <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">Fast re-entry</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Get back into rooms, unread DMs, tournament check-ins, and evidence threads without losing your place.
              </p>
            </div>
            <div className="rounded-2xl border border-line bg-surfaceWarm p-4">
              <p className="font-mono text-[0.68rem] font-black uppercase tracking-[0.14em] text-cyan">One player record</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Match history, disputes, platform moderation, and community identity remain tied to one account.
              </p>
            </div>
          </div>
          <div className="mt-5 grid gap-3 text-sm font-semibold text-muted">
            <p>
              Need a closer look first?{" "}
              <PendingLink className="text-ink underline decoration-action decoration-2 underline-offset-4" href="/policies" pendingLabel="Opening policies...">
                Read the public rules and policies
              </PendingLink>
              .
            </p>
            <p>
              {setupAvailable ? (
                <>
                  Setting up the platform?{" "}
                  <PendingLink className="text-ink underline decoration-action decoration-2 underline-offset-4" href="/owner-setup" pendingLabel="Opening owner setup...">
                    Create owner account
                  </PendingLink>
                </>
              ) : (
                <>
                  New to Skillsroom?{" "}
                  <PendingLink className="text-ink underline decoration-action decoration-2 underline-offset-4" href={`/register?redirect=${encodeURIComponent(redirectTo)}${referralCode ? `&ref=${encodeURIComponent(referralCode)}` : ""}`} pendingLabel="Opening registration...">
                    Create an account
                  </PendingLink>
                </>
              )}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
