"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/tiptap-utils";

const FREE_FEATURES = [
  "Up to 10 notes",
  "Notes up to 10,000 characters",
  "Up to 3 images per note",
  "Up to 10 saved passwords",
  "Up to 3 canvas boards",
  "Rich text formatting (headings, checklists, highlights, images, and more)",
  "Organize notes with tags",
  "Search notes by title, content, and tag",
  "Access your notes from any device you sign in to",
  "Share notes with view or edit access",
  "Favorites pinned to the top of your notes",
  "Encrypted notes, boards, and passwords at rest",
  "Light and dark themes",
];

const PRO_FEATURES = [
  "Everything in Free plan",
  "Unlimited notes",
  "Notes up to 50,000 characters",
  "Up to 10 images per note",
  "Unlimited saved passwords",
  "Unlimited canvas boards",
];

export default function PricingClient({
  userId,
  hasSubscription,
}: {
  userId?: string;
  hasSubscription?: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleProSubscribe = async () => {
    if (hasSubscription) return;

    if (!userId || userId === "") {
      router.push("/login");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.message || "Subscription failed");
      }
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section id="pricing" className="py-16 md:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl space-y-6 text-center">
          <h1 className="text-center text-4xl font-semibold lg:text-5xl">
            Pricing that Scales with You
          </h1>
          <p>
            Our plans are simple. Start for free, or unlock even more
            possibilities with Pro. <br />
            Designed for note-takers, thinkers, and creators.
          </p>
        </div>

        <div className="mt-8 grid gap-6 md:mt-20 md:grid-cols-2">
          {/* Free Card */}
          <Card className="rounded-none  dark:bg-black">
            <CardHeader>
              <CardTitle className="font-medium">Free</CardTitle>
              <span className="my-3 block text-2xl font-semibold">$0 / mo</span>
              <CardDescription className="text-sm">
                For individuals
              </CardDescription>
              <Button asChild variant="outline" className="mt-4 w-full">
                <Link href="/dashboard">Get Started</Link>
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <hr className="border-dashed" />
              <ul className="list-outside space-y-3 text-sm">
                {FREE_FEATURES.map((item, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Check className="size-3 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Pro Card */}
          <Card
            className={cn("relative rounded-none dark:bg-black", hasSubscription ? "border-primary" : "")}
          >
            <span className="absolute inset-x-0 -top-3 mx-auto flex h-6 w-fit items-center  bg-gradient-to-br from-primary to-emerald-600 px-3 py-1 text-xs font-medium text-amber-950 ring-1 ring-inset ring-white/20 ring-offset-1 ring-offset-gray-950/5">
              Popular
            </span>

            <CardHeader>
              <CardTitle className="font-medium">Pro</CardTitle>
              <span className="my-3 block text-2xl font-semibold">$9 / mo</span>
              <CardDescription className="text-sm">
                For power users
              </CardDescription>
              {hasSubscription ? (
                <Button
                  variant="outline"
                  className="mt-4 w-full cursor-not-allowed"
                  disabled
                >
                  Your plan
                </Button>
              ) : (
                <Button
                  onClick={handleProSubscribe}
                  className="mt-4 w-full"
                  disabled={loading}
                >
                  {loading ? "Processing..." : "Get Started"}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <hr className="border-dashed" />
              <ul className="list-outside space-y-3 text-sm">
                {PRO_FEATURES.map((item, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <Check className="size-3 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
}