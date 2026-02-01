"use client";

import { useEffect, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import {
  Activity,
  Search,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Filter,
  Play,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { listAllJobs, type JobWithDetails } from "@/actions/jobs";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<string, { icon: typeof Clock; color: string; label: string; bgColor: string }> = {
  queued: { icon: Clock, color: "text-yellow-600", label: "Queued", bgColor: "bg-yellow-100" },
  running: { icon: Play, color: "text-blue-600", label: "Running", bgColor: "bg-blue-100" },
  succeeded: { icon: CheckCircle2, color: "text-green-600", label: "Succeeded", bgColor: "bg-green-100" },
  failed: { icon: XCircle, color: "text-red-600", label: "Failed", bgColor: "bg-red-100" },
};

export function JobsListClient() {
  const { organization, isLoaded } = useOrganization();
  const [jobs, setJobs] = useState<JobWithDetails[]>([]);
  const [filteredJobs, setFilteredJobs] = useState<JobWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedJob, setExpandedJob] = useState<string | null>(null);

  const loadJobs = async () => {
    if (!organization) return;

    try {
      setLoading(true);
      const result = await listAllJobs();
      if (result.success && result.data) {
        setJobs(result.data);
        setFilteredJobs(result.data);
      } else {
        setError(result.error || "Failed to load jobs");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoaded && organization) {
      loadJobs();
    } else if (isLoaded) {
      setLoading(false);
    }
  }, [organization, isLoaded]);

  useEffect(() => {
    let filtered = jobs;

    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (j) =>
          j.artifactFileName?.toLowerCase().includes(query) ||
          j.sampleLabel?.toLowerCase().includes(query) ||
          j.type.toLowerCase().includes(query) ||
          j.id.toLowerCase().includes(query)
      );
    }

    // Apply status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((j) => j.status === statusFilter);
    }

    setFilteredJobs(filtered);
  }, [searchQuery, statusFilter, jobs]);

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
        <Breadcrumbs items={[{ label: "Processing" }]} />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Organization Selected</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              Please select an organization from the dropdown in the header to view processing jobs.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calculate stats
  const stats = {
    total: jobs.length,
    queued: jobs.filter((j) => j.status === "queued").length,
    running: jobs.filter((j) => j.status === "running").length,
    succeeded: jobs.filter((j) => j.status === "succeeded").length,
    failed: jobs.filter((j) => j.status === "failed").length,
  };

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Processing" }]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Processing Queue</h1>
          <p className="text-muted-foreground">
            Monitor feature extraction jobs and processing status
          </p>
        </div>
        <Button onClick={loadJobs} variant="outline" disabled={loading}>
          <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
              <Clock className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Queued</p>
              <p className="text-2xl font-bold">{stats.queued}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100">
              <Play className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Running</p>
              <p className="text-2xl font-bold">{stats.running}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Succeeded</p>
              <p className="text-2xl font-bold">{stats.succeeded}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <XCircle className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Failed</p>
              <p className="text-2xl font-bold">{stats.failed}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search by file name, sample, job ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Jobs</SelectItem>
                <SelectItem value="queued">Queued</SelectItem>
                <SelectItem value="running">Running</SelectItem>
                <SelectItem value="succeeded">Succeeded</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Job History</CardTitle>
          <CardDescription>
            {filteredJobs.length} job{filteredJobs.length !== 1 ? "s" : ""} found
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
          ) : filteredJobs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No jobs found</h3>
              <p className="text-muted-foreground text-center max-w-sm">
                {jobs.length === 0
                  ? "Feature extraction jobs will appear here when you process artifacts."
                  : "Try adjusting your search or filter criteria."}
              </p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Job ID</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>File</TableHead>
                    <TableHead>Sample</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredJobs.map((job) => {
                    const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.queued;
                    const StatusIcon = config.icon;
                    const isExpanded = expandedJob === job.id;
                    const duration = job.updatedAt && job.createdAt
                      ? Math.round((new Date(job.updatedAt).getTime() - new Date(job.createdAt).getTime()) / 1000)
                      : null;

                    return (
                      <Collapsible key={job.id} open={isExpanded} onOpenChange={(open) => setExpandedJob(open ? job.id : null)}>
                        <TableRow className={isExpanded ? "border-b-0" : ""}>
                          <TableCell className="font-mono text-xs">
                            {job.id.slice(0, 8)}...
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{job.type}</Badge>
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate">
                            {job.artifactFileName || "—"}
                          </TableCell>
                          <TableCell>
                            {job.sampleLabel || "—"}
                          </TableCell>
                          <TableCell>
                            <Badge className={cn(config.bgColor, config.color, "hover:" + config.bgColor)}>
                              <StatusIcon className={cn("h-3 w-3 mr-1", job.status === "running" && "animate-spin")} />
                              {config.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {formatDateTime(job.createdAt)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {duration !== null ? `${duration}s` : "—"}
                          </TableCell>
                          <TableCell>
                            <CollapsibleTrigger asChild>
                              <Button variant="ghost" size="sm">
                                {isExpanded ? "Hide" : "Details"}
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow>
                            <TableCell colSpan={8} className="bg-muted/30">
                              <div className="p-4 space-y-4">
                                {job.error && (
                                  <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                                    <p className="text-sm font-medium text-red-800 mb-1">Error</p>
                                    <p className="text-sm text-red-700 font-mono whitespace-pre-wrap">
                                      {job.error}
                                    </p>
                                  </div>
                                )}
                                {job.output && (
                                  <div>
                                    <p className="text-sm font-medium mb-2">Output</p>
                                    <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                                      {JSON.stringify(job.output, null, 2)}
                                    </pre>
                                  </div>
                                )}
                                {job.input && (
                                  <div>
                                    <p className="text-sm font-medium mb-2">Input</p>
                                    <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto">
                                      {JSON.stringify(job.input, null, 2)}
                                    </pre>
                                  </div>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
