"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CountrySelector,
  getCountryLabel,
  getFlagEmoji,
} from "./_component/CountrySelector";
import { authClient } from "@/lib/auth-client";
import { useNotificationStore } from "@/context/profileUpdateNotification";
import { Camera, Info, Loader2, Mail, Pencil, UserRound } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const DEFAULT_IMAGE = "/images/userefult.jpeg";
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];

type Profile = {
  name: string;
  email: string;
  gender: string;
  country: string;
  image: string;
};

const EMPTY_PROFILE: Profile = {
  name: "",
  email: "",
  gender: "",
  country: "",
  image: DEFAULT_IMAGE,
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function FieldValue({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground">{children}</dd>
    </div>
  );
}

const ProfilePage = () => {
  const { data: session } = authClient.useSession();
  const userId = session?.user.id;
  const triggerRefresh = useNotificationStore((state) => state.triggerRefresh);

  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [draft, setDraft] = useState<Profile>(EMPTY_PROFILE);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load the full record (not the cached session) so a profile edited on
  // another device is not shown stale for up to the session lifetime.
  useEffect(() => {
    if (!userId) return;
    let active = true;

    (async () => {
      try {
        const res = await fetch(`/api/user/profile?userId=${userId}`, {
          cache: "no-cache",
        });
        const data = await res.json().catch(() => null);
        if (!active) return;

        if (data?.success && data.user) {
          const loaded: Profile = {
            name: data.user.name ?? "",
            email: data.user.email ?? "",
            gender: data.user.UserPlusInfo?.gender ?? "",
            country: data.user.UserPlusInfo?.country ?? "",
            image: data.user.image || DEFAULT_IMAGE,
          };
          setProfile(loaded);
          setDraft(loaded);
        }
      } catch {
        if (active) toast.error("Couldn't load your profile");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [userId]);

  // Blob previews must be released or they leak for the tab's lifetime.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const countryLabel = useMemo(
    () => (profile.country ? getCountryLabel(profile.country) : ""),
    [profile.country]
  );

  const isDirty =
    draft.name !== profile.name ||
    draft.gender !== profile.gender ||
    draft.country !== profile.country ||
    imageFile !== null;

  const startEditing = () => {
    setDraft(profile);
    setNameError(null);
    setImageFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setEditing(true);
  };

  const cancelEditing = () => {
    setDraft(profile);
    setNameError(null);
    setImageFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setEditing(false);
  };

  const handleImageChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
      toast.error("Choose a JPG, PNG or WebP image");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_BYTES) {
      toast.error("Image must be 5 MB or smaller");
      e.target.value = "";
      return;
    }

    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleSave = async () => {
    if (!userId || saving) return;

    const name = draft.name.trim();
    if (name.length < 2) {
      setNameError("Name must be at least 2 characters");
      return;
    }
    setNameError(null);

    const formData = new FormData();
    formData.append("userId", userId);
    formData.append("name", name);
    formData.append("gender", draft.gender);
    formData.append("country", draft.country);
    if (imageFile) formData.append("imageFile", imageFile);

    setSaving(true);
    try {
      const res = await fetch("/api/user/profile", {
        method: "POST",
        body: formData,
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.success) {
        throw new Error(
          data?.message || data?.error || "Couldn't save your profile"
        );
      }

      const saved: Profile = {
        ...draft,
        name,
        image: data.user?.image || profile.image,
      };
      setProfile(saved);
      setDraft(saved);
      setImageFile(null);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setEditing(false);
      triggerRefresh();
      toast.success("Profile updated");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Couldn't save your profile"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mt-4 flex w-full flex-col gap-6 pb-10">
        <div className="space-y-2">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-48" />
            <Skeleton className="mt-1 h-4 w-72" />
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center gap-4">
              <Skeleton className="size-20" />
              <div className="space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
              </div>
            </div>
            <Skeleton className="h-px w-full" />
            <div className="grid gap-5 sm:grid-cols-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const avatarSrc = preview ?? profile.image;
  const displayName = profile.name.trim() || "Your name";

  return (
    <div className="mt-4 flex w-full flex-col gap-6 pb-10">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          How you appear to people you share notes and boards with.
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <UserRound className="size-5 text-muted-foreground" />
            <CardTitle>Personal information</CardTitle>
          </div>
          <CardDescription>
            Your name and photo are shown on notes you share and in the sidebar.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* ── Avatar + identity ─────────────────────────────────────── */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="relative shrink-0">
                <Avatar className="size-20 border border-border bg-muted">
                  <AvatarImage
                    src={avatarSrc}
                    alt={displayName}
                    className="object-cover"
                  />
                  <AvatarFallback className="text-lg font-semibold text-muted-foreground">
                    {initials(displayName)}
                  </AvatarFallback>
                </Avatar>

                {editing && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    aria-label="Change profile photo"
                    className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center border border-border bg-background text-muted-foreground shadow-sm transition-colors hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <Camera className="size-3.5" />
                  </button>
                )}
              </div>

              <div className="min-w-0 space-y-1">
                <p className="truncate text-lg font-semibold leading-tight text-foreground">
                  {displayName}
                </p>
                <p className="truncate text-sm text-muted-foreground">
                  {profile.email || "—"}
                </p>
                <div className="flex flex-wrap items-center gap-1.5 pt-1">
                  {profile.gender ? (
                    <Badge variant="secondary" className="capitalize">
                      {profile.gender}
                    </Badge>
                  ) : null}
                  {profile.country ? (
                    <Badge variant="outline">
                      <span aria-hidden>{getFlagEmoji(profile.country)}</span>
                      {countryLabel || profile.country}
                    </Badge>
                  ) : null}
                  {!profile.gender && !profile.country && !editing ? (
                    <span className="text-xs text-muted-foreground">
                      Add your gender and country to complete your profile
                    </span>
                  ) : null}
                </div>
              </div>
            </div>

            {!editing && (
              <Button
                variant="outline"
                className="w-full shrink-0 sm:w-auto"
                onClick={startEditing}
              >
                <Pencil className="size-4" />
                Edit profile
              </Button>
            )}

            {editing && (
              <div className="flex shrink-0 flex-col items-stretch gap-1.5 sm:items-end">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Camera className="size-4" />
                  {imageFile ? "Choose another photo" : "Change photo"}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {imageFile
                    ? imageFile.name
                    : "JPG, PNG or WebP · up to 5 MB"}
                </span>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES.join(",")}
              onChange={handleImageChange}
              className="hidden"
            />
          </div>

          <Separator />

          {/* ── Fields ────────────────────────────────────────────────── */}
          {editing ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="profile-name">Full name</Label>
                <Input
                  id="profile-name"
                  value={draft.name}
                  onChange={(e) => {
                    setDraft((d) => ({ ...d, name: e.target.value }));
                    if (nameError) setNameError(null);
                  }}
                  maxLength={80}
                  autoComplete="name"
                  aria-invalid={Boolean(nameError)}
                  aria-describedby={nameError ? "profile-name-error" : undefined}
                  className={cn(nameError && "border-destructive")}
                />
                {nameError ? (
                  <p
                    id="profile-name-error"
                    className="text-xs text-destructive"
                  >
                    {nameError}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    This is the name people see when you share a note.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="profile-email">Email</Label>
                <Input
                  id="profile-email"
                  value={draft.email}
                  disabled
                  readOnly
                />
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Mail className="size-3" />
                  Email can&apos;t be changed here.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Gender</Label>
                <Select
                  value={draft.gender}
                  onValueChange={(value) =>
                    setDraft((d) => ({ ...d, gender: value }))
                  }
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Country</Label>
                <CountrySelector
                  edit={false}
                  value={draft.country}
                  onChange={(value) =>
                    setDraft((d) => ({ ...d, country: value }))
                  }
                />
              </div>
            </div>
          ) : (
            <dl className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <FieldValue label="Name">{profile.name || "Not set"}</FieldValue>
              <FieldValue label="Email">{profile.email || "—"}</FieldValue>
              <FieldValue label="Gender">
                <span className="capitalize">
                  {profile.gender || "Not set"}
                </span>
              </FieldValue>
              <FieldValue label="Country">
                {profile.country ? (
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden>{getFlagEmoji(profile.country)}</span>
                    {countryLabel || profile.country}
                  </span>
                ) : (
                  "Not set"
                )}
              </FieldValue>
            </dl>
          )}
        </CardContent>

        {editing && (
          <CardFooter className="flex-col-reverse gap-2 border-t pt-6 sm:flex-row sm:justify-between">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="size-3.5" />
              Changes are only saved when you press Save.
            </p>
            <div className="flex w-full gap-2 sm:w-auto">
              <Button
                variant="outline"
                className="flex-1 sm:flex-none"
                onClick={cancelEditing}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                className="flex-1 sm:flex-none"
                onClick={handleSave}
                disabled={saving || !isDirty}
              >
                {saving ? (
                  <>
                    <Loader2 className="size-4 animate-spin" />
                    Saving…
                  </>
                ) : (
                  "Save changes"
                )}
              </Button>
            </div>
          </CardFooter>
        )}
      </Card>
    </div>
  );
};

export default ProfilePage;
