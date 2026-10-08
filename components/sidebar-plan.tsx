"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";

type PlanInfo = {
  isPro: boolean;
  endsOn?: string | null;
};

// Shows the caller's current subscription (Free / Pro + expiry) in the
// sidebar's settings area. Display-only — authorization never relies on this.
export function SidebarPlan() {
  const { data: session } = authClient.useSession();
  const [plan, setPlan] = useState<PlanInfo | null>(null);

  useEffect(() => {
    if (!session?.user.id) return;
    let active = true;

    const fetchPlan = async () => {
      try {
        const res = await fetch("/api/getSubs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: session.user.id }),
          cache: "no-cache",
        });
        if (!res.ok) return;
        const data = await res.json();
        if (active) {
          setPlan({ isPro: !!data.isPro, endsOn: data.endsOn ?? null });
        }
      } catch (err) {
        console.error("Failed to fetch subscription status", err);
      }
    };

    fetchPlan();
    return () => {
      active = false;
    };
  }, [session?.user.id]);

  if (!plan) return null;

  const pro = plan.isPro;
  const expiryText = plan.endsOn
    ? `Expires ${new Date(plan.endsOn).toLocaleDateString()}`
    : null;

  return (
    <SidebarMenu>
      <SidebarMenuItem className="py-1">
        <SidebarMenuButton
          asChild
          className="h-auto min-h-8 justify-start px-4 py-3"
        >
          <Link href={pro ? "/dashboard/setting" : "/#pricing"}>
            <Sparkles className="size-4" />
            <span className="flex flex-col items-start leading-tight">
              <span className="flex items-center gap-2">
                <span className="text-sm font-medium">
                  {pro ? "Pro plan" : "Free plan"}
                </span>
                <Badge variant={pro ? "default" : "secondary"}>
                  {pro ? "Active" : "Free"}
                </Badge>
              </span>
              <span className="text-xs text-muted-foreground">
                {pro ? expiryText : "Upgrade for more"}
              </span>
            </span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}