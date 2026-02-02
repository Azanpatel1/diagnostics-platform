"use client";

import { useState, useEffect, useRef } from "react";
import { useOrganization } from "@clerk/nextjs";
import { Loader2, Upload, AlertCircle, FileArchive } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface ModelUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

export function ModelUploadDialog({
  open,
  onOpenChange,
  onComplete,
}: ModelUploadDialogProps) {
  const { organization } = useOrganization();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [name, setName] = useState("");
  const [version, setVersion] = useState("");
  const [task, setTask] = useState("binary_classification");
  const [featureSetId, setFeatureSetId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  
  const [featureSets, setFeatureSets] = useState<Array<{ id: string; name: string; version: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && organization?.id) {
      loadFeatureSets();
    }
  }, [open, organization?.id]);

  async function loadFeatureSets() {
    try {
      const response = await fetch("/api/feature-sets", {
        headers: {
          "x-clerk-org-id": organization?.id || "",
        },
      });
      const result = await response.json();
      if (result.success && result.data) {
        setFeatureSets(result.data);
        if (result.data.length > 0 && !featureSetId) {
          setFeatureSetId(result.data[0].id);
        }
      } else if (result.error) {
        console.error("Failed to load feature sets:", result.error);
      }
    } catch (err) {
      console.error("Failed to load feature sets:", err);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.endsWith(".zip")) {
        setError("Please select a .zip file");
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!file || !name || !version || !featureSetId) {
      setError("Please fill in all required fields");
      return;
    }

    if (!organization?.id) {
      setError("No organization selected");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Upload file to server (server handles S3 upload to avoid CORS)
      setUploading(true);
      
      const formData = new FormData();
      formData.append("file", file);
      formData.append("fileName", file.name);

      let uploadResponse;
      try {
        uploadResponse = await fetch("/api/models/upload", {
          method: "POST",
          headers: {
            "x-clerk-org-id": organization.id,
          },
          body: formData,
        });
      } catch (fetchError) {
        console.error("Upload error:", fetchError);
        throw new Error("Network error: Could not connect to server");
      }

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        console.error("Upload error:", uploadResponse.status, errorText);
        throw new Error(`Server error (${uploadResponse.status}): ${errorText}`);
      }

      const uploadResult = await uploadResponse.json();
      
      if (!uploadResult.success) {
        throw new Error(uploadResult.error || "Failed to upload model");
      }

      const { storageKey } = uploadResult;
      setUploading(false);

      // Register model in database via API
      const registerResponse = await fetch("/api/models/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-clerk-org-id": organization.id,
        },
        body: JSON.stringify({
          name,
          version,
          task,
          featureSetId,
          storageKey,
          modelFormat: "xgboost_json",
        }),
      });

      const registerResult = await registerResponse.json();

      if (!registerResult.success) {
        throw new Error(registerResult.error || "Failed to register model");
      }

      // Reset form and close
      setName("");
      setVersion("");
      setTask("binary_classification");
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Model Bundle</DialogTitle>
          <DialogDescription>
            Upload an XGBoost model bundle (.zip) containing xgb_model.json and
            model_config.json
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {error && (
              <div className="flex items-center gap-2 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="name">Model Name</Label>
              <Input
                id="name"
                placeholder="e.g., sepsis_classifier"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="version">Version</Label>
              <Input
                id="version"
                placeholder="e.g., 1.0.0"
                value={version}
                onChange={(e) => setVersion(e.target.value)}
                required
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="task">Task Type</Label>
              <Select value={task} onValueChange={setTask}>
                <SelectTrigger>
                  <SelectValue placeholder="Select task type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="binary_classification">
                    Binary Classification
                  </SelectItem>
                  <SelectItem value="multiclass_classification">
                    Multiclass Classification
                  </SelectItem>
                  <SelectItem value="regression">Regression</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="featureSet">Feature Set</Label>
              <Select value={featureSetId} onValueChange={setFeatureSetId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select feature set" />
                </SelectTrigger>
                <SelectContent>
                  {featureSets.map((fs) => (
                    <SelectItem key={fs.id} value={fs.id}>
                      {fs.name} v{fs.version}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {featureSets.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No feature sets found. Extract features from samples first.
                </p>
              )}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="file">Model Bundle (.zip)</Label>
              <div className="flex items-center gap-2">
                <Input
                  ref={fileInputRef}
                  id="file"
                  type="file"
                  accept=".zip"
                  onChange={handleFileChange}
                  className="flex-1"
                  required
                />
              </div>
              {file && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <FileArchive className="h-4 w-4" />
                  {file.name} ({(file.size / 1024).toFixed(1)} KB)
                </div>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !file}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  {uploading ? "Uploading..." : "Registering..."}
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Upload
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
