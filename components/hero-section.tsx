"use client";
import React from "react";
import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { TextEffect } from "@/components/ui/text-effect";
import { AnimatedGroup } from "@/components/ui/animated-group";
import { HeroHeader } from "./header";
import type { Variants } from "motion/react";

import { BorderBeam } from "./ui/border-beam";
import { authClient } from "@/lib/auth-client";
import { Badge } from "./ui/badge";

// Variants for AnimatedGroup items
const itemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 12,
    filter: "blur(12px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      type: "spring" as const, // ✅ TS-safe
      bounce: 0.3,
      duration: 1.5,
    },
  },
};

// Variants for the container
const containerVariants: Variants = {
  visible: {
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.75,
    },
  },
};

const heroPreviewVariants = {
  container: containerVariants,
  item: itemVariants,
};

function HeroAppPreview() {
  return (
    <AnimatedGroup variants={heroPreviewVariants}>
      <div className="mask-b-from-55% relative -mr-56 mt-8 overflow-hidden px-2 sm:mr-0 sm:mt-12 md:mt-20">
        <div className="inset-shadow-2xs ring-background dark:inset-shadow-white/20 bg-background dark:bg-black relative mx-auto max-w-6xl overflow-hidden border border-primary/40 p-4 shadow-lg shadow-zinc-950/15 ring-1">
          <Image
            className="dark:bg-black object-cover object-left aspect-15/8 relative hidden  dark:block"
            src="/Images/hero.png"
            alt="app screen"
            width="2700"
            height="1440"
          />
          <Image
            className="z-2 border-primary/30 object-cover object-left aspect-15/8 relative  border dark:hidden"
            src="/Images/image.png"
            alt="app screen"
            width="2700"
            height="1440"
          />
          <BorderBeam
            size={330}
            colorFrom="#5FE9C0"
            colorTo="#14DD90"
            borderWidth={3}
          />
        </div>
      </div>
    </AnimatedGroup>
  );
}

export default function HeroSection(): React.ReactElement {
  const { data: sessiom } = authClient.useSession();
  return (
    <>
      <HeroHeader />
      <main className="overflow-hidden dark:bg-black">
        <div
          aria-hidden
          className="absolute inset-0 isolate hidden opacity-65 contain-strict lg:block"
        >
          <div className="w-140 h-320 -translate-y-87.5 absolute left-0 top-0 -rotate-45  bg-[radial-gradient(68.54%_68.72%_at_55.02%_31.46%,hsla(0,0%,85%,.08)_0,hsla(0,0%,55%,.02)_50%,hsla(0,0%,45%,0)_80%)]" />
          <div className="h-320 absolute left-0 top-0 w-60 -rotate-45  bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.06)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)] [translate:5%_-50%]" />
          <div className="h-320 -translate-y-87.5 absolute left-0 top-0 w-60 -rotate-45 bg-[radial-gradient(50%_50%_at_50%_50%,hsla(0,0%,85%,.04)_0,hsla(0,0%,45%,.02)_80%,transparent_100%)]" />
        </div>
        <section>
          <div className="relative pt-24 md:pt-36">
            <div
              aria-hidden
              className="absolute inset-0 -z-10 size-full [background:radial-gradient(125%_125%_at_50%_100%,transparent_0%,var(--color-background)_75%)]"
            />

            <div className="mx-auto max-w-7xl px-6">
              <div className="text-center sm:mx-auto lg:mr-auto lg:mt-0">
                <AnimatedGroup
                  variants={{
                    container: {
                      visible: {
                        transition: {
                          staggerChildren: 0.05,
                          delayChildren: 0.5,
                        },
                      },
                    },
                    item: {
                      hidden: {
                        opacity: 0,
                        y: 20,
                      },
                      visible: {
                        opacity: 1,
                        y: 0,
                        transition: {
                          type: "spring" as const,
                          bounce: 0.3,
                          duration: 2,
                        },
                      },
                    },
                  }}
                >
                  <Badge variant="outline"> <ChevronRight/> Introducing the infinite Canvas whiteboard</Badge>
                </AnimatedGroup>

                <TextEffect
                  preset="fade-in-blur"
                  speedSegment={0.3}
                  as="h1"
                  className="mx-auto max-w-4xl  mt-6 text-5xl max-md:font-bold md:text-7xl lg:mt-4 xl:text-[5.25rem]"
                >
                  Organize Your Thoughts Effortlessly
                </TextEffect>
                <TextEffect
                  per="line"
                  preset="fade-in-blur"
                  speedSegment={0.3}
                  delay={0.5}
                  as="p"
                  className="mx-auto mt-8 max-w-4xl text-muted-foreground text-balance text-lg"
                >
                  AntiMising helps you capture ideas, organize notes, manage
                  passwords, and sketch on an infinite canvas. Fast, simple, and
                  accessible anywhere.
                </TextEffect>
              </div>
            </div>

            {sessiom ? (
              <AnimatedGroup
                variants={{
                  container: {
                    visible: {
                      transition: { staggerChildren: 0.08, delayChildren: 1.1 },
                    },
                  },
                  item: itemVariants,
                }}
                className="mx-auto mt-6 flex w-full max-w-7xl items-center justify-center gap-4 px-6"
              >
                <Link
                  href="/dashboard"
                  className={cn(
                    buttonVariants({ variant: "default" }),
                    "group gap-1.5 transition-transform duration-200 hover:-translate-y-0.5"
                  )}
                >
                  Continue to Dashboard
                  <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Link>
                <Link
                  href="https://x.com/imrandv1"
                  target="_blank"
                  rel="noreferrer"
                  className={cn(
                    buttonVariants({ variant: "secondary" }),
                    "transition-transform duration-200 hover:-translate-y-0.5"
                  )}
                >
                  Follow me on X
                </Link>
              </AnimatedGroup>
            ) : null}

            <HeroAppPreview />
          </div>
        </section>
      </main>
    </>
  );
}
