"use client";

import { GlassLogoShowcase } from "@/components/glass-logo-showcase";
import { Hero } from "@/components/hero";
import { LandingAgentScaffold } from "@/components/landing-agent-scaffold";
import { LandingContentScaffold } from "@/components/landing-content-scaffold";
import { LandingTrioScaffold } from "@/components/landing-trio-scaffold";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";

export function HomePage() {
  return (
    <>
      <SiteNav />
      <Hero />
      <main className="relative z-10">
        <LandingAgentScaffold />
        <LandingContentScaffold />
        <LandingTrioScaffold />
        <GlassLogoShowcase />
      </main>
      <SiteFooter />
    </>
  );
}
