"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (input: { client_id: string; callback: (response: { credential?: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: Record<string, string | number | boolean>) => void;
        };
      };
    };
  }
}

type GoogleAuthButtonProps = {
  redirectTo: string;
  label: string;
  action?: string;
  referralCode?: string;
};

export function GoogleAuthButton({ redirectTo, label, action = "/api/auth/identity/continue", referralCode }: GoogleAuthButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const initializedRef = useRef(false);
  const lastWidthRef = useRef(0);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !containerRef.current) return;

    let mounted = true;
    let rafId = 0;

    const submitCredential = async (credential: string) => {
      const formData = new FormData();
      formData.set("redirect", redirectTo);
      formData.set("id_token", credential);
      if (referralCode) {
        formData.set("referral_code", referralCode);
      }

      setSubmitting(true);
      try {
        const response = await fetch(action, {
          method: "POST",
          headers: {
            accept: "application/json",
            "x-skillrooms-client": "google-button"
          },
          body: formData,
          credentials: "same-origin"
        });
        const payload = (await response.json()) as { redirect_to?: string };
        if (!payload.redirect_to) {
          throw new Error("Missing redirect target");
        }
        window.location.assign(payload.redirect_to);
      } catch {
        if (!mounted) return;
        setSubmitting(false);
        setFailed(true);
      }
    };

    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id || !containerRef.current) {
        setFailed(true);
        return;
      }

      if (!initializedRef.current) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (!response.credential) {
              setFailed(true);
              return;
            }
            void submitCredential(response.credential);
          }
        });
        initializedRef.current = true;
      }

      const width = Math.max(220, Math.floor(containerRef.current.getBoundingClientRect().width || 0));
      if (Math.abs(width - lastWidthRef.current) < 8 && containerRef.current.childElementCount > 0) {
        return;
      }
      lastWidthRef.current = width;
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: "outline",
        size: width < 280 ? "medium" : "large",
        type: "standard",
        text: "continue_with",
        shape: "rectangular",
        logo_alignment: "left",
        width: Math.min(width, 420)
      });
      setReady(true);
      setFailed(false);
    };

    const initialize = () => {
      if (!containerRef.current) return;
      containerRef.current.innerHTML = "";
      renderGoogleButton();

      const onResize = () => {
        cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(() => {
          if (!containerRef.current || submitting) return;
          containerRef.current.innerHTML = "";
          renderGoogleButton();
        });
      };

      window.addEventListener("resize", onResize);
      return () => {
        cancelAnimationFrame(rafId);
        window.removeEventListener("resize", onResize);
      };
    };

    if (window.google?.accounts?.id) {
      return initialize();
    }

    const existingScript = document.querySelector<HTMLScriptElement>("script[data-google-identity]");
    if (existingScript) {
      existingScript.addEventListener("load", initialize, { once: true });
      return () => {
        existingScript.removeEventListener("load", initialize);
        mounted = false;
        cancelAnimationFrame(rafId);
      };
    }

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = "true";
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = initialize;
    script.onerror = () => setFailed(true);
    document.head.appendChild(script);
    return () => {
      mounted = false;
      cancelAnimationFrame(rafId);
    };
  }, [action, clientId, redirectTo, referralCode, submitting]);

  if (!clientId) {
    return (
      <button className="min-h-11 w-full rounded-md border border-line bg-white px-4 text-sm font-black text-muted" disabled type="button">
        Google sign-in unavailable
      </button>
    );
  }

  return (
    <div className="grid min-w-0 gap-3">
      <div aria-label={label} className="min-h-11 w-full overflow-hidden rounded-md border border-line bg-white p-1" ref={containerRef} />
      {submitting ? <p className="text-xs font-semibold text-muted">Continuing with Google...</p> : null}
      {!ready && !failed && !submitting ? <p className="text-xs font-semibold text-muted">Loading Google sign-in...</p> : null}
      {failed ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
          <p>Google sign-in did not load. Use email and password for now.</p>
          <p className="mt-1 font-semibold text-red-600">If you expected it to work, confirm this exact origin is allowed in Google Authorized JavaScript origins.</p>
        </div>
      ) : null}
    </div>
  );
}
