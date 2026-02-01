import { auth, clerkClient } from "@clerk/nextjs/server";
import { db, orgs, orgMembers } from "@/db";
import { eq, and } from "drizzle-orm";

export type AuthContext = {
  clerkUserId: string;
  clerkOrgId: string;
  orgId: string;
  role: string;
};

export class AuthError extends Error {
  constructor(
    message: string,
    public code: "UNAUTHORIZED" | "NO_ORG" | "ORG_NOT_FOUND"
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/**
 * Get the current authenticated user's context including their organization.
 * This helper should be used in all server actions and API routes to ensure
 * proper multi-tenant data isolation.
 * 
 * If the organization doesn't exist in our database yet (e.g., webhooks not set up),
 * it will be created on-demand.
 *
 * @throws {AuthError} If user is not authenticated or has no organization selected
 * @returns {Promise<AuthContext>} The authenticated user's context
 */
export async function getAuthContext(): Promise<AuthContext> {
  const { userId, orgId: clerkOrgId, orgRole, orgSlug } = await auth();

  if (!userId) {
    throw new AuthError("Not authenticated", "UNAUTHORIZED");
  }

  if (!clerkOrgId) {
    throw new AuthError(
      "No organization selected. Please select or create an organization.",
      "NO_ORG"
    );
  }

  // Look up the internal org ID from the Clerk org ID
  let org = await db.query.orgs.findFirst({
    where: eq(orgs.clerkOrgId, clerkOrgId),
  });

  // If org doesn't exist in our DB, create it on-demand (for local dev without webhooks)
  if (!org) {
    console.log(`Org not found in DB for clerkOrgId: ${clerkOrgId}, creating...`);
    try {
      // Fetch org details from Clerk
      const client = await clerkClient();
      console.log("Got Clerk client, fetching org...");
      const clerkOrg = await client.organizations.getOrganization({
        organizationId: clerkOrgId,
      });
      console.log(`Fetched Clerk org: ${clerkOrg.name}`);

      // Create the org in our database
      const [newOrg] = await db
        .insert(orgs)
        .values({
          clerkOrgId: clerkOrgId,
          name: clerkOrg.name,
        })
        .returning();

      org = newOrg;
      console.log(`Auto-created org in DB: ${clerkOrg.name} (${clerkOrgId}) -> ${org.id}`);
    } catch (error) {
      console.error("Failed to auto-create org:", error);
      throw new AuthError(
        "Organization not found. Please try again or contact support.",
        "ORG_NOT_FOUND"
      );
    }
  }

  // Get or create the user's membership in this org
  let membership = await db.query.orgMembers.findFirst({
    where: and(
      eq(orgMembers.orgId, org.id),
      eq(orgMembers.clerkUserId, userId)
    ),
  });

  // If membership doesn't exist, create it on-demand
  if (!membership) {
    try {
      await db.insert(orgMembers).values({
        orgId: org.id,
        clerkUserId: userId,
        role: orgRole || "member",
      });
      console.log(`Auto-created membership for user ${userId} in org ${org.id}`);
      
      membership = {
        orgId: org.id,
        clerkUserId: userId,
        role: orgRole || "member",
        createdAt: new Date(),
      };
    } catch (error) {
      // Membership might already exist (race condition), that's fine
      console.log("Membership may already exist:", error);
    }
  }

  return {
    clerkUserId: userId,
    clerkOrgId: clerkOrgId,
    orgId: org.id,
    role: membership?.role || orgRole || "member",
  };
}

/**
 * Get auth context with a client-provided orgId fallback
 * Use this when the server-side auth() doesn't have the orgId but client does
 */
export async function getAuthContextWithOrgId(clientOrgId: string): Promise<AuthContext> {
  const { userId, orgId: clerkOrgId, orgRole } = await auth();

  if (!userId) {
    throw new AuthError("Not authenticated", "UNAUTHORIZED");
  }

  // Use server orgId if available, otherwise use client-provided one
  const effectiveOrgId = clerkOrgId || clientOrgId;

  if (!effectiveOrgId) {
    throw new AuthError(
      "No organization selected. Please select or create an organization.",
      "NO_ORG"
    );
  }

  // Look up the internal org ID from the Clerk org ID
  let org = await db.query.orgs.findFirst({
    where: eq(orgs.clerkOrgId, effectiveOrgId),
  });

  // If org doesn't exist in our DB, create it on-demand
  if (!org) {
    console.log(`Org not found in DB for clerkOrgId: ${effectiveOrgId}, creating...`);
    try {
      const client = await clerkClient();
      const clerkOrg = await client.organizations.getOrganization({
        organizationId: effectiveOrgId,
      });

      const [newOrg] = await db
        .insert(orgs)
        .values({
          clerkOrgId: effectiveOrgId,
          name: clerkOrg.name,
        })
        .returning();

      org = newOrg;
      console.log(`Auto-created org in DB: ${clerkOrg.name} (${effectiveOrgId}) -> ${org.id}`);
    } catch (error) {
      console.error("Failed to auto-create org:", error);
      throw new AuthError(
        "Organization not found. Please try again or contact support.",
        "ORG_NOT_FOUND"
      );
    }
  }

  // Get or create the user's membership
  let membership = await db.query.orgMembers.findFirst({
    where: and(
      eq(orgMembers.orgId, org.id),
      eq(orgMembers.clerkUserId, userId)
    ),
  });

  if (!membership) {
    try {
      await db.insert(orgMembers).values({
        orgId: org.id,
        clerkUserId: userId,
        role: orgRole || "member",
      });
      
      membership = {
        orgId: org.id,
        clerkUserId: userId,
        role: orgRole || "member",
        createdAt: new Date(),
      };
    } catch (error) {
      console.log("Membership may already exist:", error);
    }
  }

  return {
    clerkUserId: userId,
    clerkOrgId: effectiveOrgId,
    orgId: org.id,
    role: membership?.role || orgRole || "member",
  };
}

/**
 * Check if the current user is authenticated (without requiring an org)
 * Useful for routes where org selection is optional
 */
export async function getOptionalAuthContext(): Promise<{
  clerkUserId: string;
  clerkOrgId?: string;
  orgId?: string;
  role?: string;
} | null> {
  const { userId, orgId: clerkOrgId, orgRole } = await auth();

  if (!userId) {
    return null;
  }

  if (!clerkOrgId) {
    return { clerkUserId: userId };
  }

  const org = await db.query.orgs.findFirst({
    where: eq(orgs.clerkOrgId, clerkOrgId),
  });

  if (!org) {
    return { clerkUserId: userId, clerkOrgId };
  }

  const membership = await db.query.orgMembers.findFirst({
    where: and(
      eq(orgMembers.orgId, org.id),
      eq(orgMembers.clerkUserId, userId)
    ),
  });

  return {
    clerkUserId: userId,
    clerkOrgId,
    orgId: org.id,
    role: membership?.role || orgRole || "member",
  };
}
