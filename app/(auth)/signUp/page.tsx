import SignUpPage from "@/components/signUp";
import { Ripple } from "@/components/ui/ripple";
import React from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Account",
  description:
    "Create your free Rinsign account — notes, canvas, and passwords in one secure place.",
};

const SignUp = () => {
  return (
    <div className="w-full h-screen overflow-hidden flex items-center justify-center relative">
      <Ripple />

      <SignUpPage siteKey={process.env.CLOUDFLARE_TURNSTILE_SITE_KEY ?? ""} />
    </div>
  );
};

export default SignUp;
