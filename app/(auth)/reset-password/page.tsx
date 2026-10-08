import ResetPasswordPage from "@/components/reset-password";
import { Ripple } from "@/components/ui/ripple";
import { Suspense } from "react";

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
