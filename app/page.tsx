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
          Notes, canvas whiteboards, and a password manager in one secure app — write with rich text, tag and search everything, favorite what matters, and share with others, anytime, anywhere.
        </p>
        <FeaturesSection />
      </div>

      <div className="w-[95%] lg:w-[80%] mx-auto flex flex-col gap-5 mt-16 mb-2">
        <h2 className="text-3xl lg:text-5xl font-bold text-center mt-8 mb-2">
          Why Choose AntiMising?
        </h2>
        <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto">
          An AI writing assistant, real-time device sync, and encrypted storage — everything you need for ideas, tasks, and passwords, always at your fingertips.
        </p>
      </div>
      <Features10 />
      
      <div className="w-[95%] lg:w-[80%] mx-auto flex flex-col gap-3">
        <h1 className=" text-3xl lg:text-5xl font-bold text-center mt-8 mb-2">
          Effortless Sync, Exceptional Security
        </h1>
        <p className="text-sm text-muted-foreground text-center max-w-2xl mx-auto mb-4">
          Your notes, canvas boards, and saved passwords stay in sync across all your devices — protected with strong encryption, everywhere and always.
        </p>
        <GlowingEffectDemoSecond />
      </div>
      <div className="w-[95%] lg:w-[80%] mx-auto flex flex-col gap-5 mt-16 mb-2">
        <h2 className="text-3xl lg:text-5xl font-bold text-center">
          Advanced Features for Productive Note-Taking
        </h2>
        <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto">
          Rich text editing, tagging, favorites, sharing, an AI note writer, an infinite canvas, and an encrypted password vault — unlock a new level of efficiency with AntiMising.
        </p>
      </div>
      <FeaturesSection2/>
      <Pricing userId={userId} hasSubscription={hasSubs} />
      <FooterSection />
    </div>
  );
}
