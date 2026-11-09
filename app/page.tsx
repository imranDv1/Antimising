import Features10 from "@/components/features-10";
import FeaturesSection from "@/components/features-8";
import FeaturesSection2 from "@/components/features-9";
import FooterSection from "@/components/footer";
import HeroSection from "@/components/hero-section";
import LogoCloud from "@/components/logo-cloud";
import Pricing from "@/components/pricing";
import { GlowingEffectDemoSecond } from "@/components/soloution";
import { auth } from "@/lib/auth";
import { getPlanLimits } from "@/lib/limits";
import { headers } from "next/headers";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const userId = session?.user?.id;

  let hasSubs = false;

  if (userId) {
    hasSubs = (await getPlanLimits(userId)).isPro;
  }

  return (
    <div className='dark:bg-black'>
      
      <HeroSection />
      {/* <LogoCloud/> */}
      <div className="w-[95%] lg:w-[80%] mx-auto flex flex-col gap-5 mt-15">
      <h1 className=" text-3xl lg:text-5xl font-bold text-center mt-8 mb-2">
          Capture, Organize, and Find Your Notes Effortlessly
        </h1>
        <p className="text-muted-foreground text-center text-lg max-w-2xl mx-auto ">
          Notes, canvas boards, and a password manager in one secure app — write
          with rich text, tag and search your notes, save favorites, share with
          the people you choose, and keep everything encrypted at rest.
        </p>
        <FeaturesSection />
      </div>

      <div className="w-[95%] lg:w-[80%] mx-auto flex flex-col gap-5 mt-16 mb-2">
        <h2 className="text-3xl lg:text-5xl font-bold text-center mt-8 mb-2">
          Why Choose AntiMising?
        </h2>
        <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto">
          Encrypted storage, favorites and tags to stay organized, sharing with
          the people you choose, and access from any device you sign in to — all
          in one workspace for notes, boards, and passwords.
        </p>
      </div>
      <Features10 />
      
      <div className="w-[95%] lg:w-[80%] mx-auto flex flex-col gap-3">
        <h1 className=" text-3xl lg:text-5xl font-bold text-center mt-8 mb-2">
          Access Anywhere, Encrypted at Rest
        </h1>
        <p className="text-sm text-muted-foreground text-center max-w-2xl mx-auto mb-4">
          Note bodies, canvas content, and saved passwords are encrypted at rest
          and stored in your account, so they are there whenever you sign in on
          another device.
        </p>
        <GlowingEffectDemoSecond />
      </div>
      <div className="w-[95%] lg:w-[80%] mx-auto flex flex-col gap-5 mt-16 mb-2">
        <h2 className="text-3xl lg:text-5xl font-bold text-center">
          Everything You Need in One Workspace
        </h2>
        <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto">
          Rich text editing, tags and search, favorites, sharing with view or
          edit access, an infinite canvas, and an encrypted password vault.
        </p>
      </div>
      <FeaturesSection2/>
      <Pricing userId={userId} hasSubscription={hasSubs} />
      <FooterSection />
    </div>
  );
}
