"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ParticleNetwork } from "@/components/landing/particle-network";
import {
  FlaskConical,
  TestTubes,
  Shield,
  Zap,
  BarChart3,
  Users,
  ArrowRight,
  Dna,
} from "lucide-react";

export function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated Background */}
      <ParticleNetwork />


      {/* Hero Section */}
      <main className="relative z-10">
        <section className="container mx-auto px-4 pt-24 pb-20">
          <div className="mx-auto max-w-4xl text-center">
            {/* Badge */}
            <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-sm font-medium text-primary backdrop-blur-sm">
              <Zap className="h-4 w-4" />
              Next-generation biomarker analysis
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl font-bold tracking-tight sm:text-7xl">
              <span className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-100 dark:via-gray-200 dark:to-gray-100 bg-clip-text text-transparent">
                Precision Diagnostics
              </span>
              <br />
              <span className="bg-gradient-to-r from-primary via-purple-500 to-pink-500 bg-clip-text text-transparent">
                Powered by Data
              </span>
            </h1>

            {/* Subtitle */}
            <p className="mx-auto mt-8 max-w-2xl text-lg leading-relaxed text-muted-foreground">
              Transform your diagnostic workflows with our secure, multi-tenant platform. 
              Manage experiments, analyze biomarkers, and extract actionable insights 
              with enterprise-grade security.
            </p>

            {/* CTA Buttons */}
            <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link href="/sign-up">
                <Button size="lg" className="h-12 px-8 text-base">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/sign-in">
                <Button variant="outline" size="lg" className="h-12 px-8 text-base bg-background/60 backdrop-blur-sm">
                  Sign In to Dashboard
                </Button>
              </Link>
            </div>

            {/* Trust Indicators */}
            <div className="mt-16 flex items-center justify-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-green-500" />
                <span>HIPAA Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-blue-500" />
                <span>Multi-tenant</span>
              </div>
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span>Real-time Processing</span>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Everything you need for diagnostic excellence
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                A complete platform for managing your diagnostic data pipeline
              </p>
            </div>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon={<FlaskConical className="h-6 w-6" />}
                title="Experiment Management"
                description="Organize experiments with complete metadata tracking, protocol versioning, and operator assignment."
                gradient="from-blue-500 to-cyan-500"
              />
              <FeatureCard
                icon={<TestTubes className="h-6 w-6" />}
                title="Sample Tracking"
                description="Track samples from collection through analysis with full chain of custody and matrix type classification."
                gradient="from-purple-500 to-pink-500"
              />
              <FeatureCard
                icon={<BarChart3 className="h-6 w-6" />}
                title="Feature Extraction"
                description="Automated biomarker feature extraction with deterministic algorithms and versioned feature sets."
                gradient="from-green-500 to-emerald-500"
              />
              <FeatureCard
                icon={<Shield className="h-6 w-6" />}
                title="Enterprise Security"
                description="Role-based access control, complete audit trails, and organization-level data isolation."
                gradient="from-orange-500 to-red-500"
              />
              <FeatureCard
                icon={<Zap className="h-6 w-6" />}
                title="Real-time Processing"
                description="Background job queue for feature extraction with live status updates and error handling."
                gradient="from-yellow-500 to-orange-500"
              />
              <FeatureCard
                icon={<Users className="h-6 w-6" />}
                title="Team Collaboration"
                description="Invite team members, manage permissions, and collaborate on experiments in real-time."
                gradient="from-indigo-500 to-purple-500"
              />
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container mx-auto px-4 py-20">
          <div className="mx-auto max-w-4xl">
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary via-purple-500 to-pink-500 p-px">
              <div className="rounded-[calc(1.5rem-1px)] bg-background/95 backdrop-blur-xl p-12 text-center">
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                  Ready to transform your diagnostics workflow?
                </h2>
                <p className="mt-4 text-lg text-muted-foreground">
                  Join leading research teams already using our platform
                </p>
                <div className="mt-8">
                  <Link href="/sign-up">
                    <Button size="lg" className="h-12 px-8 text-base">
                      Get Started Free
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/40 bg-background/60 backdrop-blur-xl py-8">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <Dna className="h-4 w-4" />
              </div>
              <span className="font-semibold">Diagnostics</span>
            </div>
            <p className="text-sm text-muted-foreground">
              &copy; {new Date().getFullYear()} Diagnostics Platform. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  gradient,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  gradient: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-border/50 bg-background/60 backdrop-blur-sm p-6 transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5">
      <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} text-white`}>
        {icon}
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{description}</p>
      
      {/* Hover gradient effect */}
      <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${gradient} opacity-0 transition-opacity group-hover:opacity-5`} />
    </div>
  );
}
