"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Status = "processing" | "success" | "signin" | "error";

function SuccessPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<Status>("processing");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const sid = searchParams.get("sid");
    const orderId = searchParams.get("order_id");

    // order_id is deliberately ignored — the authenticated session determines
    // the account. Only the verified sid is sent to the server.
    void orderId;

    let cancelled = false;

    if (!sid) {
      setStatus("error");
      setMessage("No payment reference was provided.");
      return;
    }

    const saveSubscription = async () => {
      try {
        const res = await fetch("/api/subscribe/success", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sid }),
        });

        if (res.status === 401) {
          if (!cancelled) setStatus("signin");
          return;
        }

        const data = await res.json();
        if (cancelled) return;

        if (data.success) {
          setStatus("success");
        } else {
          setStatus("error");
          setMessage(data.message || "Failed to save your subscription.");
        }
      } catch (err) {
        console.error("Subscription error:", err);
        if (!cancelled) {
          setStatus("error");
          setMessage("Network error, please try again.");
        }
      }
    };

    saveSubscription();
    return () => {
      cancelled = true;
    };
  }, [searchParams, router]);

  return (
    <div className="flex min-h-screen items-center justify-center text-center">
      {status === "processing" ? (
        <p>Processing your subscription...</p>
      ) : (
        <Dialog open onOpenChange={() => {}}>
          <DialogContent className="sm:max-w-md" showCloseButton={false}>
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