import ResetPasswordPage from "@/components/reset-password";
import { Ripple } from "@/components/ui/ripple";
import { Suspense } from "react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Choose a new password for your AntiMising account.",
};

const ResetPassword = () => {
  return (
    <div className="w-full h-screen overflow-hidden flex items-center justify-center relative">
      <Ripple />

      <Suspense>
        <ResetPasswordPage />
      </Suspense>
    </div>
  );
};

export default ResetPassword;
