"use client";

import { useEffect, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import Link from "next/link";
import {
  TestTubes,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileUp,
  Filter,
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

export function SamplesListClient() {
  const { organization, isLoaded } = useOrganization();
  const [samples, setSamples] = useState<SampleWithDetails[]>([]);
  const [filteredSamples, setFilteredSamples] = useState<SampleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "processed" | "pending">("all");

  useEffect(() => {
    async function loadSamples() {
      if (!isLoaded || !organization) {
        setLoading(false);
        return;
      }

      try {
        const result = await listAllSamples();
        if (result.success && result.data) {
          setSamples(result.data);
          setFilteredSamples(result.data);
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

  useEffect(() => {
    let filtered = samples;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.sampleLabel?.toLowerCase().includes(query) ||
          s.patientPseudonym?.toLowerCase().includes(query) ||
          s.experimentName.toLowerCase().includes(query) ||
          s.matrixType?.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter === "processed") {
      filtered = filtered.filter((s) => s.hasFeatures);
    } else if (statusFilter === "pending") {
      filtered = filtered.filter((s) => !s.hasFeatures);
    }

    setFilteredSamples(filtered);
  }, [searchQuery, statusFilter, samples]);

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
        <Breadcrumbs items={[{ label: "Samples" }]} />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Organization Selected</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              Please select an organization from the dropdown in the header to view samples.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Samples" }]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Samples</h1>
          <p className="text-muted-foreground">
            View and manage all collected samples across experiments
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by label, patient ID, experiment..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={(v: "all" | "processed" | "pending") => setStatusFilter(v)}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Samples</SelectItem>
                <SelectItem value="processed">Processed</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Samples Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Samples</CardTitle>
          <CardDescription>
            {filteredSamples.length} sample{filteredSamples.length !== 1 ? "s" : ""} found
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
              <TestTubes className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No samples found</h3>
              <p className="text-muted-foreground text-center max-w-sm mb-4">
                {samples.length === 0
                  ? "Create an experiment and add samples to get started."
                  : "Try adjusting your search or filter criteria."}
              </p>
              {samples.length === 0 && (
                <Link href="/experiments/new">
                  <Button>Create Experiment</Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Sample Label</TableHead>
                    <TableHead>Patient ID</TableHead>
                    <TableHead>Matrix Type</TableHead>
                    <TableHead>Experiment</TableHead>
                    <TableHead className="text-center">Files</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead>Collected</TableHead>
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
                        {sample.matrixType ? (
                          <Badge variant="outline">{sample.matrixType}</Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/experiments/${sample.experimentId}`}
                          className="text-primary hover:underline"
                        >
                          {sample.experimentName}
                        </Link>
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <FileUp className="h-4 w-4 text-muted-foreground" />
                          <span>{sample.artifactsCount}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        {sample.hasFeatures ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Processed
                          </Badge>
                        ) : (
                          <Badge variant="secondary">
                            Pending
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {sample.collectedAt
                          ? new Date(sample.collectedAt).toLocaleDateString()
                          : "—"}
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
    </div>
  );
}
