import ForgotPasswordPage from "@/components/forgot-password";
import { Ripple } from "@/components/ui/ripple";

const ForgotPassword = () => {
  return (
    <div className="w-full h-screen overflow-hidden flex items-center justify-center relative">
      <Ripple />

      <ForgotPasswordPage />
    </div>
  );
};

export default ForgotPassword;
