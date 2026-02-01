"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { Upload, FileText, X, Loader2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn, formatFileSize } from "@/lib/utils";

interface FileUploadProps {
  experimentId: string;
  sampleId?: string;
  samples?: { id: string; sampleLabel: string }[];
  onSuccess?: () => void;
}

type UploadState = "idle" | "hashing" | "uploading" | "registering" | "done";

export function FileUpload({
  experimentId,
  sampleId: initialSampleId,
  samples = [],
  onSuccess,
}: FileUploadProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { organization } = useOrganization();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSampleId, setSelectedSampleId] = useState<string>(
    initialSampleId || ""
  );
  const [schemaVersion, setSchemaVersion] = useState<string>("v1");
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  // Auto-detect schema version based on file type
  const handleFileSelect = useCallback(
    (file: File | null) => {
      if (!file) return;

      // Validate file type
      if (!allowedTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a CSV or JSON file.",
          variant: "destructive",
        });
        return;
      }

      setSelectedFile(file);
      setUploadState("idle");
      
      // Auto-suggest schema version based on file type
      if (file.type === "text/csv" || file.name.endsWith(".csv")) {
        setSchemaVersion("v1_timeseries_csv");
      } else if (file.type === "application/json" || file.name.endsWith(".json")) {
        setSchemaVersion("v1_endpoint_json");
      }
    },
    [toast]
  );

  const allowedTypes = [
    "text/csv",
    "application/json",
    "application/vnd.ms-excel",
  ];

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      handleFileSelect(file);
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  async function handleUpload() {
    if (!selectedFile) return;
    
    if (!organization?.id) {
      toast({
        title: "Error",
        description: "Please select an organization first.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Step 1: Prepare upload
      setUploadState("uploading");
      setProgress(20);

      // Step 2: Upload via server-side API (avoids CORS issues)
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("experimentId", experimentId);
      formData.append("schemaVersion", schemaVersion);
      if (selectedSampleId) {
        formData.append("sampleId", selectedSampleId);
      }

      setProgress(40);

      const response = await fetch("/api/upload", {
        method: "POST",
        headers: {
          "x-clerk-org-id": organization.id,
        },
        body: formData,
      });

      setProgress(80);

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || "Upload failed");
      }

      setProgress(100);
      setUploadState("done");

      toast({
        title: "File uploaded",
        description: `${selectedFile.name} has been uploaded successfully.`,
      });

      // Refresh the page data
      router.refresh();

      // Call success callback after a brief delay
      setTimeout(() => {
        onSuccess?.();
      }, 500);
    } catch (error) {
      console.error("Upload error:", error);
      toast({
        title: "Upload failed",
        description:
          error instanceof Error ? error.message : "An error occurred",
        variant: "destructive",
      });
      setUploadState("idle");
      setProgress(0);
    }
  }

  const clearFile = () => {
    setSelectedFile(null);
    setUploadState("idle");
    setProgress(0);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const isUploading = uploadState !== "idle" && uploadState !== "done";

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer",
          isDragging
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          selectedFile && "border-primary/50 bg-primary/5"
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept=".csv,.json"
          onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
          disabled={isUploading}
        />

        {selectedFile ? (
          <div className="flex items-center justify-center gap-3">
            <FileText className="h-8 w-8 text-primary" />
            <div className="text-left">
              <p className="font-medium">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground">
                {formatFileSize(selectedFile.size)} &middot; {selectedFile.type}
              </p>
            </div>
            {!isUploading && (
              <Button
                variant="ghost"
                size="icon"
                className="ml-2"
                onClick={(e) => {
                  e.stopPropagation();
                  clearFile();
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        ) : (
          <>
            <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
            <p className="text-sm font-medium">
              Drop your file here or click to browse
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Supports CSV and JSON files
            </p>
          </>
        )}
      </div>

      {/* Schema version selector */}
      <div className="space-y-2">
        <Label htmlFor="schema">Schema Version</Label>
        <select
          id="schema"
          value={schemaVersion}
          onChange={(e) => setSchemaVersion(e.target.value)}
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          disabled={isUploading}
        >
          <option value="v1">v1 (Generic)</option>
          <option value="v1_timeseries_csv">v1_timeseries_csv (Time-series CSV)</option>
          <option value="v1_endpoint_json">v1_endpoint_json (Endpoint JSON)</option>
        </select>
        <p className="text-xs text-muted-foreground">
          Select the schema that matches your data format for feature extraction
        </p>
      </div>

      {/* Sample selector (if samples are provided and no initial sampleId) */}
      {!initialSampleId && samples.length > 0 && (
        <div className="space-y-2">
          <Label htmlFor="sample">Attach to Sample (optional)</Label>
          <select
            id="sample"
            value={selectedSampleId}
            onChange={(e) => setSelectedSampleId(e.target.value)}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            disabled={isUploading}
          >
            <option value="">No sample (experiment-level)</option>
            {samples.map((sample) => (
              <option key={sample.id} value={sample.id}>
                {sample.sampleLabel}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Progress bar */}
      {isUploading && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              {uploadState === "hashing" && "Computing file hash..."}
              {uploadState === "uploading" && "Uploading to storage..."}
              {uploadState === "registering" && "Registering file..."}
            </span>
            <span className="font-medium">{progress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* Upload complete */}
      {uploadState === "done" && (
        <div className="flex items-center gap-2 text-sm text-green-600">
          <CheckCircle className="h-4 w-4" />
          <span>Upload complete!</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
        >
          {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {uploadState === "done" ? "Done" : "Upload File"}
        </Button>
      </div>
    </div>
  );
}
