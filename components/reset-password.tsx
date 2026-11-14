"use client";
import { LogoIcon } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Link from "next/link";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { useRouter, useSearchParams } from "next/navigation";

const formSchema = z
  .object({
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((values) => values.password === values.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const error = searchParams.get("error");

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const [Loading, setLoading] = useState(false);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!token) return;
    setLoading(true);
    await authClient.resetPassword({
      newPassword: values.password,
      token,
      fetchOptions: {
        onSuccess: () => {
          toast.success(
            "Password reset successful, sign in with your new password",
          );
          router.push("/login");
        },
        onError: (ctx) => {
          toast.error(ctx.error.message || "Something went wrong");
        },
      },
    });
    setLoading(false);
  }

  if (!token || error) {
    return (
      <section className="flex  w-full h-screen bg-background px-4 py-16 md:py-3">
        <div className="max-w-92 m-auto h-fit w-full ">
          <div className="p-6">
            <div>
              <Link
                href="/"
                aria-label="go home"
                className="flex items-center gap-3"
              >
                <LogoIcon className="size-6" />
                <span>Rinsign</span>
              </Link>
              <h1 className="mb-1 mt-4 text-xl font-semibold">
                Invalid reset link
              </h1>
              <p className="text-muted-foreground">
                This link is invalid or has expired. Please request a new one.
              </p>
            </div>

            <div className="mt-6 space-y-6 rounded-lg border border-dashed p-6 text-center">
              <ShieldAlert className="mx-auto size-8 text-destructive" />
              <Button asChild className="w-full cursor-pointer">
                <Link href="/forgot-password">Request a new link</Link>
              </Button>
            </div>
          </div>

          <p className="text-accent-foreground text-center text-sm">
            Remember your password ?
            <Button asChild variant="link" className="px-2">
              <Link href="/login">Sign in</Link>
            </Button>
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="flex  w-full h-screen bg-background px-4 py-16 md:py-3">
      <div className="max-w-92 m-auto h-fit w-full ">
        <div className="p-6">
          <div>
            <Link
              href="/"
              aria-label="go home"
              className="flex items-center gap-3"
            >
              <LogoIcon className="size-6" />
              <span>Rinsign</span>
            </Link>
            <h1 className="mb-1 mt-4 text-xl font-semibold">
              Set a new password
            </h1>
            <p className="text-muted-foreground">
              Choose a new password for your account
            </p>
          </div>

          <div className="mt-6">
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-8"
              >
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter your new password"
                          {...field}
                        />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Repeat your new password"
                          {...field}
                        />
                      </FormControl>

                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full cursor-pointer inline-flex items-center justify-center gap-2 whitespace-nowrap  text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 shadow-md border-[0.5px] border-white/25 shadow-black/20 [&_svg]:drop-shadow-sm not-in-data-[theme=dark]:text-shadow-sm bg-primary ring-1 ring-(--ring-color) [--ring-color:color-mix(in_oklab,var(--color-foreground)15%,var(--color-primary))] text-primary-foreground hover:bg-primary/90 h-9 px-4 py-2"
                  disabled={Loading}
                >
                  {Loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      <span>Loading...</span>
                    </>
                  ) : (
                    "Reset password"
                  )}
                </Button>
              </form>
            </Form>
          </div>
        </div>

        <p className="text-accent-foreground text-center text-sm">
          Remember your password ?
          <Button asChild variant="link" className="px-2">
            <Link href="/login">Sign in</Link>
          </Button>
        </p>
      </div>
    </section>
  );
}
