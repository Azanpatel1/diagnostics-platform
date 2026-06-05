"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

/**
 * NEXTfuge — minimalist, life-science landing page.
 * Warm "paper" canvas, botanical-green accent, editorial serif headlines and
 * monospaced lab labels. Intentionally avoids gradients and busy motion.
 */
export function LandingPage() {
  return (
    <div
      className="min-h-screen antialiased"
      style={{ backgroundColor: "#F6F4EE", color: "#1E2A22" }}
    >
      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-24 pb-20 md:pt-32 md:pb-28">
        <div className="grid items-center gap-16 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p
              className="mb-8 font-mono text-xs uppercase tracking-[0.25em]"
              style={{ color: "#7C8A7E" }}
            >
              NEXTfuge · Precision biology
            </p>

            <h1 className="font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl md:text-7xl">
              Your biology,
              <br />
              read with clarity.
            </h1>

            <p
              className="mt-8 max-w-xl text-lg leading-relaxed"
              style={{ color: "#4C564E" }}
            >
              NEXTfuge turns raw diagnostic signal into language you can act on.
              Run experiments, track every sample, and watch biomarkers resolve
              into insight — without the noise.
            </p>

            <div className="mt-10 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="h-12 rounded-full px-8 text-base text-white shadow-none"
                  style={{ backgroundColor: "#3C5A45" }}
                >
                  Begin
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link
                href="/sign-in"
                className="text-base font-medium underline decoration-1 underline-offset-4 transition-colors"
                style={{ color: "#3C5A45" }}
              >
                Sign in to your lab
              </Link>
            </div>
          </div>

          {/* Quiet, organic visual accent instead of a particle field */}
          <div className="lg:col-span-5">
            <BiomarkerPanel />
          </div>
        </div>
      </section>

      {/* Hairline */}
      <Hairline />

      {/* Principle / philosophy line */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <p
          className="mb-10 font-mono text-xs uppercase tracking-[0.25em]"
          style={{ color: "#7C8A7E" }}
        >
          The idea
        </p>
        <p className="font-display text-2xl leading-snug tracking-tight sm:text-3xl md:text-4xl">
          The body is always speaking. We built the instruments to{" "}
          <span style={{ color: "#3C5A45" }}>listen carefully</span> — and the
          discipline to keep the data honest, traceable, and yours.
        </p>
      </section>

      <Hairline />

      {/* Capabilities — index-numbered, minimal, no gradient tiles */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="mb-16 flex flex-col gap-3">
          <p
            className="font-mono text-xs uppercase tracking-[0.25em]"
            style={{ color: "#7C8A7E" }}
          >
            What you can do
          </p>
          <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
            A quiet, rigorous workspace for the bench.
          </h2>
        </div>

        <div className="grid gap-x-12 gap-y-14 md:grid-cols-2 lg:grid-cols-3">
          {capabilities.map((item, i) => (
            <Capability
              key={item.title}
              index={String(i + 1).padStart(2, "0")}
              title={item.title}
              description={item.description}
            />
          ))}
        </div>
      </section>

      <Hairline />

      {/* Who it's for */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <p
              className="font-mono text-xs uppercase tracking-[0.25em]"
              style={{ color: "#7C8A7E" }}
            >
              Made for
            </p>
            <h2 className="mt-4 font-display text-3xl tracking-tight sm:text-4xl">
              People who answer
              <br />
              to the data.
            </h2>
          </div>
          <ul className="lg:col-span-8 lg:pt-2">
            {audience.map((a, i) => (
              <li
                key={a}
                className="flex items-baseline gap-6 border-t py-5 text-lg"
                style={{
                  borderColor: "#E4E0D6",
                  color: "#3A443C",
                  ...(i === audience.length - 1
                    ? { borderBottom: "1px solid #E4E0D6" }
                    : {}),
                }}
              >
                <span
                  className="font-mono text-xs"
                  style={{ color: "#A6AC9E" }}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                {a}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Hairline />

      {/* Closing CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center md:py-32">
        <h2 className="mx-auto max-w-3xl font-display text-4xl leading-tight tracking-tight sm:text-5xl">
          Start reading your biology
          <br className="hidden sm:block" /> the way it deserves.
        </h2>
        <div className="mt-12">
          <Link href="/sign-up">
            <Button
              size="lg"
              className="h-12 rounded-full px-9 text-base text-white shadow-none"
              style={{ backgroundColor: "#3C5A45" }}
            >
              Create your workspace
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t" style={{ borderColor: "#E4E0D6" }}>
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-10 sm:flex-row sm:items-center">
          <div>
            <p className="font-display text-xl tracking-tight">
              NEXTfuge<sup className="ml-0.5 text-[10px]">™</sup>
            </p>
            <p
              className="mt-1 font-mono text-xs uppercase tracking-[0.2em]"
              style={{ color: "#9AA293" }}
            >
              Precision biology
            </p>
          </div>
          <p className="text-sm" style={{ color: "#8A938B" }}>
            &copy; {new Date().getFullYear()} NEXTfuge. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

const capabilities = [
  {
    title: "Experiments",
    description:
      "Design and version every protocol with full metadata, operators, and context held in one place.",
  },
  {
    title: "Sample lineage",
    description:
      "Follow each sample from collection to result with an unbroken chain of custody and matrix typing.",
  },
  {
    title: "Feature extraction",
    description:
      "Deterministic, versioned algorithms turn signal into biomarkers you can reproduce and trust.",
  },
  {
    title: "Quiet security",
    description:
      "Role-based access, organization-level isolation, and complete audit trails — present, never loud.",
  },
  {
    title: "Living results",
    description:
      "A background engine processes work as it lands, with honest status and clear error states.",
  },
  {
    title: "Shared bench",
    description:
      "Invite your team, set permissions, and move through experiments together in real time.",
  },
];

const audience = [
  "Research & clinical labs",
  "Biotech and diagnostics teams",
  "Longevity & functional medicine practices",
  "Scientists who care where their data has been",
];

function Capability({
  index,
  title,
  description,
}: {
  index: string;
  title: string;
  description: string;
}) {
  return (
    <div className="border-t pt-6" style={{ borderColor: "#E4E0D6" }}>
      <span className="font-mono text-xs" style={{ color: "#A6AC9E" }}>
        {index}
      </span>
      <h3 className="mt-3 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "#5A6359" }}>
        {description}
      </p>
    </div>
  );
}

function Hairline() {
  return (
    <div className="mx-auto max-w-6xl px-6">
      <div className="h-px w-full" style={{ backgroundColor: "#E4E0D6" }} />
    </div>
  );
}

/**
 * A calm, schematic biomarker readout — a hand-built SVG that reads as
 * "life science instrument" without the noise of an animated particle field.
 */
function BiomarkerPanel() {
  const rows = [
    { label: "Inflammation", value: 0.62 },
    { label: "Metabolic", value: 0.84 },
    { label: "Cortisol", value: 0.41 },
    { label: "Recovery", value: 0.73 },
  ];

  return (
    <div
      className="rounded-2xl border p-7"
      style={{ borderColor: "#E0DCD0", backgroundColor: "#FBFAF5" }}
    >
      <div className="mb-6 flex items-center justify-between">
        <span
          className="font-mono text-[11px] uppercase tracking-[0.2em]"
          style={{ color: "#7C8A7E" }}
        >
          Readout · live
        </span>
        <span
          className="inline-flex h-2 w-2 rounded-full"
          style={{ backgroundColor: "#3C5A45" }}
        />
      </div>

      <div className="space-y-5">
        {rows.map((row) => (
          <div key={row.label}>
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm font-medium" style={{ color: "#3A443C" }}>
                {row.label}
              </span>
              <span
                className="font-mono text-xs"
                style={{ color: "#8A938B" }}
              >
                {row.value.toFixed(2)}
              </span>
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full"
              style={{ backgroundColor: "#EAE7DC" }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${row.value * 100}%`,
                  backgroundColor: "#3C5A45",
                }}
              />
            </div>
          </div>
        ))}
      </div>

      <div
        className="mt-7 border-t pt-5 font-mono text-[11px] leading-relaxed"
        style={{ borderColor: "#E4E0D6", color: "#9AA293" }}
      >
        sample 04821 · matrix: serum
        <br />
        features extracted · v2.3
      </div>
    </div>
  );
}
