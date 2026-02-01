"use client";

import { ExperimentForm } from "@/components/experiments/experiment-form";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";

export default function NewExperimentPage() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Breadcrumbs
        items={[
          { label: "Experiments", href: "/experiments" },
          { label: "New" },
        ]}
      />

      <div>
        <h1 className="text-3xl font-bold tracking-tight">New Experiment</h1>
        <p className="text-muted-foreground">
          Create a new diagnostic experiment
        </p>
      </div>

      <ExperimentForm />
    </div>
  );
}
