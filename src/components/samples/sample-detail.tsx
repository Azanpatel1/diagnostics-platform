"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Plus,
  FileUp,
  FlaskConical,
  Activity,
  User,
  Calendar,
  Beaker,
  Tag,
  Edit,
  Trash2,
  CheckCircle2,
  Clock,
  BarChart3,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileUpload } from "@/components/artifacts/file-upload";
import { ArtifactList } from "@/components/artifacts/artifact-list";
import { FeatureDisplay } from "@/components/features/feature-display";
import { JobHistory } from "@/components/jobs/job-history";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { formatDate, formatDateTime } from "@/lib/utils";
import { getSampleFeatures } from "@/actions/features";
import { listJobsForSample } from "@/actions/jobs";
import type { SampleDetail as SampleDetailType } from "@/actions/samples";
import type { SampleFeature, Job } from "@/db/schema";

interface SampleDetailProps {
  sample: SampleDetailType;
}

export function SampleDetail({ sample }: SampleDetailProps) {
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [features, setFeatures] = useState<SampleFeature[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);

  // Load features and jobs
  useEffect(() => {
    async function loadData() {
      try {
        const [featuresResult, jobsResult] = await Promise.all([
          getSampleFeatures(sample.id),
          listJobsForSample(sample.id),
        ]);
        if (featuresResult.success) {
          setFeatures(featuresResult.features);
        }
        if (jobsResult.success) {
          setJobs(jobsResult.jobs);
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [sample.id]);

  async function handleFeatureExtracted() {
    // Reload features when a new extraction completes
    const result = await getSampleFeatures(sample.id);
    if (result.success) {
      setFeatures(result.features);
    }
    const jobsResult = await listJobsForSample(sample.id);
    if (jobsResult.success) {
      setJobs(jobsResult.jobs);
    }
  }

  const hasFeatures = features.length > 0;
  const pendingJobs = jobs.filter((j) => j.status === "queued" || j.status === "running").length;
  const completedJobs = jobs.filter((j) => j.status === "succeeded").length;

  return (
    <div className="space-y-6">
      <Breadcrumbs
        items={[
          { label: "Experiments", href: "/experiments" },
          { label: sample.experimentName, href: `/experiments/${sample.experimentId}` },
          { label: sample.sampleLabel || "Sample" },
        ]}
      />

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">
              {sample.sampleLabel || "Unnamed Sample"}
            </h1>
            {hasFeatures && (
              <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Processed
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 text-muted-foreground">
            <FlaskConical className="h-4 w-4" />
            <Link
              href={`/experiments/${sample.experimentId}`}
              className="hover:text-foreground transition-colors"
            >
              {sample.experimentName}
            </Link>
          </div>
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
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <FileUp className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Files</p>
              <p className="text-2xl font-bold">{sample.artifacts.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-100">
              <BarChart3 className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Feature Sets</p>
              <p className="text-2xl font-bold">{features.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Completed Jobs</p>
              <p className="text-2xl font-bold">{completedJobs}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Pending Jobs</p>
              <p className="text-2xl font-bold">{pendingJobs}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Metadata Card */}
      <Card>
        <CardHeader>
          <CardTitle>Sample Information</CardTitle>
          <CardDescription>Details and metadata for this sample</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Tag className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Label</p>
                <p className="text-sm mt-0.5">{sample.sampleLabel || "Not specified"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Patient ID</p>
                <p className="text-sm mt-0.5 font-mono">
                  {sample.patientPseudonym || "Not specified"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Beaker className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Matrix Type</p>
                <p className="text-sm mt-0.5">{sample.matrixType || "Not specified"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Collected</p>
                <p className="text-sm mt-0.5">
                  {sample.collectedAt ? formatDate(sample.collectedAt) : "Not specified"}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs for Files, Features, Jobs */}
      <Tabs defaultValue="files" className="space-y-4">
        <TabsList>
          <TabsTrigger value="files" className="flex items-center gap-2">
            <FileUp className="h-4 w-4" />
            Files ({sample.artifacts.length})
          </TabsTrigger>
          <TabsTrigger value="features" className="flex items-center gap-2">
            <Activity className="h-4 w-4" />
            Features ({features.length})
          </TabsTrigger>
          <TabsTrigger value="jobs" className="flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Jobs ({jobs.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="files">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Attached Files</CardTitle>
                <CardDescription>
                  {sample.artifacts.length} file
                  {sample.artifacts.length !== 1 ? "s" : ""} attached to this sample
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
                    <DialogTitle>Upload File for Sample</DialogTitle>
                    <DialogDescription>
                      Upload a CSV or JSON file to attach to this sample
                    </DialogDescription>
                  </DialogHeader>
                  <FileUpload
                    experimentId={sample.experimentId}
                    sampleId={sample.id}
                    onSuccess={() => setUploadDialogOpen(false)}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <ArtifactList
                artifacts={sample.artifacts}
                showExtract={true}
                onFeatureExtracted={handleFeatureExtracted}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="features">
          <Card>
            <CardHeader>
              <CardTitle>Computed Features</CardTitle>
              <CardDescription>
                {features.length > 0
                  ? "Features extracted from uploaded artifacts"
                  : "No features computed yet. Upload an artifact and extract features."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FeatureDisplay features={features} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="jobs">
          <Card>
            <CardHeader>
              <CardTitle>Job History</CardTitle>
              <CardDescription>
                {jobs.length > 0
                  ? "Recent feature extraction jobs for this sample"
                  : "No jobs have been run for this sample yet."}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {jobs.length > 0 ? (
                <JobHistory jobs={jobs} />
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No jobs yet</h3>
                  <p className="text-muted-foreground text-center max-w-sm">
                    Upload a data file and click "Extract Features" to process this sample.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
