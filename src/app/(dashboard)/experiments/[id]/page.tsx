"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { getExperiment, ExperimentDetail as ExperimentDetailType } from "@/actions/experiments";
import { ExperimentDetail } from "@/components/experiments/experiment-detail";
import { Loader2 } from "lucide-react";

export default function ExperimentPage() {
  const params = useParams();
  const { organization, isLoaded } = useOrganization();
  const [experiment, setExperiment] = useState<ExperimentDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchExperiment() {
      if (!isLoaded) return;
      
      if (!organization?.id) {
        setLoading(false);
        setError("No organization selected");
        return;
      }

      const id = params.id as string;
      const result = await getExperiment(id, organization.id);

      if (result.success && result.data) {
        setExperiment(result.data);
      } else {
        setError(result.error || "Experiment not found");
      }
      setLoading(false);
    }

    fetchExperiment();
  }, [params.id, organization?.id, isLoaded]);

  if (loading || !isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !experiment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <h1 className="text-2xl font-bold">Experiment Not Found</h1>
        <p className="text-muted-foreground">{error || "The experiment could not be found."}</p>
      </div>
    );
  }

  return <ExperimentDetail experiment={experiment} />;
}
