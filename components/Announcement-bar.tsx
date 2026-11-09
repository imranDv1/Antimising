"use client";

import * as React from "react";
import { ArrowRight, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AnnouncementBarProps = {
  /** Country / audience name shown at the start of the message */
  country?: string;
  /** Offer text after the dash */
  message?: string;
  /** Button label */
  ctaLabel?: string;
  /** Button link */
  href?: string;
  /** Offer duration in hours (timer starts on first visit and is persisted) */
  durationHours?: number;
  /** localStorage key prefix */
  storageKey?: string;
  className?: string;
};

function useCountdown(durationHours: number, storageKey: string) {
  const [remaining, setRemaining] = React.useState<number | null>(null);

  React.useEffect(() => {
    const key = `${storageKey}:endsAt`;
    let endsAt = 0;

    try {
      const saved = localStorage.getItem(key);
      endsAt = saved ? Number(saved) : 0;
    } catch {}

    if (!endsAt || endsAt < Date.now()) {
      endsAt = Date.now() + durationHours * 60 * 60 * 1000;
      try {
        localStorage.setItem(key, String(endsAt));
      } catch {}
    }

    const tick = () => setRemaining(Math.max(0, endsAt - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [durationHours, storageKey]);

  if (remaining === null) return null;

  const total = Math.floor(remaining / 1000);
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
    expired: remaining === 0,
  };
}

function TimeBox({ value, label }: { value: number | null; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="flex h-8 min-w-9 items-center justify-center rounded-md border border-white/25 bg-white/20 px-1.5 text-sm font-semibold tabular-nums text-white shadow-sm backdrop-blur-sm">
        {value === null ? "--" : String(value).padStart(2, "0")}
      </span>
      <span className="text-[9px] font-medium uppercase tracking-wider text-white/60">
        {label}
      </span>
    </div>
  );
}

export function AnnouncementBar({
  country = "Somalia",
  message = "10% off Pro, auto-applied at checkout. Ends in",
  ctaLabel = "Claim 10%",
  href = "/pricing",
  durationHours = 15,
  storageKey = "announcement-bar",
  className,
}: AnnouncementBarProps) {
  const [dismissed, setDismissed] = React.useState(false);
  const time = useCountdown(durationHours, storageKey);

  React.useEffect(() => {
    try {
      if (localStorage.getItem(`${storageKey}:dismissed`) === "1") {
        setDismissed(true);
      }
    } catch {}
  }, [storageKey]);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(`${storageKey}:dismissed`, "1");
    } catch {}
  };

  if (dismissed || time?.expired) return null;

  return (
    <div
      role="region"
      aria-label="Announcement"
      className={cn(
        "relative w-full overflow-hidden bg-gradient-to-r from-primary via-emerald-400 to-emerald-900 text-white",
        className
      )}
    >
      {/* dotted texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(rgba(255,255,255,0.5)_1px,transparent_1px)] [background-size:6px_6px]"
      />

      <div className="relative mx-auto flex min-h-16 max-w-7xl flex-col items-center justify-center gap-3 px-12 py-2 sm:flex-row sm:gap-5">
        <p className="text-center text-sm">
          <span className="font-semibold">{country} has a special offer</span>
          <span className="text-white/80"> — {message}</span>
        </p>

        <div className="flex items-center gap-4">
          {/* Countdown */}
          <div className="flex items-start gap-1.5" aria-live="off">
            <TimeBox value={time ? time.hours : null} label="Hrs" />
            <span className="mt-1.5 text-sm text-white/70">:</span>
            <TimeBox value={time ? time.minutes : null} label="Min" />
            <span className="mt-1.5 text-sm text-white/70">:</span>
            <TimeBox value={time ? time.seconds : null} label="Sec" />
          </div>

          <Button
            asChild
            size="sm"
            className="h-9 rounded-lg bg-white px-4 text-blue-600 shadow-sm hover:bg-white/90"
          >
            <a href={href}>
              {ctaLabel}
              <ArrowRight className="size-4" />
            </a>
          </Button>
        </div>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={handleDismiss}
        aria-label="Dismiss announcement"
        className="absolute right-2 top-1/2 size-8 -translate-y-1/2 text-white/80 hover:bg-white/15 hover:text-white"
      >
        <X className="size-4" />
      </Button>
    </div>
  );
}