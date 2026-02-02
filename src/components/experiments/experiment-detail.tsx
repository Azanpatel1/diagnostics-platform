"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
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
  Loader2,
  AlertTriangle,
  Brain,
  Play,
  Zap,
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SampleForm } from "@/components/samples/sample-form";
import { FileUpload } from "@/components/artifacts/file-upload";
import { ArtifactList } from "@/components/artifacts/artifact-list";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatDateTime } from "@/lib/utils";
import { getExperiment, deleteExperiment, type ExperimentDetail as ExperimentDetailType } from "@/actions/experiments";
import { deleteArtifact } from "@/actions/artifacts";
import { getActiveModel, type ModelWithDetails } from "@/actions/models";
import { getPredictionsForExperiment, type PredictionWithModel } from "@/actions/predictions";

interface ExperimentDetailProps {
  experiment: ExperimentDetailType;
}

export function ExperimentDetail({ experiment: initialExperiment }: ExperimentDetailProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { organization } = useOrganization();
  const [experiment, setExperiment] = useState(initialExperiment);
  const [sampleDialogOpen, setSampleDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Prediction state
  const [activeModel, setActiveModel] = useState<ModelWithDetails | null>(null);
  const [predictions, setPredictions] = useState<Map<string, PredictionWithModel>>(new Map());
  const [predictingAll, setPredictingAll] = useState(false);
  const [predictingSample, setPredictingSample] = useState<string | null>(null);

  // Load active model and predictions
  useEffect(() => {
    async function loadPredictionData() {
      try {
        const [modelResult, predictionsResult] = await Promise.all([
          getActiveModel("binary_classification"),
          getPredictionsForExperiment(experiment.id),
        ]);
        
        if (modelResult.success && modelResult.data) {
          setActiveModel(modelResult.data);
        }
        
        if (predictionsResult.success && predictionsResult.data) {
          setPredictions(predictionsResult.data);
        }
      } catch (error) {
        console.error("Failed to load prediction data:", error);
      }
    }
    
    loadPredictionData();
  }, [experiment.id]);

  async function handlePredictSample(sampleId: string) {
    if (!organization?.id) return;
    
    setPredictingSample(sampleId);
    try {
      const response = await fetch(`/api/samples/${sampleId}/predict`, {
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
        
        // Refresh predictions
        const predictionsResult = await getPredictionsForExperiment(experiment.id);
        if (predictionsResult.success && predictionsResult.data) {
          setPredictions(predictionsResult.data);
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
      setPredictingSample(null);
    }
  }

  async function handlePredictAll() {
    if (!organization?.id) return;
    
    setPredictingAll(true);
    try {
      const response = await fetch(`/api/experiments/${experiment.id}/predict`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-clerk-org-id": organization.id,
        },
      });
      
      const result = await response.json();
      
      if (result.success) {
        toast({
          title: "Batch prediction complete",
          description: `${result.data.successful} of ${result.data.totalSamples} samples predicted successfully`,
        });
        
        // Refresh predictions
        const predictionsResult = await getPredictionsForExperiment(experiment.id);
        if (predictionsResult.success && predictionsResult.data) {
          setPredictions(predictionsResult.data);
        }
      } else {
        toast({
          title: "Batch prediction failed",
          description: result.error || "Failed to run predictions",
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
      setPredictingAll(false);
    }
  }

  async function handleDeleteExperiment() {
    setIsDeleting(true);
    try {
      const result = await deleteExperiment(experiment.id);
      if (result.success) {
        toast({
          title: "Experiment deleted",
          description: "The experiment and all associated data have been deleted.",
        });
        router.push("/experiments");
      } else {
        toast({
          title: "Delete failed",
          description: result.error || "Failed to delete experiment",
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: "Error",
        description: "An error occurred while deleting the experiment",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleDeleteArtifact(artifactId: string) {
    const result = await deleteArtifact(artifactId);
    if (result.success) {
      toast({
        title: "File deleted",
        description: "The file has been removed.",
      });
      // Refresh experiment data
      const refreshResult = await getExperiment(experiment.id);
      if (refreshResult.success && refreshResult.data) {
        setExperiment(refreshResult.data);
      }
    } else {
      toast({
        title: "Delete failed",
        description: result.error || "Failed to delete file",
        variant: "destructive",
      });
    }
  }

  async function handleUploadSuccess() {
    // Close the dialog
    setUploadDialogOpen(false);
    
    // Refresh experiment data to get the new artifact
    const result = await getExperiment(experiment.id);
    if (result.success && result.data) {
      setExperiment(result.data);
    }
  }

  async function handleSampleCreated() {
    // Close the dialog
    setSampleDialogOpen(false);
    
    // Refresh experiment data to get the new sample
    const result = await getExperiment(experiment.id);
    if (result.success && result.data) {
      setExperiment(result.data);
    }
  }

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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  Delete Experiment
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete <strong>{experiment.name}</strong>? 
                  This will permanently delete all associated samples, files, and features. 
                  This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteExperiment}
                  disabled={isDeleting}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete Experiment"
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
              <Brain className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Predicted</p>
              <p className="text-2xl font-bold">{predictions.size}</p>
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
              <p className="text-2xl font-bold">{experiment.samples.length - predictions.size}</p>
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
              {activeModel && (
                <span className="ml-2 text-xs">
                  • Active model: <span className="font-medium">{activeModel.name} v{activeModel.version}</span>
                </span>
              )}
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {activeModel && experiment.samples.length > 0 && (
              <Button
                variant="outline"
                onClick={handlePredictAll}
                disabled={predictingAll}
              >
                {predictingAll ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Zap className="h-4 w-4 mr-2" />
                )}
                Predict All
              </Button>
            )}
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
                  onSuccess={handleSampleCreated}
                />
              </DialogContent>
            </Dialog>
          </div>
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
                    <TableHead className="text-center">Files</TableHead>
                    <TableHead className="text-center">Prediction</TableHead>
                    <TableHead className="text-center">Class</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {experiment.samples.map((sample) => {
                    const prediction = predictions.get(sample.id);
                    return (
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
                        <TableCell className="text-center">
                          <Badge variant="secondary">{sample.artifactCount}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {prediction ? (
                            <span className="font-mono text-sm font-medium">
                              {(prediction.yHat * 100).toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          {prediction ? (
                            <Badge 
                              className={prediction.predictedClass === 1 
                                ? "bg-red-100 text-red-800 hover:bg-red-100" 
                                : "bg-green-100 text-green-800 hover:bg-green-100"
                              }
                            >
                              {prediction.predictedClass === 1 ? "Positive" : "Negative"}
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Pending</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {activeModel && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handlePredictSample(sample.id)}
                                disabled={predictingSample === sample.id || predictingAll}
                              >
                                {predictingSample === sample.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Play className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                            <Link href={`/samples/${sample.id}`}>
                              <Button variant="ghost" size="sm">
                                View
                              </Button>
                            </Link>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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
                onSuccess={handleUploadSuccess}
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
            showDelete={true}
            onDelete={handleDeleteArtifact}
          />
        </CardContent>
      </Card>
    </div>
  );
}
