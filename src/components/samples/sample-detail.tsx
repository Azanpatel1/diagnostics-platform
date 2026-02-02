"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useOrganization } from "@clerk/nextjs";
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
  Brain,
  Play,
  Loader2,
  Copy,
  TreeDeciduous,
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
import { useToast } from "@/hooks/use-toast";
import { getSampleFeatures } from "@/actions/features";
import { listJobsForSample, JobWithDetails } from "@/actions/jobs";
import { getSample, type SampleDetail as SampleDetailType } from "@/actions/samples";
import { deleteArtifact } from "@/actions/artifacts";
import { getActiveModel, type ModelWithDetails } from "@/actions/models";
import { getPrediction, getLeafEmbedding, type PredictionWithModel, type LeafEmbeddingData } from "@/actions/predictions";
import type { SampleFeature } from "@/db/schema";

interface SampleDetailProps {
  sample: SampleDetailType;
}

export function SampleDetail({ sample: initialSample }: SampleDetailProps) {
  const { toast } = useToast();
  const { organization } = useOrganization();
  const [sample, setSample] = useState(initialSample);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [features, setFeatures] = useState<SampleFeature[]>([]);
  const [jobs, setJobs] = useState<JobWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Prediction state
  const [activeModel, setActiveModel] = useState<ModelWithDetails | null>(null);
  const [prediction, setPrediction] = useState<PredictionWithModel | null>(null);
  const [leafEmbedding, setLeafEmbedding] = useState<LeafEmbeddingData | null>(null);
  const [predicting, setPredicting] = useState(false);

  // Load features, jobs, and prediction data
  useEffect(() => {
    async function loadData() {
      try {
        const [featuresResult, jobsResult, modelResult, predictionResult] = await Promise.all([
          getSampleFeatures(sample.id),
          listJobsForSample(sample.id),
          getActiveModel("binary_classification"),
          getPrediction(sample.id),
        ]);
        
        if (featuresResult.success) {
          setFeatures(featuresResult.features);
        }
        if (jobsResult.success) {
          setJobs(jobsResult.jobs);
        }
        if (modelResult.success && modelResult.data) {
          setActiveModel(modelResult.data);
        }
        if (predictionResult.success && predictionResult.data) {
          setPrediction(predictionResult.data);
          // Load leaf embedding if we have a prediction
          const leafResult = await getLeafEmbedding(sample.id, predictionResult.data.modelId);
          if (leafResult.success && leafResult.data) {
            setLeafEmbedding(leafResult.data);
          }
        }
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [sample.id]);
  
  async function handleRunPrediction() {
    if (!organization?.id || !activeModel) return;
    
    setPredicting(true);
    try {
      const response = await fetch(`/api/samples/${sample.id}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-clerk-org-id": organization.id,
        },
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Prediction complete",
          description: `Predicted class: ${result.data.predictedClass} (probability: ${(result.data.yHat * 100).toFixed(1)}%)`,
        });
        
        // Refresh prediction data
        const predictionResult = await getPrediction(sample.id);
        if (predictionResult.success && predictionResult.data) {
          setPrediction(predictionResult.data);
          const leafResult = await getLeafEmbedding(sample.id, predictionResult.data.modelId);
          if (leafResult.success && leafResult.data) {
            setLeafEmbedding(leafResult.data);
          }
        }
      } else {
        toast({
          title: "Prediction failed",
          description: result.error || "Failed to run prediction",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to connect to prediction service",
        variant: "destructive",
      });
    } finally {
      setPredicting(false);
    }
  }
  
  function copyLeafIndices() {
    if (leafEmbedding) {
      navigator.clipboard.writeText(JSON.stringify(leafEmbedding.leafIndices));
      toast({
        title: "Copied",
        description: "Leaf indices copied to clipboard",
      });
    }
  }

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

  async function handleUploadSuccess() {
    // Close the dialog
    setUploadDialogOpen(false);
    
    // Refresh sample data to get the new artifact
    const result = await getSample(sample.id);
    if (result.success && result.data) {
      setSample(result.data);
    }
  }

  async function handleDeleteArtifact(artifactId: string) {
    const result = await deleteArtifact(artifactId);
    if (result.success) {
      toast({
        title: "File deleted",
        description: "The file has been removed.",
      });
      // Refresh sample data
      const refreshResult = await getSample(sample.id);
      if (refreshResult.success && refreshResult.data) {
        setSample(refreshResult.data);
      }
    } else {
      toast({
        title: "Delete failed",
        description: result.error || "Failed to delete file",
        variant: "destructive",
      });
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

      {/* Tabs for Files, Features, Predictions, Jobs */}
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
          <TabsTrigger value="prediction" className="flex items-center gap-2">
            <Brain className="h-4 w-4" />
            Prediction
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
                    onSuccess={handleUploadSuccess}
                  />
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent>
              <ArtifactList
                artifacts={sample.artifacts}
                showExtract={true}
                showDelete={true}
                onDelete={handleDeleteArtifact}
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

        <TabsContent value="prediction">
          <div className="space-y-4">
            {/* Prediction Result Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Prediction Result</CardTitle>
                  <CardDescription>
                    {prediction
                      ? `Last prediction using ${prediction.modelName} v${prediction.modelVersion}`
                      : "No prediction available for this sample"}
                  </CardDescription>
                </div>
                {activeModel && (
                  <Button onClick={handleRunPrediction} disabled={predicting}>
                    {predicting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4 mr-2" />
                    )}
                    {prediction ? "Re-run Prediction" : "Run Prediction"}
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {prediction ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Probability</p>
                      <p className="text-2xl font-bold font-mono">
                        {(prediction.yHat * 100).toFixed(2)}%
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Threshold</p>
                      <p className="text-2xl font-bold font-mono">
                        {(prediction.threshold * 100).toFixed(0)}%
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Predicted Class</p>
                      <Badge 
                        className={`text-lg px-3 py-1 ${
                          prediction.predictedClass === 1 
                            ? "bg-red-100 text-red-800 hover:bg-red-100" 
                            : "bg-green-100 text-green-800 hover:bg-green-100"
                        }`}
                      >
                        {prediction.predictedClass === 1 ? "Positive" : "Negative"}
                      </Badge>
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium text-muted-foreground">Predicted At</p>
                      <p className="text-sm">
                        {formatDateTime(prediction.createdAt)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Brain className="h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No prediction yet</h3>
                    <p className="text-muted-foreground text-center max-w-sm mb-4">
                      {activeModel
                        ? "Click \"Run Prediction\" to predict this sample using the active model."
                        : "No active model available. Please activate a model first."}
                    </p>
                    {!activeModel && (
                      <Link href="/models">
                        <Button variant="outline">Go to Models</Button>
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Leaf Embedding Debug Card */}
            {leafEmbedding && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TreeDeciduous className="h-5 w-5" />
                      Leaf Embedding
                    </CardTitle>
                    <CardDescription>
                      XGBoost leaf indices for similarity analysis
                    </CardDescription>
                  </div>
                  <Button variant="outline" size="sm" onClick={copyLeafIndices}>
                    <Copy className="h-4 w-4 mr-2" />
                    Copy Array
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-6">
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Number of Trees</p>
                        <p className="text-xl font-bold">{leafEmbedding.leafIndices.length}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">Created At</p>
                        <p className="text-sm">{formatDateTime(leafEmbedding.createdAt)}</p>
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground mb-2">
                        First 20 Leaf Indices
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {leafEmbedding.leafIndices.slice(0, 20).map((idx, i) => (
                          <Badge key={i} variant="secondary" className="font-mono">
                            {idx}
                          </Badge>
                        ))}
                        {leafEmbedding.leafIndices.length > 20 && (
                          <Badge variant="outline">
                            +{leafEmbedding.leafIndices.length - 20} more
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="jobs">
          <Card>
            <CardHeader>
              <CardTitle>Job History</CardTitle>
              <CardDescription>
                {jobs.length > 0
                  ? "Recent feature extraction and prediction jobs for this sample"
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
