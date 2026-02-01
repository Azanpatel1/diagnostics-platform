"use client";

import { useOrganization } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  Loader2,
  FlaskConical,
  Search,
  AlertCircle,
  Calendar,
  TestTubes,
  Filter,
  MoreVertical,
  Trash2,
  Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listExperiments } from "@/actions/experiments";
import type { ExperimentWithCounts } from "@/actions/experiments";

export function ExperimentsClient() {
  const { organization, isLoaded } = useOrganization();
  const [experiments, setExperiments] = useState<ExperimentWithCounts[]>([]);
  const [filteredExperiments, setFilteredExperiments] = useState<ExperimentWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function loadExperiments() {
      if (!isLoaded) return;

      if (!organization) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const result = await listExperiments(organization.id);
        if (result.success) {
          setExperiments(result.data || []);
          setFilteredExperiments(result.data || []);
          setError(null);
        } else {
          setError(result.error || "Failed to load experiments");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    }

    loadExperiments();
  }, [organization, isLoaded]);

  useEffect(() => {
    if (!searchQuery) {
      setFilteredExperiments(experiments);
      return;
    }

    const query = searchQuery.toLowerCase();
    setFilteredExperiments(
      experiments.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          e.operator?.toLowerCase().includes(query) ||
          e.protocolVersion?.toLowerCase().includes(query)
      )
    );
  }, [searchQuery, experiments]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="space-y-6">
        <Breadcrumbs items={[{ label: "Experiments" }]} />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Organization Selected</h3>
            <p className="text-muted-foreground text-center max-w-sm">
              Please select an organization from the dropdown in the header to view experiments.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Experiments" }]} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Experiments</h1>
          <p className="text-muted-foreground">
            Manage your diagnostic experiments and samples
          </p>
        </div>
        <Link href="/experiments/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            New Experiment
          </Button>
        </Link>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
              <FlaskConical className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Experiments</p>
              <p className="text-2xl font-bold">{experiments.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-100">
              <TestTubes className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Samples</p>
              <p className="text-2xl font-bold">
                {experiments.reduce((acc, e) => acc + e.sampleCount, 0)}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <Calendar className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">This Month</p>
              <p className="text-2xl font-bold">
                {experiments.filter((e) => {
                  const created = new Date(e.createdAt);
                  const now = new Date();
                  return (
                    created.getMonth() === now.getMonth() &&
                    created.getFullYear() === now.getFullYear()
                  );
                }).length}
              </p>
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
              placeholder="Search experiments by name, operator, protocol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Experiments Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Experiments</CardTitle>
          <CardDescription>
            {filteredExperiments.length} experiment
            {filteredExperiments.length !== 1 ? "s" : ""} found
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
          ) : filteredExperiments.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <FlaskConical className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {experiments.length === 0 ? "No experiments yet" : "No results found"}
              </h3>
              <p className="text-muted-foreground text-center max-w-sm mb-4">
                {experiments.length === 0
                  ? "Create your first experiment to start collecting diagnostic data."
                  : "Try adjusting your search criteria."}
              </p>
              {experiments.length === 0 && (
                <Link href="/experiments/new">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Experiment
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Protocol</TableHead>
                    <TableHead>Operator</TableHead>
                    <TableHead className="text-center">Samples</TableHead>
                    <TableHead className="text-center">Artifacts</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredExperiments.map((experiment) => (
                    <TableRow key={experiment.id}>
                      <TableCell>
                        <Link
                          href={`/experiments/${experiment.id}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {experiment.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        {experiment.protocolVersion ? (
                          <Badge variant="outline">{experiment.protocolVersion}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {experiment.operator || (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{experiment.sampleCount}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary">{experiment.artifactsCount}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(experiment.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/experiments/${experiment.id}`}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive">
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
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
