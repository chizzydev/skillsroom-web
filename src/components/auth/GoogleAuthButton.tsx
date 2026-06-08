"use client";

import { useEffect, useId, useRef, useState } from "react";

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

export function GoogleAuthButton({ redirectTo, label, action = "/api/auth/google", referralCode }: GoogleAuthButtonProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);
  const initializedRef = useRef(false);
  const tokenRef = useRef<HTMLInputElement | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const scriptId = useId().replaceAll(":", "");
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

  useEffect(() => {
    if (!clientId || !containerRef.current) return;

    const renderGoogleButton = () => {
      if (!window.google?.accounts?.id || !containerRef.current) {
        setFailed(true);
        return;
      }

      if (!initializedRef.current) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => {
            if (!response.credential || !tokenRef.current || !formRef.current) {
              setFailed(true);
              return;
            }
            tokenRef.current.value = response.credential;
            formRef.current.requestSubmit();
          }
        });
        initializedRef.current = true;
      }

      const width = Math.max(220, Math.floor(containerRef.current.getBoundingClientRect().width || 0));
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
      resizeObserverRef.current?.disconnect();
      resizeObserverRef.current = new ResizeObserver(() => {
        if (!containerRef.current) return;
        containerRef.current.innerHTML = "";
        renderGoogleButton();
      });
      resizeObserverRef.current.observe(containerRef.current);
    };

    if (window.google?.accounts?.id) {
      initialize();
      return () => resizeObserverRef.current?.disconnect();
    }

    const existingScript = document.querySelector<HTMLScriptElement>("script[data-google-identity]");
    if (existingScript) {
      existingScript.addEventListener("load", initialize, { once: true });
      return () => {
        existingScript.removeEventListener("load", initialize);
        resizeObserverRef.current?.disconnect();
      };
    }

    const script = document.createElement("script");
    script.async = true;
    script.defer = true;
    script.dataset.googleIdentity = scriptId;
    script.src = "https://accounts.google.com/gsi/client";
    script.onload = initialize;
    script.onerror = () => setFailed(true);
    document.head.appendChild(script);
    return () => resizeObserverRef.current?.disconnect();
  }, [clientId, scriptId]);

  if (!clientId) {
    return (
      <button className="min-h-11 w-full rounded-md border border-line bg-white px-4 text-sm font-black text-muted" disabled type="button">
        Google sign-in unavailable
      </button>
    );
  }

  return (
    <div className="grid min-w-0 gap-3">
      <form action={action} method="post" ref={formRef}>
        <input name="redirect" type="hidden" value={redirectTo} />
        <input name="id_token" ref={tokenRef} type="hidden" />
        {referralCode ? <input name="referral_code" type="hidden" value={referralCode} /> : null}
      </form>
      <div aria-label={label} className="min-h-11 w-full overflow-hidden rounded-md border border-line bg-white p-1" ref={containerRef} />
      {!ready && !failed ? <p className="text-xs font-semibold text-muted">Loading Google sign-in...</p> : null}
      {failed ? (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
          <p>Google sign-in did not load. Use email and password for now.</p>
          <p className="mt-1 font-semibold text-red-600">If you expected it to work, confirm this exact origin is allowed in Google Authorized JavaScript origins.</p>
        </div>
      ) : null}
    </div>
  );
}
