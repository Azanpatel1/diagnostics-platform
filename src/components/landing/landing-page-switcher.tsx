"use client";

import { useState } from "react";
import Link from "next/link";
import { LandingPage } from "./landing-page";
import { LandingPageWarm } from "./landing-page-warm";
import { Button } from "@/components/ui/button";

type LandingPageVariant = "nextfuge" | "longevity";

export function LandingPageSwitcher() {
  const [variant, setVariant] = useState<LandingPageVariant>("longevity");

  return (
    <div className="relative">
      {/* Top Navigation Bar with Tabs */}
      <div className={`fixed top-0 left-0 right-0 z-50 backdrop-blur-md border-b ${
        variant === "longevity" 
          ? "bg-[#F5EDE4]/95 border-[#D4C4B0]/30" 
          : "bg-background/95 border-border/40"
      }`}>
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          {/* Logo and Tabs */}
          <div className="flex items-center gap-8">
            <Link href="/" className={`text-xl font-semibold ${
              variant === "longevity" ? "text-[#5D4E37]" : "text-foreground"
            }`}>
              NEXT <span className="font-normal">Diagnostics</span>
              <sup className="text-[10px]">™</sup>
            </Link>
            
            {/* Tabs */}
            <div className="flex items-center">
              <button
                onClick={() => setVariant("longevity")}
                className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
                  variant === "longevity"
                    ? "border-[#8B5E3C] text-[#8B5E3C]"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                Longevity
              </button>
              <button
                onClick={() => setVariant("nextfuge")}
                className={`px-4 py-2 text-sm font-medium transition-all border-b-2 ${
                  variant === "nextfuge"
                    ? "border-primary text-primary"
                    : "border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                }`}
              >
                NEXTfuge
              </button>
            </div>
          </div>

          {/* Right side - Auth buttons */}
          <div className="flex items-center gap-4">
            <Link href="/sign-in">
              <Button 
                variant="ghost" 
                className={variant === "longevity" 
                  ? "text-[#5D4E37] hover:text-[#3D2E1F] hover:bg-[#D4C4B0]/20" 
                  : ""
                }
              >
                Sign In
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button className={variant === "longevity" 
                ? "bg-[#8B5E3C] hover:bg-[#6D4A2F] text-white" 
                : ""
              }>
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Landing Page Content with top padding for fixed header */}
      <div className="pt-16">
        {variant === "nextfuge" ? <LandingPage /> : <LandingPageWarm />}
      </div>
    </div>
  );
}
