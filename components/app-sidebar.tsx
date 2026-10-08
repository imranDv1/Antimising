"use client";

import {
  IconCamera,
  IconDatabase,
  IconFileAi,
  IconFileDescription,
  IconFileWord,
  IconReport,
  IconSettings
} from "@tabler/icons-react";
import * as React from "react";

import { NavDocuments } from "@/components/nav-documents";
import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useNotificationStore } from "@/context/profileUpdateNotification";
import { useSharedStore } from "@/context/sharedStore";
import { authClient } from "@/lib/auth-client";
import {
  Boxes,
  FolderLock,
  NotepadTextDashed,
  Users
} from "lucide-react";
import Link from "next/link";
import { Logo } from "./logo";
import { Separator } from "./ui/separator";

const data = {
  navMain: [
    // {
    //   title: "Dashboard",
    //   url: "/dashboard",
    //   icon: LayoutDashboard,
    // },
    {
      title: "All Notes",
      url: "/dashboard/create",
      icon: NotepadTextDashed,
    },

    {
      title: "Password Manager",
      url: "/dashboard/passwords",
      icon: FolderLock,
      // badge: "new",
    },

  ],
  navClouds: [
    {
      title: "Capture",
      icon: IconCamera,
      isActive: true,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Proposal",
      icon: IconFileDescription,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
    {
      title: "Prompts",
      icon: IconFileAi,
      url: "#",
      items: [
        {
          title: "Active Proposals",
          url: "#",
        },
        {
          title: "Archived",
          url: "#",
        },
      ],
    },
  ],
  navSecondary: [
    {
      title: "Settings",
      url: "/dashboard/setting",
      icon: IconSettings,
    },

 
  ],
  documents: [
    {
      name: "Data Library",
      url: "#",
      icon: IconDatabase,
    },
    {
      name: "Reports",
      url: "#",
      icon: IconReport,
    },
    {
      name: "Word Assistant",
      url: "#",
      icon: IconFileWord,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const refreshSignal = useNotificationStore((state) => state.refreshSignal);
  const refreshSharedSignal = useSharedStore((state) => state.refreshSharedSignal);
  const { data: session } = authClient.useSession();
  const [unreadShared, setUnreadShared] = React.useState(0);
  const [userData, setUserData] = React.useState({
    name: session?.user.name || "",
    email: session?.user.email || "",
    avatar: session?.user.image || "/images/userefult.jpeg",
  });

  // عدد الملاحظات المشتركة غير المقروءة (badge في القائمة الجانبية)
  React.useEffect(() => {
    if (!session?.user.id) return;
    let active = true;

    const fetchUnread = async () => {
      try {
        const res = await fetch(
          `/api/shared-notes?userId=${session.user.id}&countOnly=true`,
          { cache: "no-cache" }
        );
        const data = await res.json();
        if (active) setUnreadShared(data.unreadCount ?? 0);
      } catch (err) {
        console.error("Failed to fetch unread shared notes", err);
      }
    };

    fetchUnread();
    const id = setInterval(fetchUnread, 30_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [session?.user.id, refreshSharedSignal]);

  React.useEffect(() => {
    const fetchUserData = async () => {
      if (!session?.user.id) return;

      try {
        const res = await fetch(`/api/user/profile?userId=${session.user.id}`, {
          cache: "no-cache",
        });
        const data = await res.json();
        if (data.success) {
          setUserData({
            name: data.user.name,
            email: data.user.email,
            avatar: data.user.image || "/Images/userefult.jpeg",
          });
        }
      } catch (err) {
        console.error("Failed to fetch user data", err);
      }
    };

    fetchUserData();
  }, [refreshSignal, session?.user.id]);

  const sharedBadge =
    unreadShared > 0 ? (unreadShared > 99 ? "99+" : String(unreadShared)) : undefined;

  const navMain = [
    ...data.navMain,
    {
      title: "Shared Notes",
      url: "/dashboard/shared",
      icon: Boxes,
      badge: "new",
    },
  ];

  return (
    <Sidebar collapsible="offcanvas" {...props} className="bg-black">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              className="data-[slot=sidebar-menu-button]:!p-1.5"
            >
              <Link href="/" className="flex item-center justify-start">
                <Logo />
                <span className="text-2xl font-semibold font-sans ">Anti<span className="text-primary">Mising</span></span>
              </Link>
            </SidebarMenuButton>
            <Separator className="mt-3"/>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} />
        <NavDocuments
          userId={session?.user.id as string}
          items={data.documents}
        />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={userData} />
      </SidebarFooter>
    </Sidebar>
  );
}
