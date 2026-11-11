"use client";

import { ThemeToggle } from "@/components/ThemeToggle";
import React, { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { useFavoritesOnTop } from "@/context/notesPrefsStore";
import {
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  LogOut,
  Palette,
  Star,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

const VisibilityToggle = ({
  show,
  onToggle,
}: {
  show: boolean;
  onToggle: () => void;
}) => (
  <button
    type="button"
    onClick={onToggle}
    aria-label={show ? "Hide password" : "Show password"}
    className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
  >
    {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
  </button>
);

const Page = () => {
  const { data: session } = authClient.useSession();
  const router = useRouter();

  // Notes preferences
  const [favoritesOnTop, setFavoritesOnTop] = useFavoritesOnTop();

  // Change password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passLoading, setPassLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters long");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    setPassLoading(true);
    try {
      const { error } = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: true,
      });

      if (error) {
        const code = error.code as string | undefined;
        if (code === "USER_PASSWORD_NOT_FOUND") {
          toast.error(
            "No password is set for this account (social sign-in). Use “Forgot password” at sign in to create one."
          );
        } else if (code === "INVALID_PASSWORD") {
          toast.error("Current password is incorrect");
        } else if (code === "PASSWORD_TOO_SHORT") {
          toast.error("New password is too short — use at least 8 characters");
        } else {
          toast.error(error.message || "Failed to change password");
        }
        return;
      }

      toast.success("Password updated successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to change password"
      );
    } finally {
      setPassLoading(false);
    }
  };

  const handleLogout = async () => {
    await authClient.signOut();
    router.push("/");
  };

  return (
    <div className="w-full flex flex-col gap-6 mt-4 pb-10">
      {/* ── Header (same style as the other pages) ─────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage your account settings and preferences
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        {/* ── Appearance ───────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Palette className="size-5 text-muted-foreground" />
              <CardTitle>Appearance</CardTitle>
            </div>
            <CardDescription>Customize how the app looks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="theme">Theme</Label>
                <p className="text-sm text-muted-foreground">
                  Choose between light and dark mode
                </p>
              </div>
              <ThemeToggle />
            </div>
          </CardContent>
        </Card>

        {/* ── Notes ────────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Star className="size-5 text-muted-foreground" />
              <CardTitle>Notes</CardTitle>
            </div>
            <CardDescription>Control how your notes are listed</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="favorites-on-top">
                  Show favorites first
                </Label>
                <p className="text-sm text-muted-foreground">
                  Display favorite notes at the top of your notes and shared
                  notes grids
                </p>
              </div>
              <Switch
                id="favorites-on-top"
                checked={favoritesOnTop}
                onCheckedChange={setFavoritesOnTop}
              />
            </div>
          </CardContent>
        </Card>

        {/* ── Account ──────────────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <User className="size-5 text-muted-foreground" />
              <CardTitle>Account</CardTitle>
            </div>
            <CardDescription>View your account details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Email</Label>
                <p className="text-sm text-muted-foreground">
                  {session?.user?.email || "Not available"}
                </p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link href="/dashboard/profile">Edit Profile</Link>
              </Button>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Account Created</Label>
                <p className="text-sm text-muted-foreground">
                  {session?.user?.createdAt
                    ? new Date(session.user.createdAt).toLocaleDateString()
                    : "Not available"}
                </p>
              </div>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Session</Label>
                <p className="text-sm text-muted-foreground">
                  Sign out of this device
                </p>
              </div>
              <Button variant="destructive" onClick={handleLogout}>
                <LogOut className="size-4" />
                Logout
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ── Security · Change Password ──────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <KeyRound className="size-5 text-muted-foreground" />
              <CardTitle>Security</CardTitle>
            </div>
            <CardDescription>
              Keep your account secure by updating your password regularly
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="current-password">Current Password</Label>
                <div className="relative">
                  <Input
                    id="current-password"
                    type={showCurrent ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter your current password"
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <VisibilityToggle
                    show={showCurrent}
                    onToggle={() => setShowCurrent((v) => !v)}
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNew ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <VisibilityToggle
                      show={showNew}
                      onToggle={() => setShowNew((v) => !v)}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="confirm-password">
                    Confirm New Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirm-password"
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <VisibilityToggle
                      show={showConfirm}
                      onToggle={() => setShowConfirm((v) => !v)}
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  onClick={handleChangePassword}
                  disabled={passLoading}
                >
                  {passLoading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Updating…
                    </>
                  ) : (
                    "Change Password"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Page;