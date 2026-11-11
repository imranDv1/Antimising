"use client";

import { useEffect, useRef } from "react";

type TurnstileTheme = "light" | "dark" | "auto";

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      theme?: TurnstileTheme;
      size?: "normal" | "compact" | "flexible";
      callback?: (token: string) => void;
      "expired-callback"?: () => void;
      "timeout-callback"?: () => void;
      "error-callback"?: (errorCode?: string) => void;
    }
  ) => string;
  remove: (widgetId: string) => void;
  reset: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript() {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    let script = document.querySelector<HTMLScriptElement>(
      'script[data-turnstile-script="true"]'
    );

    if (!script) {
      script = document.createElement("script");
      script.src = TURNSTILE_SCRIPT;
      script.async = true;
      script.defer = true;
      script.dataset.turnstileScript = "true";
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error("Failed to load Cloudflare Turnstile"));
      };
      document.head.appendChild(script);
    }

    // The script may already be loaded (client-side navigation), so poll for
    // the global instead of relying only on the script load event.
    let attempts = 0;
    const interval = window.setInterval(() => {
      if (window.turnstile) {
        window.clearInterval(interval);
        resolve();
      } else if (++attempts > 100) {
        window.clearInterval(interval);
        scriptPromise = null;
        reject(new Error("Cloudflare Turnstile did not load"));
      }
    }, 100);
  });

  return scriptPromise;
}

export interface TurnstileWidgetProps {
  siteKey: string;
  onVerify: (token: string) => void;
  onExpire?: () => void;
  onError?: (message?: string) => void;
  /** Change this value to force a fresh widget (tokens are single use). */
  resetSignal?: string | number;
  theme?: TurnstileTheme;
  className?: string;
}

export function TurnstileWidget({
  siteKey,
  onVerify,
  onExpire,
  onError,
  resetSignal = 0,
  theme = "auto",
  className,
}: TurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const callbacksRef = useRef({ onVerify, onExpire, onError });

  useEffect(() => {
    callbacksRef.current = { onVerify, onExpire, onError };
  }, [onVerify, onExpire, onError]);

  useEffect(() => {
    if (!siteKey) return;

    let cancelled = false;

    const removeWidget = () => {
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          // Widget was already removed.
        }
      }
      widgetIdRef.current = null;
    };

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile || !containerRef.current) return;

        removeWidget();
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          theme,
          callback: (token) => callbacksRef.current.onVerify(token),
          "expired-callback": () => callbacksRef.current.onExpire?.(),
          "timeout-callback": () => callbacksRef.current.onExpire?.(),
          "error-callback": (errorCode) =>
            callbacksRef.current.onError?.(errorCode),
        });
      })
      .catch((error: Error) => {
        if (!cancelled) callbacksRef.current.onError?.(error.message);
      });

    return () => {
      cancelled = true;
      removeWidget();
    };
  }, [siteKey, theme, resetSignal]);

  if (!siteKey) return null;

  return (
    <div
      ref={containerRef}
      className={className}
      data-turnstile-widget
    />
  );
}
