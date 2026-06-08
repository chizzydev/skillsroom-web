import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, PanelHeader } from "@/components/ui/Panel";
import { apiBaseUrl } from "@/lib/api";
import { getCurrentUser } from "@/lib/auth-bridge";
import { PasswordField } from "@/components/auth/PasswordField";

type OwnerSetupPageProps = {
  searchParams?: Promise<{ error?: string }>;
};

async function setupStatus() {
  const response = await fetch(`${apiBaseUrl()}/auth/owner-setup`, {
    headers: { accept: "application/json" },
    cache: "no-store"
  });
  if (!response.ok) return { setup_available: false, owner_exists: true };
  const payload = await response.json() as {
    data?: { setup_available?: boolean; owner_exists?: boolean };
  };
  return {
    setup_available: Boolean(payload.data?.setup_available),
    owner_exists: Boolean(payload.data?.owner_exists)
  };
}

export default async function OwnerSetupPage({ searchParams }: OwnerSetupPageProps) {
  const params = await searchParams;
  const existingUser = await getCurrentUser();
  if (existingUser?.role === "owner") redirect("/admin");

  const status = await setupStatus();

  return (
    <main className="grid min-h-screen place-items-center bg-bg px-4 py-10">
      <section className="w-full max-w-xl">
        <Panel>
          <PanelHeader
            eyebrow="Owner Setup"
            title={status.setup_available ? "Create the platform owner" : "Owner already configured"}
            description={
              status.setup_available
                ? "This one-time setup creates the highest admin account with full platform ownership."
                : "The first-owner setup is closed because a platform owner already exists."
            }
            action={<Badge tone={status.setup_available ? "success" : "neutral"}>{status.setup_available ? "Available" : "Locked"}</Badge>}
          />
          <div className="p-4">
            {params?.error ? (
              <p className="mb-4 rounded-md border border-danger bg-dangerSoft p-3 text-sm font-bold text-danger">
                Owner setup failed. Confirm the API is running and no owner has already been created.
              </p>
            ) : null}

            {status.setup_available ? (
              <form action="/api/auth/owner-setup" className="grid gap-4" method="post">
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Owner name
                  <input
                    autoComplete="name"
                    className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                    name="display_name"
                    placeholder="Your name"
                    required
                  />
                </label>
                <label className="grid gap-2 text-sm font-bold text-ink">
                  Owner email
                  <input
                    autoComplete="email"
                    className="min-h-11 rounded-md border border-line bg-white px-3 text-sm outline-none focus:border-action"
                    name="email"
                    type="email"
                    required
                  />
                </label>
                <PasswordField autoComplete="new-password" helperText="Use at least 12 characters." label="Password" minLength={12} name="password" />
                <PasswordField autoComplete="new-password" label="Confirm password" minLength={12} name="password_confirm" />
                <Button type="submit">Create owner account</Button>
              </form>
            ) : (
              <div className="rounded-md border border-line bg-surfaceWarm p-4">
                <p className="text-sm leading-6 text-muted">
                  Sign in with the existing owner account. Team members and other admins should be invited from inside operations.
                </p>
                <Link className="mt-4 inline-flex min-h-11 items-center rounded-md bg-action px-4 text-sm font-black text-navy-950 shadow-action" href="/sign-in?redirect=/admin">
                  Go to sign in
                </Link>
              </div>
            )}
          </div>
        </Panel>
      </section>
    </main>
  );
}
