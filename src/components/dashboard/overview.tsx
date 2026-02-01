"use client";

import { useEffect, useState } from "react";
import { useOrganization } from "@clerk/nextjs";
import Link from "next/link";
import {
  FlaskConical,
  TestTubes,
  FileUp,
  Activity,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  ArrowRight,
  Loader2,
  TrendingUp,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/layout/breadcrumbs";
import {
  getDashboardStats,
  getRecentActivity,
  getRecentExperiments,
  type DashboardStats,
  type RecentActivity,
} from "@/actions/dashboard";
import { cn } from "@/lib/utils";

export function DashboardOverview() {
  const { organization, isLoaded } = useOrganization();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [activity, setActivity] = useState<RecentActivity[]>([]);
  const [recentExperiments, setRecentExperiments] = useState<Array<{
    id: string;
    name: string;
    samplesCount: number;
    createdAt: Date;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      if (!isLoaded || !organization) {
        setLoading(false);
        return;
      }

      try {
        const [statsResult, activityResult, experimentsResult] = await Promise.all([
          getDashboardStats(),
          getRecentActivity(),
          getRecentExperiments(),
        ]);

        if (statsResult.success && statsResult.data) {
          setStats(statsResult.data);
        }
        if (activityResult.success && activityResult.data) {
          setActivity(activityResult.data);
        }
        if (experimentsResult.success && experimentsResult.data) {
          setRecentExperiments(experimentsResult.data);
        }
      } catch (error) {
        console.error("Error loading dashboard data:", error);
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [organization, isLoaded]);

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
        <Breadcrumbs items={[{ label: "Overview" }]} />
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Organization Selected</h3>
            <p className="text-muted-foreground text-center max-w-sm mb-4">
              Please select an organization from the dropdown in the header to view your dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Overview" }]} />

      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            Welcome back
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening with {organization.name} today.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/experiments/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Experiment
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Cards */}
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-20 animate-pulse bg-muted rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Experiments
              </CardTitle>
              <FlaskConical className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalExperiments}</div>
              <p className="text-xs text-muted-foreground">
                Active diagnostic studies
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Samples
              </CardTitle>
              <TestTubes className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalSamples}</div>
              <p className="text-xs text-muted-foreground">
                Collected patient samples
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Raw Artifacts
              </CardTitle>
              <FileUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalArtifacts}</div>
              <p className="text-xs text-muted-foreground">
                Uploaded data files
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Processed
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.processedSamples}</div>
              <p className="text-xs text-muted-foreground">
                Features extracted
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Job Status Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100">
                <Clock className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Pending Jobs</p>
                <p className="text-2xl font-bold">{stats.pendingJobs}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
                <CheckCircle2 className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Completed Jobs</p>
                <p className="text-2xl font-bold">{stats.completedJobs}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-4 p-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Failed Jobs</p>
                <p className="text-2xl font-bold">{stats.failedJobs}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Grid */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent Experiments */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent Experiments</CardTitle>
              <CardDescription>Your latest diagnostic studies</CardDescription>
            </div>
            <Link href="/experiments">
              <Button variant="ghost" size="sm">
                View all
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-16 animate-pulse bg-muted rounded" />
                ))}
              </div>
            ) : recentExperiments.length === 0 ? (
              <div className="text-center py-8">
                <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground mb-4">No experiments yet</p>
                <Link href="/experiments/new">
                  <Button size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Create your first experiment
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {recentExperiments.map((exp) => (
                  <Link
                    key={exp.id}
                    href={`/experiments/${exp.id}`}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                        <FlaskConical className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{exp.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {exp.samplesCount} sample{exp.samplesCount !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {formatRelativeTime(exp.createdAt)}
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates across your organization</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-12 animate-pulse bg-muted rounded" />
                ))}
              </div>
            ) : activity.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-4">
                {activity.map((item) => (
                  <div
                    key={`${item.type}-${item.id}`}
                    className="flex items-start gap-3"
                  >
                    <div
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-full",
                        item.type === "experiment" && "bg-blue-100",
                        item.type === "sample" && "bg-purple-100",
                        item.type === "artifact" && "bg-orange-100",
                        item.type === "job" && "bg-green-100"
                      )}
                    >
                      {item.type === "experiment" && (
                        <FlaskConical className="h-4 w-4 text-blue-600" />
                      )}
                      {item.type === "sample" && (
                        <TestTubes className="h-4 w-4 text-purple-600" />
                      )}
                      {item.type === "artifact" && (
                        <FileUp className="h-4 w-4 text-orange-600" />
                      )}
                      {item.type === "job" && (
                        <Activity className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{item.title}</p>
                        {item.status && (
                          <Badge
                            variant={
                              item.status === "succeeded"
                                ? "default"
                                : item.status === "failed"
                                ? "destructive"
                                : "secondary"
                            }
                            className="text-xs"
                          >
                            {item.status}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate">
                        {item.description}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatRelativeTime(item.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks to get started</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <Link href="/experiments/new">
              <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <FlaskConical className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <p className="font-medium">New Experiment</p>
                  <p className="text-sm text-muted-foreground">
                    Start a new diagnostic study
                  </p>
                </div>
              </div>
            </Link>
            <Link href="/samples">
              <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-purple-100">
                  <TestTubes className="h-6 w-6 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium">View Samples</p>
                  <p className="text-sm text-muted-foreground">
                    Browse all collected samples
                  </p>
                </div>
              </div>
            </Link>
            <Link href="/jobs">
              <div className="flex items-center gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="font-medium">Processing Queue</p>
                  <p className="text-sm text-muted-foreground">
                    Monitor feature extraction jobs
                  </p>
                </div>
              </div>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

  if (diffInSeconds < 60) return "just now";
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return new Date(date).toLocaleDateString();
}
