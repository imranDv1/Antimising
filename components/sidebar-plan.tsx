"use client";

import { useEffect } from "react";
import { Sparkles } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { authClient } from "@/lib/auth-client";
import { loadPlan, usePlanCacheStore } from "@/context/planCacheStore";

// Shows the caller's current subscription (Free / Pro + expiry) in the
// sidebar's settings area. Display-only — authorization never relies on this.
export function SidebarPlan() {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;

  // Read straight from the shared cache so reopening the sidebar paints the
  // card immediately instead of showing a loading gap and refetching.
  const plan = usePlanCacheStore((state) =>
    userId && state.userId === userId ? state.plan : null
  );

  useEffect(() => {
    if (!userId) return;
    // Cache-aware: resolves instantly while fresh, fetches once when stale.
    loadPlan(userId);
  }, [userId]);

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
                <Badge className="border-0" variant={pro ? "default" : "secondary"}>
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
