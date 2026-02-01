"use client";

import { CheckCircle2, XCircle, Clock, Loader2 } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";
import type { Job } from "@/db/schema";

interface JobHistoryProps {
  jobs: Job[];
}

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; label: string; animate?: boolean }> = {
  queued: {
    icon: Clock,
    color: "bg-yellow-500/10 text-yellow-500",
    label: "Queued",
  },
  running: {
    icon: Loader2,
    color: "bg-blue-500/10 text-blue-500",
    label: "Running",
    animate: true,
  },
  succeeded: {
    icon: CheckCircle2,
    color: "bg-green-500/10 text-green-500",
    label: "Succeeded",
  },
  failed: {
    icon: XCircle,
    color: "bg-red-500/10 text-red-500",
    label: "Failed",
  },
};

export function JobHistory({ jobs }: JobHistoryProps) {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-4 text-muted-foreground">
        No jobs recorded yet.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Started</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead>Details</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {jobs.map((job) => {
          const config = STATUS_CONFIG[job.status];
          const Icon = config?.icon || Clock;
          const output = job.output as Record<string, unknown> | null;

          return (
            <TableRow key={job.id}>
              <TableCell className="font-medium">{job.type}</TableCell>
              <TableCell>
                <Badge variant="secondary" className={config?.color}>
                  <Icon
                    className={`h-3 w-3 mr-1 ${config?.animate ? "animate-spin" : ""}`}
                  />
                  {config?.label || job.status}
                </Badge>
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatDateTime(job.createdAt)}
              </TableCell>
              <TableCell className="text-muted-foreground text-sm">
                {formatDateTime(job.updatedAt)}
              </TableCell>
              <TableCell className="text-sm">
                {job.status === "succeeded" && output && (
                  <span className="text-green-600">
                    {String(output.num_features)} features computed
                  </span>
                )}
                {job.status === "failed" && job.error && (
                  <span className="text-red-600 text-xs" title={job.error}>
                    {job.error.substring(0, 50)}
                    {job.error.length > 50 ? "..." : ""}
                  </span>
                )}
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
