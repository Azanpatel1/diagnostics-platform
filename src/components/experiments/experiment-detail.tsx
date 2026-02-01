"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Plus,
  TestTubes,
  FileUp,
  Calendar,
  User,
  Cpu,
  FileCode,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { SampleForm } from "@/components/samples/sample-form";
import { FileUpload } from "@/components/artifacts/file-upload";
import { ArtifactList } from "@/components/artifacts/artifact-list";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { formatDate, formatDateTime } from "@/lib/utils";
import type { ExperimentDetail as ExperimentDetailType } from "@/actions/experiments";

interface ExperimentDetailProps {
  experiment: ExperimentDetailType;
}

export function ExperimentDetail({ experiment }: ExperimentDetailProps) {
  const [sampleDialogOpen, setSampleDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Experiments", href: "/experiments" },
          { label: experiment.name },
        ]}
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{experiment.name}</h1>
          <p className="text-muted-foreground mt-1">
            Created {formatDateTime(experiment.createdAt)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
              <TestTubes className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Samples</p>
              <p className="text-2xl font-bold">{experiment.samples.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <FileUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Files</p>
              <p className="text-2xl font-bold">{experiment.artifacts.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Processed</p>
              <p className="text-2xl font-bold">0</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pending</p>
              <p className="text-2xl font-bold">{experiment.artifacts.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metadata Card */}
      <Card>
        <CardHeader>
          <CardTitle>Experiment Details</CardTitle>
          <CardDescription>Metadata and configuration</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <FileCode className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Protocol</p>
                <p className="text-sm mt-0.5">
                  {experiment.protocolVersion || "Not specified"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Cpu className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Instrument</p>
                <p className="text-sm mt-0.5">
                  {experiment.instrumentId || "Not specified"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Operator</p>
                <p className="text-sm mt-0.5">
                  {experiment.operator || "Not specified"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Started</p>
                <p className="text-sm mt-0.5">
                  {experiment.startedAt
                    ? formatDate(experiment.startedAt)
                    : "Not specified"}
                </p>
              </div>
            </div>
          </div>
          {experiment.notes && (
            <div className="mt-6 pt-6 border-t">
              <p className="text-sm font-medium text-muted-foreground mb-2">Notes</p>
              <p className="text-sm whitespace-pre-wrap bg-muted/50 p-3 rounded-lg">
                {experiment.notes}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Samples Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TestTubes className="h-5 w-5" />
              Samples
            </CardTitle>
            <CardDescription>
              {experiment.samples.length} sample
              {experiment.samples.length !== 1 ? "s" : ""} in this experiment
            </CardDescription>
          </div>
          <Dialog open={sampleDialogOpen} onOpenChange={setSampleDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Sample
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Sample</DialogTitle>
                <DialogDescription>
                  Create a new sample for this experiment
                </DialogDescription>
              </DialogHeader>
              <SampleForm
                experimentId={experiment.id}
                onSuccess={() => setSampleDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {experiment.samples.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <TestTubes className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No samples yet</h3>
              <p className="text-muted-foreground max-w-sm mb-4">
                Add your first sample to start collecting diagnostic data.
              </p>
              <Button onClick={() => setSampleDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Add Sample
              </Button>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Label</TableHead>
                    <TableHead>Patient ID</TableHead>
                    <TableHead>Matrix Type</TableHead>
                    <TableHead>Collected</TableHead>
                    <TableHead className="text-center">Files</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {experiment.samples.map((sample) => (
                    <TableRow key={sample.id}>
                      <TableCell className="font-medium">
                        {sample.sampleLabel || "—"}
                      </TableCell>
                      <TableCell>
                        <span className="font-mono text-sm">
                          {sample.patientPseudonym || "—"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {sample.matrixType ? (
                          <Badge variant="outline">{sample.matrixType}</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sample.collectedAt
                          ? formatDate(sample.collectedAt)
                          : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{sample.artifactCount}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">Pending</Badge>
                      </TableCell>
                      <TableCell>
                        <Link href={`/samples/${sample.id}`}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Raw Files Section */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileUp className="h-5 w-5" />
              Raw Data Files
            </CardTitle>
            <CardDescription>
              {experiment.artifacts.length} file
              {experiment.artifacts.length !== 1 ? "s" : ""} uploaded
            </CardDescription>
          </div>
          <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Upload File
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Upload Raw Data File</DialogTitle>
                <DialogDescription>
                  Upload a CSV or JSON file to attach to this experiment
                </DialogDescription>
              </DialogHeader>
              <FileUpload
                experimentId={experiment.id}
                samples={experiment.samples}
                onSuccess={() => setUploadDialogOpen(false)}
              />
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <ArtifactList
            artifacts={experiment.artifacts.map((a) => ({
              id: a.id,
              fileName: a.fileName,
              fileType: a.fileType,
              fileSize: a.fileSize,
              sha256: a.sha256,
              schemaVersion: a.schemaVersion,
              createdAt: a.createdAt,
            }))}
            showExtract={true}
          />
        </CardContent>
      </Card>
    </div>
  );
}
