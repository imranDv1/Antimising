"use client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { authClient } from "@/lib/auth-client";
import { useAddPassNotificationStore } from "@/context/addPass";
import { usePassCacheStore, type Pass } from "@/context/passCacheStore";
import CreateNewPass, {
  DeletePass,
  EditPass,
  type EditPassPayload,
} from "../action";
import { toast } from "sonner";
import {
  Briefcase,
  Coins,
  Copy,
  Cpu,
  Ellipsis,
  Eye,
  EyeOff,
  Gamepad2,
  GraduationCap,
  KeyRound,
  Landmark,
  Lock,
  Mail,
  Pencil,
  Plus,
  Search,
  Share2,
  ShoppingCart,
  Trash2,
  Tv,
  User,
  Wifi,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Controller, SubmitHandler, useForm } from "react-hook-form";

// 🧠 الكاش يعتبر "طازجًا" خلال 60 ثوانٍ — لا جلب عند الرجوع لهذه الصفحة
const TTL_MS = 60_000;

type PassForm = {
  title: string;
  username: string;
  password: string;
  description: string;
  category: string;
};

type CategoryMeta = {
  value: string;
  label: string;
  icon: LucideIcon;
};

const CATEGORY_ICON_BLOCK = "bg-primary/10 text-primary";

const PASS_CATEGORIES: CategoryMeta[] = [
  { value: "social-media", label: "Social Media", icon: Share2 },
  { value: "email", label: "Email", icon: Mail },
  { value: "gmail", label: "Gmail", icon: Mail },
  { value: "facebook", label: "Facebook", icon: Share2 },
  { value: "work", label: "Work", icon: Briefcase },
  { value: "finance", label: "Finance & Banking", icon: Landmark },
  { value: "shopping", label: "Shopping", icon: ShoppingCart },
  { value: "gaming", label: "Gaming", icon: Gamepad2 },
  { value: "streaming", label: "Streaming", icon: Tv },
  { value: "education", label: "Education", icon: GraduationCap },
  { value: "wifi", label: "Wi-Fi / Home", icon: Wifi },
  { value: "crypto", label: "Crypto", icon: Coins },
  { value: "tech", label: "Tech & Apps", icon: Cpu },
  { value: "other", label: "Other", icon: Ellipsis },
];

const getCategoryMeta = (category: string): CategoryMeta =>
  PASS_CATEGORIES.find((c) => c.value === category) ?? {
    value: category,
    label: category.charAt(0).toUpperCase() + category.slice(1),
    icon: Ellipsis,
  };

const DEFAULT_FORM: PassForm = {
  title: "",
  username: "",
  password: "",
  description: "",
  category: "",
};

const PassComponent = () => {
  const { data: session } = authClient.useSession();
  const userId = session?.user?.id;

  const [pass, setPass] = useState<Pass[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [passToDelete, setPassToDelete] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [editTarget, setEditTarget] = useState<Pass | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
  const [showCreatePass, setShowCreatePass] = useState(false);
  const [showEditPass, setShowEditPass] = useState(false);

  const refreshAddPassSignal = useAddPassNotificationStore(
    (state) => state.refreshAddPassSignal,
  );
  const prevSignalRef = useRef(refreshAddPassSignal);

  const { register, handleSubmit, control, reset } = useForm<PassForm>({
    defaultValues: DEFAULT_FORM,
  });

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    control: controlEdit,
    reset: resetEdit,
  } = useForm<PassForm>({
    defaultValues: DEFAULT_FORM,
  });

  useEffect(() => {
    if (!userId) return;

    const fetchPasses = async (showSkeleton: boolean) => {
      try {
        if (showSkeleton) setLoading(true);
        const res = await fetch(`/api/passManGet`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId }),
        });
        if (!res.ok) throw new Error("Failed to fetch pass");
        const data = ((await res.json()) as Pass[]).sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        );
        usePassCacheStore.getState().setPass(userId, data);
        setPass(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    const store = usePassCacheStore.getState();
    const signalChanged = prevSignalRef.current !== refreshAddPassSignal;
    prevSignalRef.current = refreshAddPassSignal;

    if (store.userId === userId && Array.isArray(store.pass)) {
      // 🧠 عرض فوري من الكاش، مع إعادة تحقق خلفية فقط عند انتهاء صلاحيته
      setPass(store.pass);
      setLoading(false);
      const fresh = Date.now() - store.fetchedAt < TTL_MS;
      if (fresh && !signalChanged) return;
      fetchPasses(false);
    } else {
      fetchPasses(true);
    }
  }, [userId, refreshAddPassSignal]);

  const categoriesInUse = useMemo(
    () => Array.from(new Set(pass.map((p) => p.category))),
    [pass],
  );

  const filteredPasses = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let base = pass;
    if (activeCategory) {
      base = base.filter((p) => p.category === activeCategory);
    }
    if (!q) return base;
    return base.filter((p) => {
      return (
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.username.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q)
      );
    });
  }, [pass, searchQuery, activeCategory]);

  const openCreate = () => {
    reset(DEFAULT_FORM);
    setShowCreatePass(false);
    setCreateOpen(true);
  };

  const onSubmit: SubmitHandler<PassForm> = async (values) => {
    const formData = new FormData();
    formData.append("title", values.title);
    formData.append("description", values.description);
    formData.append("emailOruser", values.username);
    formData.append("password", values.password);
    formData.append("category", values.category);
    setCreateLoading(true);
    try {
      const res = await CreateNewPass(formData);
      if (res.success && res.pass) {
        // 🧠 تحديث الكاش محليًا — لا إعادة جلب ولا وميض خلف الـ Dialog
        setPass((prev) => [res.pass as Pass, ...prev]);
        usePassCacheStore.getState().prepend(res.pass as Pass);
        setCreateOpen(false);
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setCreateLoading(false);
    }
  };

  const openEdit = (item: Pass) => {
    setEditTarget(item);
    resetEdit({
      title: item.title,
      username: item.username,
      description: item.description,
      category: item.category,
      password: "",
    });
    setShowEditPass(false);
    setEditOpen(true);
  };

  const onSubmitEdit: SubmitHandler<PassForm> = async (values) => {
    if (!editTarget) return;
    const payload: EditPassPayload = { id: editTarget.id };
    if (values.title) payload.title = values.title;
    if (values.description) payload.description = values.description;
    if (values.username) payload.emailOruser = values.username;
    if (values.category) payload.category = values.category;
    if (values.password) payload.password = values.password;
    setEditLoading(true);
    try {
      const res = await EditPass(payload);
      if (res.success && res.pass) {
        // 🧠 تحديث الكاش محليًا
        const updated = res.pass as Pass;
        setPass((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
        usePassCacheStore.getState().update(updated);
        setEditOpen(false);
        setEditTarget(null);
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    setPassToDelete(id);
    setDeleteOpen(true);
  };

  const confirmDelete = async () => {
    if (!passToDelete) return;
    setDeleteLoading(true);
    try {
      const res = await DeletePass(passToDelete);
      if (res.success) {
        // 🧠 تحديث الكاش محليًا
        const id = passToDelete;
        setPass((prev) => prev.filter((p) => p.id !== id));
        usePassCacheStore.getState().remove(id);
        setDeleteOpen(false);
        toast.success(res.message);
      } else {
        toast.error(res.message);
      }
    } catch (err) {
      console.error(err);
      toast.error("Something went wrong");
    } finally {
      setDeleteLoading(false);
    }
  };

  const toggleReveal = (id: string) => {
    setRevealed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyText = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied!`);
    } catch {
      toast.error("Failed to copy");
    }
  };

  return (
    <div className="w-full flex flex-col gap-5">
      {/* ─── Header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex size-12 shrink-0 items-center justify-center  bg-primary/10 text-primary">
            <Lock className="size-6" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h1 className="text-2xl font-bold tracking-tight">
              Password Management
            </h1>
            <p className="text-sm text-muted-foreground">
              {pass.length > 0
                ? `${pass.length} secured password${pass.length !== 1 ? "s" : ""} in your vault`
                : "Manage all your passwords securely to not forget them again"}
            </p>
          </div>
        </div>
        <Button className="w-full sm:w-min" onClick={openCreate}>
          <Plus className="size-4" />
          Create Password
        </Button>
      </div>

      {/* ─── Toolbar: category chips + search ───────────────────────────── */}
      <div className="flex flex-col gap-3">
        {categoriesInUse.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant={activeCategory === null ? "default" : "outline"}
              onClick={() => setActiveCategory(null)}
            >
              All
            </Button>
            {categoriesInUse.map((cat) => {
              const meta = getCategoryMeta(cat);
              const count = pass.filter((p) => p.category === cat).length;
              return (
                <Button
                  key={cat}
                  size="sm"
                  variant={activeCategory === cat ? "default" : "outline"}
                  onClick={() =>
                    setActiveCategory((prev) => (prev === cat ? null : cat))
                  }
                  className="gap-1.5"
                >
                  <meta.icon className="size-3.5" />
                  {meta.label}
                  <Badge variant="secondary" className="ml-0.5 px-1.5">
                    {count}
                  </Badge>
                </Button>
              );
            })}
          </div>
        )}
        <InputGroup>
          <InputGroupInput
            placeholder="Search by title, username or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <InputGroupAddon>
            <Search />
          </InputGroupAddon>
        </InputGroup>
      </div>

      {/* ─── Cards grid ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-3 pb-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading && (
          <>
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i} className="animate-pulse ">
                <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 pb-0">
                  <div className="size-9  bg-muted" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="h-3.5 w-3/4 rounded bg-muted" />
                    <div className="h-3 w-1/2 rounded bg-muted" />
                  </div>
                </CardHeader>
                <CardContent className="grid gap-1.5 p-4">
                  <div className="h-8  bg-muted" />
                  <div className="h-8  bg-muted" />
                </CardContent>
                <CardFooter className="p-4 pt-0">
                  <div className="h-7 w-full  bg-muted" />
                </CardFooter>
              </Card>
            ))}
          </>
        )}

        {!loading && filteredPasses.length === 0 && (
          <div className="col-span-full flex flex-col items-center justify-center gap-4  border border-dashed py-20 text-center">
            <div className="flex size-14 items-center justify-center  bg-primary/10 text-primary">
              <KeyRound className="size-7" />
            </div>
            <div className="flex flex-col gap-1">
              <h3 className="text-lg font-semibold">No passwords found</h3>
              <p className="text-sm text-muted-foreground">
                {pass.length === 0
                  ? "Create your first password to get started."
                  : "Try a different search or category filter."}
              </p>
            </div>
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Create Password
            </Button>
          </div>
        )}

        {!loading &&
          filteredPasses.map((item) => {
            const meta = getCategoryMeta(item.category);
            const isRevealed = revealed.has(item.id);
            return (
              <Card
                key={item.id}
                className="bg-card gap-2  transition-shadow hover:shadow-md"
              >
                <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 pt-0 pb-0">
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center ",
                      CATEGORY_ICON_BLOCK,
                    )}
                  >
                    <meta.icon className="size-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <CardTitle className="truncate text-sm">
                      {item.title}
                    </CardTitle>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.description}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-1.5 px-3 pb-3 pt-1">
                  <div className="flex items-center gap-2  border bg-muted/40 px-2.5 py-1.5">
                    <User className="size-3.5 shrink-0 text-primary/70" />
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {item.username}
                    </span>
                    <button
                      type="button"
                      aria-label="Copy username"
                      onClick={() => copyText(item.username, "Username")}
                      className=" p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2  border bg-muted/40 px-2.5 py-1.5">
                    <KeyRound className="size-3.5 shrink-0 text-primary/70" />
                    <span className="min-w-0 flex-1 truncate font-mono text-[13px]">
                      {isRevealed ? item.password : "••••••••••••"}
                    </span>
                    <button
                      type="button"
                      aria-label={
                        isRevealed ? "Hide password" : "Show password"
                      }
                      onClick={() => toggleReveal(item.id)}
                      className=" p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                    >
                      {isRevealed ? (
                        <EyeOff className="size-3.5" />
                      ) : (
                        <Eye className="size-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      aria-label="Copy password"
                      onClick={() => copyText(item.password, "Password")}
                      className=" p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                    >
                      <Copy className="size-3.5" />
                    </button>
                  </div>
                </CardContent>
                <CardFooter className="justify-between px-3 pb-0 pt-0">
                  <Badge
                    variant="outline"
                    onClick={() =>
                      setActiveCategory((prev) =>
                        prev === item.category ? null : item.category,
                      )
                    }
                    className="cursor-pointer select-none text-[10px]"
                  >
                    {meta.label}
                  </Badge>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 gap-1 px-2 text-xs"
                      onClick={() => openEdit(item)}
                    >
                      <Pencil className="size-3" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 px-2 text-red-500 hover:bg-red-500/10 hover:text-red-600"
                      onClick={() => handleDelete(item.id)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
      </div>

      {/* ─── Create dialog ──────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create new Password</DialogTitle>
            <DialogDescription>
              Add new Password to save it and manage it
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="grid gap-4">
            <div className="grid gap-3">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="e.g. Gmail, Facebook, Netflix..."
                {...register("title")}
                required
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                placeholder="e.g. Personal Facebook account"
                {...register("description")}
                required
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="username">Username / Email</Label>
              <Input
                id="username"
                placeholder="Enter username or email"
                {...register("username")}
                required
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="password">Password</Label>
              <InputGroup>
                <InputGroupInput
                  id="password"
                  type={showCreatePass ? "text" : "password"}
                  placeholder="Enter the password"
                  {...register("password")}
                  required
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    onClick={() => setShowCreatePass((s) => !s)}
                  >
                    {showCreatePass ? <EyeOff /> : <Eye />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </div>
            <div className="grid gap-3">
              <Label>Category</Label>
              <Controller
                control={control}
                name="category"
                render={({ field: { value, onChange } }) => (
                  <Select required value={value} onValueChange={onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Category</SelectLabel>
                        {PASS_CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button disabled={createLoading} type="submit">
                {createLoading ? (
                  <>
                    <Spinner />
                    <span>Creating...</span>
                  </>
                ) : (
                  <span>Save changes</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Edit dialog ────────────────────────────────────────────────── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Password</DialogTitle>
            <DialogDescription>
              Update only the fields you want to change
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={handleSubmitEdit(onSubmitEdit)}
            className="grid gap-4"
          >
            <div className="grid gap-3">
              <Label htmlFor="edit-title">Title</Label>
              <Input
                id="edit-title"
                placeholder="Title"
                {...registerEdit("title")}
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="edit-description">Description</Label>
              <Input
                id="edit-description"
                placeholder="Description"
                {...registerEdit("description")}
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="edit-username">Username / Email</Label>
              <Input
                id="edit-username"
                placeholder="Username or email"
                {...registerEdit("username")}
              />
            </div>
            <div className="grid gap-3">
              <Label htmlFor="edit-password">Password</Label>
              <InputGroup>
                <InputGroupInput
                  id="edit-password"
                  type={showEditPass ? "text" : "password"}
                  placeholder="Leave blank to keep current"
                  {...registerEdit("password")}
                />
                <InputGroupAddon align="inline-end">
                  <InputGroupButton
                    type="button"
                    onClick={() => setShowEditPass((s) => !s)}
                  >
                    {showEditPass ? <EyeOff /> : <Eye />}
                  </InputGroupButton>
                </InputGroupAddon>
              </InputGroup>
            </div>
            <div className="grid gap-3">
              <Label>Category</Label>
              <Controller
                control={controlEdit}
                name="category"
                render={({ field: { value, onChange } }) => (
                  <Select value={value || ""} onValueChange={onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Category</SelectLabel>
                        {PASS_CATEGORIES.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={editLoading}>
                {editLoading ? (
                  <>
                    <Spinner />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Save changes</span>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ─── Delete confirm ─────────────────────────────────────────────── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <DialogDescription>
            Are you sure you want to delete this Password? This action cannot be
            undone.
          </DialogDescription>
          <DialogFooter className="mt-4 flex justify-end gap-2">
            <Button
              onClick={() => setDeleteOpen(false)}
              variant="outline"
              size="lg"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmDelete}
              disabled={deleteLoading}
              size="lg"
              className="bg-red-500 hover:bg-red-600"
            >
              {deleteLoading ? <Spinner /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PassComponent;
