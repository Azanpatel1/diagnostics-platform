"use client";

import { useEffect, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import Link from "next/link";
import {
  FileBarChart,
  Search,
  Loader2,
  AlertCircle,
  Download,
  Filter,
  BarChart3,
  TrendingUp,
  Eye,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { listAllSamples, type SampleWithDetails } from "@/actions/samples";

export function ResultsClient() {
  const { organization, isLoaded } = useOrganization();
  const [samples, setSamples] = useState<SampleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadSamples() {
      if (!isLoaded || !organization) {
        setLoading(false);
        return;
      }

      try {
        const result = await listAllSamples();
        if (result.success && result.data) {
          // Only show samples with features
          setSamples(result.data.filter((s) => s.hasFeatures));
        } else {
          setError(result.error || "Failed to load samples");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    loadSamples();
  }, [organization, isLoaded]);

  const filteredSamples = samples.filter((s) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      s.sampleLabel?.toLowerCase().includes(query) ||
      s.patientPseudonym?.toLowerCase().includes(query) ||
      s.experimentName.toLowerCase().includes(query)
    );
  });

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: "Results" }]} />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Organization Selected</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              Please select an organization from the dropdown in the header to view results.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Results" }]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Results</h1>
          <p className="text-muted-foreground">
            View and analyze computed features from processed samples
          </p>
        </div>
        <Button variant="outline">
          <Download className="h-4 w-4 mr-2" />
          Export All
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <FileBarChart className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Processed Samples</p>
              <p className="text-2xl font-bold">{samples.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Feature Sets</p>
              <p className="text-2xl font-bold">1</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Avg Features/Sample</p>
              <p className="text-2xl font-bold">128</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="py-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by sample label, patient ID, experiment..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Results Table */}
      <Card>
        <CardHeader>
          <CardTitle>Computed Features</CardTitle>
          <CardDescription>
            {filteredSamples.length} sample{filteredSamples.length !== 1 ? "s" : ""} with extracted features
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-3" />
                <p className="text-destructive">{error}</p>
              </div>
            </div>
          ) : filteredSamples.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FileBarChart className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No results yet</h3>
              <p className="text-muted-foreground text-center max-w-sm mb-4">
                {samples.length === 0
                  ? "Process some samples to see their computed features here."
                  : "No samples match your search criteria."}
              </p>
              {samples.length === 0 && (
                <Link href="/samples">
                  <Button>View Samples</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sample</TableHead>
                    <TableHead>Patient ID</TableHead>
                    <TableHead>Experiment</TableHead>
                    <TableHead>Matrix Type</TableHead>
                    <TableHead>Feature Set</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSamples.map((sample) => (
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
                        <Link
                          href={`/experiments/${sample.experimentId}`}
                          className="text-primary hover:underline"
                        >
                          {sample.experimentName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {sample.matrixType ? (
                          <Badge variant="outline">{sample.matrixType}</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge>core_v1</Badge>
                      </TableCell>
                      <TableCell>
                        <Link href={`/samples/${sample.id}`}>
                          <Button variant="ghost" size="sm">
                            <Eye className="h-4 w-4 mr-2" />
                            View Features
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
    </div>
  );
}
