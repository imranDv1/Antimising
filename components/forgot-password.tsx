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
import { Loader2, MailCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";

const formSchema = z.object({
  email: z.email(),
});

export default function ForgotPasswordPage() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  });

  const [Loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setLoading(true);
    await authClient.requestPasswordReset({
      email: values.email,
      redirectTo: "/reset-password",
      fetchOptions: {
        onSuccess: () => {
          setSent(true);
          toast.success("If an account exists, a reset link has been sent");
        },
        onError: (ctx) => {
          toast.error(ctx.error.message || "Something went wrong");
        },
      },
    });
    setLoading(false);
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
              Forgot your password?
            </h1>
            <p className="text-muted-foreground">
              Enter your email and we&apos;ll send you a reset link
            </p>
          </div>

          {sent ? (
            <div className="mt-6 space-y-6 rounded-lg border border-dashed p-6 text-center">
              <MailCheck className="mx-auto size-8 text-primary" />
              <p className="text-sm text-muted-foreground">
                Check your inbox at{" "}
                <span className="font-medium text-foreground">
                  {form.getValues("email")}
                </span>{" "}
                for a link to reset your password.
              </p>
              <Button
                asChild
                variant="outline"
                className="w-full cursor-pointer"
              >
                <Link href="/login">Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <div className="mt-6">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-8"
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input placeholder="m@example.com" {...field} />
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
                      "Send reset link"
                    )}
                  </Button>
                </form>
              </Form>
            </div>
          )}
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
