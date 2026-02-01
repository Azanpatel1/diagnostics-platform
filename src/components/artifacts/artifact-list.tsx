"use client";

import { Download, FileText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/utils";
import { getArtifactDownloadUrl } from "@/actions/artifacts";
import { useToast } from "@/hooks/use-toast";
import { JobStatus } from "@/components/jobs/job-status";

interface Artifact {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: string | null;
  sha256: string;
  schemaVersion: string;
  createdAt: Date;
}

interface ArtifactListProps {
  artifacts: Artifact[];
  showDelete?: boolean;
  showExtract?: boolean;
  onDelete?: (id: string) => void;
  onFeatureExtracted?: () => void;
}

export function ArtifactList({
  artifacts,
  showDelete = false,
  showExtract = false,
  onDelete,
  onFeatureExtracted,
}: ArtifactListProps) {
  const { toast } = useToast();

  async function handleDownload(artifactId: string) {
    const result = await getArtifactDownloadUrl(artifactId);

    if (result.success && result.data) {
      window.open(result.data.downloadUrl, "_blank");
    } else {
      toast({
        title: "Download failed",
        description: result.error || "Could not generate download link",
        variant: "destructive",
      });
    }
  }

  if (artifacts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p>No files uploaded yet.</p>
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>File Name</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Schema</TableHead>
          <TableHead>Size</TableHead>
          <TableHead>Uploaded</TableHead>
          {showExtract && <TableHead>Features</TableHead>}
          <TableHead className="w-[100px]"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {artifacts.map((artifact) => (
          <TableRow key={artifact.id}>
            <TableCell className="font-medium">{artifact.fileName}</TableCell>
            <TableCell className="text-muted-foreground">
              {artifact.fileType}
            </TableCell>
            <TableCell className="text-muted-foreground text-xs">
              {artifact.schemaVersion}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {artifact.fileSize || "—"}
            </TableCell>
            <TableCell className="text-muted-foreground">
              {formatDateTime(artifact.createdAt)}
            </TableCell>
            {showExtract && (
              <TableCell>
                <JobStatus
                  artifactId={artifact.id}
                  artifactSchemaVersion={artifact.schemaVersion}
                  onJobComplete={onFeatureExtracted}
                />
              </TableCell>
            )}
            <TableCell>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDownload(artifact.id)}
                  title="Download"
                >
                  <Download className="h-4 w-4" />
                </Button>
                {showDelete && onDelete && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onDelete(artifact.id)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
