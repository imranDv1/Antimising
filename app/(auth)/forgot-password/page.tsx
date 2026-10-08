import ForgotPasswordPage from "@/components/forgot-password";
import { Ripple } from "@/components/ui/ripple";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forgot Password",
  description: "Reset your AntiMising password and get back to your workspace.",
};

const ForgotPassword = () => {
  return (
    <div className="w-full h-screen overflow-hidden flex items-center justify-center relative">
      <Ripple />

      <ForgotPasswordPage />
    </div>
  );
};

export default ForgotPassword;
