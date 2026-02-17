"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Flame,
  Droplets,
  Zap,
  Activity,
  Brain,
  ArrowRight,
  CheckCircle2,
  Beaker,
  Clock,
  Heart,
  Target,
  TrendingUp,
} from "lucide-react";

export function LandingPageWarm() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#F5EDE4] via-[#F8F2EC] to-[#FDF9F5]">
      {/* Header */}
      <header className="border-b border-[#D4C4B0]/30">
        <div className="container mx-auto flex h-20 items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-3">
            <span className="text-2xl font-serif tracking-wide text-[#5D4E37]">
              Next <span className="font-normal">Diagnostics</span>
              <sup className="text-xs">™</sup>
            </span>
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/sign-in">
              <Button 
                variant="ghost" 
                className="text-[#5D4E37] hover:text-[#3D2E1F] hover:bg-[#D4C4B0]/20"
              >
                Sign In
              </Button>
            </Link>
            <Link href="/sign-up">
              <Button className="bg-[#8B5E3C] hover:bg-[#6D4A2F] text-white">
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main>
        <section className="container mx-auto px-6 pt-16 pb-12 text-center">
          <p className="text-3xl md:text-4xl tracking-[0.2em] text-[#8B5E3C] uppercase mb-8 font-serif">
            Longevity
          </p>
          <p className="text-lg text-[#7A6B5A] mb-4">
            You will spend <span className="font-bold text-[#5D4E37]">26 years</span> of your life sleeping.
          </p>
          
          <h1 className="text-3xl md:text-4xl font-serif text-[#5D4E37] mb-4 italic">
            What if you didn&apos;t need more sleep...
            <br />
            <span className="not-italic font-semibold">just smarter recovery?</span>
          </h1>
          
          <p className="text-xl text-[#7A6B5A] mt-8">
            Optimize your sleep. <span className="underline decoration-[#8B5E3C] decoration-2 underline-offset-4">Reclaim up to <strong className="text-[#5D4E37]">7 years</strong> of your life.</span>
          </p>

          {/* CTA */}
          <div className="mt-10">
            <Link href="/sign-up">
              <Button 
                size="lg" 
                className="h-14 px-10 text-lg bg-[#8B5E3C] hover:bg-[#6D4A2F] text-white rounded-full shadow-lg shadow-[#8B5E3C]/20"
              >
                Start Your Recovery Journey
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Divider */}
        <div className="flex justify-center">
          <div className="w-24 h-px bg-gradient-to-r from-transparent via-[#D4C4B0] to-transparent" />
        </div>

        {/* How It Works Section */}
        <section className="container mx-auto px-6 py-16">
          <h2 className="text-center text-2xl font-serif tracking-widest text-[#5D4E37] mb-12">
            HOW IT WORKS
          </h2>
          
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <HowItWorksCard
              number="1"
              title="Measure What Matters"
              subtitle="Biomarker Tracking"
              items={[
                { icon: <Flame className="h-4 w-4" />, label: "Inflammation" },
                { icon: <Activity className="h-4 w-4" />, label: "Cortisol" },
                { icon: <Zap className="h-4 w-4" />, label: "Glucose" },
                { icon: <TrendingUp className="h-4 w-4" />, label: "Metabolism" },
                { icon: <Brain className="h-4 w-4" />, label: "Stress" },
              ]}
            />
            <HowItWorksCard
              number="2"
              title="AI Recovery Engine"
              subtitle="Recovery Efficiency Score™"
              description="Know when you've fully recovered"
              highlight
            />
            <HowItWorksCard
              number="3"
              title="Turn Biology Into Time"
              subtitle="Don't Guess."
              description="Recover Smarter."
              bold
            />
          </div>
        </section>

        {/* Divider */}
        <div className="flex justify-center">
          <div className="w-24 h-px bg-gradient-to-r from-transparent via-[#D4C4B0] to-transparent" />
        </div>

        {/* What Would You Do Section */}
        <section className="container mx-auto px-6 py-16">
          <h2 className="text-center text-xl font-serif tracking-widest text-[#5D4E37] mb-12">
            WHAT WOULD YOU DO WITH AN
            <br />
            <span className="text-2xl">EXTRA HOUR A DAY?</span>
          </h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto">
            <ActivityCard icon={<Target />} label="Build Your Business" />
            <ActivityCard icon={<Activity />} label="Train Harder" />
            <ActivityCard icon={<Brain />} label="Study Smarter" />
            <ActivityCard icon={<Heart />} label="Be With Family" />
          </div>
        </section>

        {/* Divider */}
        <div className="flex justify-center">
          <div className="w-24 h-px bg-gradient-to-r from-transparent via-[#D4C4B0] to-transparent" />
        </div>

        {/* Who It's For Section */}
        <section className="container mx-auto px-6 py-16">
          <h2 className="text-center text-2xl font-serif tracking-widest text-[#5D4E37] mb-10">
            WHO IT&apos;S FOR
          </h2>
          
          <div className="max-w-md mx-auto space-y-4">
            <WhoItsForItem text="Founders & Engineers" />
            <WhoItsForItem text="Medical Professionals" />
            <WhoItsForItem text="Athletes & High Performers" />
            <WhoItsForItem text="Busy Parents & Longevity Optimizers" />
          </div>
        </section>

        {/* Not A Sleep Tracker Section */}
        <section className="container mx-auto px-6 py-12 text-center">
          <p className="text-xl font-serif text-[#5D4E37] tracking-wide underline decoration-[#8B5E3C] decoration-2 underline-offset-4">
            NOT A SLEEP TRACKER.
          </p>
          <p className="mt-2 text-lg italic text-[#7A6B5A]">
            Clinical-Grade Recovery Intelligence.
          </p>
        </section>

        {/* Final CTA */}
        <section className="container mx-auto px-6 py-12 text-center">
          <p className="text-2xl font-serif text-[#5D4E37] italic mb-8">
            Don&apos;t Sleep More. <span className="not-italic font-semibold">Recover Smarter.</span>
          </p>
          
          <Link href="/sign-up">
            <Button 
              size="lg" 
              className="h-14 px-10 text-lg bg-[#8B5E3C] hover:bg-[#6D4A2F] text-white rounded-full shadow-lg shadow-[#8B5E3C]/20"
            >
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#D4C4B0]/30 py-10 mt-8">
        <div className="container mx-auto px-6 text-center">
          <p className="text-xl font-serif text-[#5D4E37] mb-1">
            Next Diagnostics<sup className="text-xs">™</sup>
          </p>
          <p className="text-sm tracking-[0.3em] text-[#7A6B5A] uppercase">
            Longevity
          </p>
          <p className="mt-6 text-xs text-[#A0917E]">
            &copy; {new Date().getFullYear()} Next Diagnostics. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

function HowItWorksCard({
  number,
  title,
  subtitle,
  items,
  description,
  highlight,
  bold,
}: {
  number: string;
  title: string;
  subtitle: string;
  items?: Array<{ icon: React.ReactNode; label: string }>;
  description?: string;
  highlight?: boolean;
  bold?: boolean;
}) {
  return (
    <div className="text-center p-6">
      <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-[#8B5E3C] text-white font-bold mb-4">
        {number}
      </div>
      <h3 className="text-lg font-semibold text-[#5D4E37] mb-2">{title}</h3>
      <p className={`text-sm ${highlight ? 'text-[#8B5E3C]' : 'text-[#7A6B5A]'} mb-3`}>
        {subtitle}
      </p>
      
      {items && (
        <div className="space-y-2">
          {items.map((item, i) => (
            <div key={i} className="flex items-center justify-center gap-2 text-sm text-[#7A6B5A]">
              <span className="text-[#8B5E3C]">{item.icon}</span>
              {item.label}
            </div>
          ))}
        </div>
      )}
      
      {description && (
        <p className={`text-sm ${bold ? 'font-bold text-[#5D4E37]' : 'text-[#7A6B5A]'} mt-2`}>
          {highlight && <span className="text-xs">★ </span>}
          {description}
        </p>
      )}
    </div>
  );
}

function ActivityCard({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-3 p-4">
      <div className="w-20 h-20 rounded-xl bg-[#E8DED2] flex items-center justify-center text-[#8B5E3C]">
        {icon}
      </div>
      <p className="text-sm text-[#5D4E37] text-center font-medium">{label}</p>
    </div>
  );
}

function WhoItsForItem({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3">
      <CheckCircle2 className="h-5 w-5 text-[#8B5E3C] flex-shrink-0" />
      <span className="text-[#5D4E37]">{text}</span>
    </div>
  );
}
