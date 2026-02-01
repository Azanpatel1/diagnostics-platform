"use client";

import { useOrganizationList, useOrganization } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Plus, Loader2 } from "lucide-react";

export function OrgSelector() {
  const router = useRouter();
  const { organization, isLoaded: isOrgLoaded } = useOrganization();
  const { 
    isLoaded, 
    setActive, 
    userMemberships,
    createOrganization 
  } = useOrganizationList({
    userMemberships: {
      infinite: true,
    },
  });

  // If org is already selected, redirect to experiments
  useEffect(() => {
    if (isOrgLoaded && organization) {
      console.log("[OrgSelector] Organization already active:", organization.name);
      router.refresh();
    }
  }, [isOrgLoaded, organization, router]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleSelectOrg = async (orgId: string) => {
    console.log("[OrgSelector] Selecting org:", orgId);
    try {
      await setActive({ organization: orgId });
      console.log("[OrgSelector] Org set active, refreshing...");
      // Force a hard refresh to get new session data
      window.location.href = "/experiments";
    } catch (error) {
      console.error("[OrgSelector] Error selecting org:", error);
    }
  };

  const handleCreateOrg = async () => {
    const name = prompt("Enter organization name:");
    if (name) {
      try {
        const org = await createOrganization({ name });
        console.log("[OrgSelector] Created org:", org.name);
        await setActive({ organization: org.id });
        window.location.href = "/experiments";
      } catch (error) {
        console.error("[OrgSelector] Error creating org:", error);
      }
    }
  };

  const memberships = userMemberships?.data || [];

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-center">Choose an Organization</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {memberships.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            You don&apos;t have any organizations yet.
          </p>
        ) : (
          memberships.map((membership) => (
            <Button
              key={membership.organization.id}
              variant="outline"
              className="w-full justify-start gap-3 h-14"
              onClick={() => handleSelectOrg(membership.organization.id)}
            >
              <Building2 className="h-5 w-5 text-primary" />
              <span className="font-medium">{membership.organization.name}</span>
            </Button>
          ))
        )}
        
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 h-14 text-muted-foreground"
          onClick={handleCreateOrg}
        >
          <Plus className="h-5 w-5" />
          <span>Create new organization</span>
        </Button>
      </CardContent>
    </Card>
  );
}
