"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { invalidatePlanCache } from "@/context/planCacheStore";

type Status = "processing" | "pending" | "success" | "signin" | "error";

// 603 = Sifalo is still waiting for the customer to approve on their phone.
// Verify is polled until it answers 601, so a wallet payment that clears a
// minute later still activates Pro without another webhook.
const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_MS = 2 * 60_000;

function SuccessPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("processing");
  const [message, setMessage] = useState("");
  const [attempt, setAttempt] = useState(0);

  const sid = searchParams.get("sid") ?? undefined;
  const orderId = searchParams.get("order_id") ?? undefined;

  useEffect(() => {
    // order_id is a documented fallback when the return URL carries no sid.
    if (!sid && !orderId) {
      setStatus("error");
      setMessage("No payment reference was provided.");
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const startedAt = Date.now();

    const checkPayment = async () => {
      if (cancelled) return;

      try {
        const res = await fetch("/api/subscribe/success", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sid, order_id: orderId }),
        });

        if (cancelled) return;

        if (res.status === 401) {
          setStatus("signin");
          return;
        }

        const data = await res.json().catch(() => null);
        if (cancelled) return;

        if (data?.success) {
          // The user may have been on the Free plan cache while paying;
          // drop it so the sidebar card reflects Pro immediately.
          invalidatePlanCache();
          setStatus("success");
          return;
        }

        if (res.status === 202 || data?.pending) {
          setStatus("pending");
          setMessage(data?.message || "");
          if (Date.now() - startedAt < MAX_POLL_MS) {
            timer = setTimeout(checkPayment, POLL_INTERVAL_MS);
          }
          return;
        }

        setStatus("error");
        setMessage(data?.message || "Failed to save your subscription.");
      } catch (err) {
        if (cancelled) return;
        console.error("Subscription error:", err);
        setStatus("error");
        setMessage("Network error, please try again.");
      }
    };

    checkPayment();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sid, orderId, attempt]);

  return (
    <div className="flex min-h-screen items-center justify-center text-center">
      {status === "processing" ? (
        <p className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          Processing your subscription...
        </p>
      ) : (
        <Dialog open onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md" showCloseButton={false}>
            {status === "pending" && (
              <>
                <DialogHeader>
                  <DialogTitle>Payment pending</DialogTitle>
                  <DialogDescription>
                    Sifalo has received the request but the payment is not
                    confirmed yet. If you paid with eDahab, Waafi or Premier
                    Wallet, approve the request on your phone. This page checks
                    again automatically.
                  </DialogDescription>
                </DialogHeader>
                {message ? (
                  <p className="text-sm text-muted-foreground">{message}</p>
                ) : null}
                <DialogFooter className="sm:justify-between">
                  <Button
                    variant="outline"
                    onClick={() => router.push("/dashboard")}
                  >
                    Go to dashboard
                  </Button>
                  <Button
                    onClick={() => {
                      setMessage("");
                      setStatus("processing");
                      setAttempt((value) => value + 1);
                    }}
                  >
                    Check again
                  </Button>
                </DialogFooter>
              </>
            )}

            {status === "success" && (
              <>
                <DialogHeader>
                  <DialogTitle>Subscription active</DialogTitle>
                  <DialogDescription>
                    Your Pro plan is now active. Enjoy unlimited notes,
                    passwords, canvas boards and more.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button onClick={() => router.push("/dashboard")}>
                    Go to dashboard
                  </Button>
                </DialogFooter>
              </>
            )}

            {status === "signin" && (
              <>
                <DialogHeader>
                  <DialogTitle>Please sign in</DialogTitle>
                  <DialogDescription>
                    Sign in again to finish activating your subscription. Your
                    payment is safe and will be applied once you are signed in.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    onClick={() =>
                      router.push(
                        `/login?callbackUrl=${encodeURIComponent(
                          window.location.pathname + window.location.search
                        )}`
                      )
                    }
                  >
                    Sign in
                  </Button>
                </DialogFooter>
              </>
            )}

            {status === "error" && (
              <>
                <DialogHeader>
                  <DialogTitle>Subscription not activated</DialogTitle>
                  <DialogDescription>{message}</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button variant="outline" onClick={() => router.push("/")}>
                    Go home
                  </Button>
                  <Button onClick={() => window.location.reload()}>
                    Try again
                  </Button>
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function SuccessPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SuccessPageContent />
    </Suspense>
  );
}
