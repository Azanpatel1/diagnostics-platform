"use client";

import Link from "next/link";
import { FlaskConical, FileText, TestTube } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { ExperimentWithCounts } from "@/actions/experiments";

interface ExperimentListProps {
  experiments: ExperimentWithCounts[];
}

export function ExperimentList({ experiments }: ExperimentListProps) {
  if (experiments.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-16">
          <FlaskConical className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No experiments yet</h3>
          <p className="text-muted-foreground text-center max-w-sm">
            Create your first experiment to start organizing samples and data
            files.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>All Experiments</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Protocol</TableHead>
              <TableHead>Operator</TableHead>
              <TableHead>Started</TableHead>
              <TableHead className="text-center">Samples</TableHead>
              <TableHead className="text-center">Files</TableHead>
              <TableHead>Created</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {experiments.map((experiment) => (
              <TableRow key={experiment.id}>
                <TableCell>
                  <Link
                    href={`/experiments/${experiment.id}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {experiment.name}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {experiment.protocolVersion || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {experiment.operator || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(experiment.startedAt)}
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <TestTube className="h-4 w-4 text-muted-foreground" />
                    <span>{experiment.sampleCount}</span>
                  </div>
                </TableCell>
                <TableCell className="text-center">
                  <div className="flex items-center justify-center gap-1">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span>{experiment.artifactCount}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatDate(experiment.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
