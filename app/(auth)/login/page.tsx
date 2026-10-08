import LoginPage from "@/components/login";
import { Ripple } from "@/components/ui/ripple";
import React from "react";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Sign in to AntiMising to access your notes, canvases, and passwords.",
};

const Login = () => {
  return (
    <div className="w-full h-screen overflow-hidden flex items-center justify-center relative">
      <Ripple />

      <LoginPage />

    </div>
  );
};

export default Login;
