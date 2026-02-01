"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { createExperiment } from "@/actions/experiments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function ExperimentForm() {
  const router = useRouter();
  const { toast } = useToast();
  const { organization } = useOrganization();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    
    if (!organization?.id) {
      toast({
        title: "Error",
        description: "Please select an organization first.",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoading(true);

    const formData = new FormData(event.currentTarget);
    const data = {
      name: formData.get("name") as string,
      protocolVersion: formData.get("protocolVersion") as string,
      instrumentId: formData.get("instrumentId") as string,
      operator: formData.get("operator") as string,
      notes: formData.get("notes") as string,
      startedAt: formData.get("startedAt") as string,
    };

    // Pass the client-side orgId to work around Clerk session sync issues
    const result = await createExperiment(data, organization.id);

    if (result.success && result.data) {
      toast({
        title: "Experiment created",
        description: "Your experiment has been created successfully.",
      });
      router.push(`/experiments/${result.data.id}`);
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to create experiment",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card>
        <CardContent className="space-y-4 pt-6">
          <div className="space-y-2">
            <Label htmlFor="name">Experiment Name *</Label>
            <Input
              id="name"
              name="name"
              placeholder="e.g., Blood Panel Analysis Q1"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="protocolVersion">Protocol Version</Label>
              <Input
                id="protocolVersion"
                name="protocolVersion"
                placeholder="e.g., v2.1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instrumentId">Instrument ID</Label>
              <Input
                id="instrumentId"
                name="instrumentId"
                placeholder="e.g., HPLC-001"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="operator">Operator</Label>
              <Input
                id="operator"
                name="operator"
                placeholder="e.g., Dr. Smith"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="startedAt">Start Date</Label>
              <Input id="startedAt" name="startedAt" type="datetime-local" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              name="notes"
              placeholder="Any additional notes about this experiment..."
              rows={4}
            />
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create Experiment
          </Button>
        </CardFooter>
      </Card>
    </form>
  );
}
