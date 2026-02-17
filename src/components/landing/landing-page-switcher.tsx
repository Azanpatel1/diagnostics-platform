"use client";

import { useState } from "react";
import { LandingPage } from "./landing-page";
import { LandingPageWarm } from "./landing-page-warm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Palette } from "lucide-react";

type LandingPageVariant = "modern" | "warm";

export function LandingPageSwitcher() {
  const [variant, setVariant] = useState<LandingPageVariant>("modern");

  return (
    <div className="relative">
      {/* Floating Switcher */}
      <div className="fixed bottom-6 right-6 z-50">
        <div className="flex items-center gap-2 bg-white dark:bg-gray-900 rounded-full shadow-2xl border border-gray-200 dark:border-gray-700 p-2 pr-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white">
            <Palette className="h-4 w-4" />
          </div>
          <Select value={variant} onValueChange={(v) => setVariant(v as LandingPageVariant)}>
            <SelectTrigger className="w-[160px] border-0 shadow-none focus:ring-0 bg-transparent">
              <SelectValue placeholder="Select style" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="modern">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-br from-blue-500 to-purple-500" />
                  Modern Dark
                </div>
              </SelectItem>
              <SelectItem value="warm">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gradient-to-br from-[#D4C4B0] to-[#8B5E3C]" />
                  Warm & Elegant
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Landing Page Content */}
      {variant === "modern" ? <LandingPage /> : <LandingPageWarm />}
    </div>
  );
}
