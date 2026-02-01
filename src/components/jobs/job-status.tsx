"use client";

import { useEffect, useState } from "react";
import { Loader2, CheckCircle2, XCircle, Clock, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { enqueueExtractFeatures, getJob, getLatestJobForArtifact, JobWithDetails } from "@/actions/jobs";
import { useToast } from "@/hooks/use-toast";

interface JobStatusProps {
  artifactId: string;
  artifactSchemaVersion: string;
  onJobComplete?: () => void;
}

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; label: string; animate?: boolean }> = {
  queued: {
    icon: Clock,
    color: "bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20",
    label: "Queued",
  },
  running: {
    icon: Loader2,
    color: "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20",
    label: "Running",
    animate: true,
  },
  succeeded: {
    icon: CheckCircle2,
    color: "bg-green-500/10 text-green-500 hover:bg-green-500/20",
    label: "Succeeded",
  },
  failed: {
    icon: XCircle,
    color: "bg-red-500/10 text-red-500 hover:bg-red-500/20",
    label: "Failed",
  },
};

export function JobStatus({
  artifactId,
  artifactSchemaVersion,
  onJobComplete,
}: JobStatusProps) {
  const { toast } = useToast();
  const [job, setJob] = useState<JobWithDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  // Load the latest job for this artifact
  useEffect(() => {
    async function loadJob() {
      const result = await getLatestJobForArtifact(artifactId);
      if (result.success && result.data) {
        setJob(result.data);
        // Start polling if job is in progress
        if (["queued", "running"].includes(result.data.status)) {
          setIsPolling(true);
        }
      }
    }
    loadJob();
  }, [artifactId]);

  // Poll for job updates when in progress
  useEffect(() => {
    if (!isPolling || !job) return;

    const interval = setInterval(async () => {
      const result = await getJob(job.id);
      if (result.success && result.data) {
        setJob(result.data);
        if (["succeeded", "failed"].includes(result.data.status)) {
          setIsPolling(false);
          if (result.data.status === "succeeded") {
            onJobComplete?.();
          }
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isPolling, job, onJobComplete]);

  async function handleExtract() {
    // Check if schema version is supported
    if (!["v1_timeseries_csv", "v1_endpoint_json"].includes(artifactSchemaVersion)) {
      toast({
        title: "Unsupported schema",
        description: `Schema version "${artifactSchemaVersion}" is not supported for feature extraction. Supported: v1_timeseries_csv, v1_endpoint_json`,
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      // Extraction now happens synchronously
      const result = await enqueueExtractFeatures(artifactId);
      
      if (result.success && result.data) {
        // Reload the job to get full details
        const jobResult = await getJob(result.data.jobId);
        if (jobResult.success && jobResult.data) {
          setJob(jobResult.data);
          
          if (jobResult.data.status === "succeeded") {
            toast({
              title: "Features extracted",
              description: `Successfully extracted ${result.data.featuresCount || 0} features.`,
            });
            onJobComplete?.();
          } else if (jobResult.data.status === "failed") {
            toast({
              title: "Extraction failed",
              description: jobResult.data.error || "Unknown error",
              variant: "destructive",
            });
          }
        }
      } else {
        toast({
          title: "Extraction failed",
          description: result.error,
          variant: "destructive",
        });
        // Still try to load job status to show error
        if (result.data?.jobId) {
          const jobResult = await getJob(result.data.jobId);
          if (jobResult.success && jobResult.data) {
            setJob(jobResult.data);
          }
        }
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to extract features",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  // Check if we can extract
  const canExtract = ["v1_timeseries_csv", "v1_endpoint_json"].includes(artifactSchemaVersion);

  if (!job) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleExtract}
        disabled={isLoading || !canExtract}
        title={!canExtract ? "Update schema_version to v1_timeseries_csv or v1_endpoint_json" : undefined}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Play className="h-4 w-4 mr-2" />
        )}
        Extract Features
      </Button>
    );
  }

  const config = STATUS_CONFIG[job.status];
  const Icon = config?.icon || Clock;

  return (
    <div className="flex items-center gap-2">
      <Badge variant="secondary" className={config?.color}>
        <Icon className={`h-3 w-3 mr-1 ${config?.animate ? "animate-spin" : ""}`} />
        {config?.label || job.status}
      </Badge>
      {["succeeded", "failed"].includes(job.status) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleExtract}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Re-run"
          )}
        </Button>
      )}
    </div>
  );
}
