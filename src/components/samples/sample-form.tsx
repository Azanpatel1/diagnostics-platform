"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useOrganization } from "@clerk/nextjs";
import { createSample } from "@/actions/samples";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

interface SampleFormProps {
  experimentId: string;
  onSuccess?: () => void;
}

export function SampleForm({ experimentId, onSuccess }: SampleFormProps) {
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
    const collectedAtStr = formData.get("collectedAt") as string;
    const data = {
      experimentId,
      sampleLabel: formData.get("sampleLabel") as string,
      patientPseudonym: formData.get("patientPseudonym") as string,
      matrixType: formData.get("matrixType") as string,
      collectedAt: collectedAtStr ? new Date(collectedAtStr) : undefined,
    };

    const result = await createSample(data, organization.id);

    if (result.success) {
      toast({
        title: "Sample created",
        description: "The sample has been added successfully.",
      });
      router.refresh();
      onSuccess?.();
    } else {
      toast({
        title: "Error",
        description: result.error || "Failed to create sample",
        variant: "destructive",
      });
    }

    setIsLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="sampleLabel">Sample Label *</Label>
        <Input
          id="sampleLabel"
          name="sampleLabel"
          placeholder="e.g., S001, Patient-A-T1"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="patientPseudonym">Patient Pseudonym</Label>
        <Input
          id="patientPseudonym"
          name="patientPseudonym"
          placeholder="e.g., P-12345"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="matrixType">Matrix Type</Label>
        <Input
          id="matrixType"
          name="matrixType"
          placeholder="e.g., Blood, Serum, Urine"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="collectedAt">Collection Date</Label>
        <Input id="collectedAt" name="collectedAt" type="datetime-local" />
      </div>

      <div className="flex justify-end gap-2 pt-4">
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Add Sample
        </Button>
      </div>
    </form>
  );
}
