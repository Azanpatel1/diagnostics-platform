import { Webhook } from "svix";
import { headers } from "next/headers";
import { WebhookEvent } from "@clerk/nextjs/server";
import { db, orgs, orgMembers } from "@/db";
import { eq, and } from "drizzle-orm";

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error(
      "Please add CLERK_WEBHOOK_SECRET from Clerk Dashboard to .env"
    );
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response("Error occurred -- no svix headers", {
      status: 400,
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your secret.
  const wh = new Webhook(WEBHOOK_SECRET);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error("Error verifying webhook:", err);
    return new Response("Error occurred", {
      status: 400,
    });
  }

  const eventType = evt.type;

  try {
    switch (eventType) {
      // Organization events
      case "organization.created": {
        const { id, name } = evt.data;
        await db.insert(orgs).values({
          clerkOrgId: id,
          name: name,
        });
        console.log(`Organization created: ${name} (${id})`);
        break;
      }

      case "organization.updated": {
        const { id, name } = evt.data;
        await db
          .update(orgs)
          .set({ name: name })
          .where(eq(orgs.clerkOrgId, id));
        console.log(`Organization updated: ${name} (${id})`);
        break;
      }

      case "organization.deleted": {
        const { id } = evt.data;
        if (id) {
          await db.delete(orgs).where(eq(orgs.clerkOrgId, id));
          console.log(`Organization deleted: ${id}`);
        }
        break;
      }

      // Organization membership events
      case "organizationMembership.created": {
        const { organization, public_user_data, role } = evt.data;
        const clerkOrgId = organization.id;
        const clerkUserId = public_user_data.user_id;

        // Find our internal org
        const org = await db.query.orgs.findFirst({
          where: eq(orgs.clerkOrgId, clerkOrgId),
        });

        if (org) {
          await db.insert(orgMembers).values({
            orgId: org.id,
            clerkUserId: clerkUserId,
            role: mapClerkRole(role),
          });
          console.log(`Member added to org ${clerkOrgId}: ${clerkUserId}`);
        }
        break;
      }

      case "organizationMembership.updated": {
        const { organization, public_user_data, role } = evt.data;
        const clerkOrgId = organization.id;
        const clerkUserId = public_user_data.user_id;

        const org = await db.query.orgs.findFirst({
          where: eq(orgs.clerkOrgId, clerkOrgId),
        });

        if (org) {
          await db
            .update(orgMembers)
            .set({ role: mapClerkRole(role) })
            .where(
              and(
                eq(orgMembers.orgId, org.id),
                eq(orgMembers.clerkUserId, clerkUserId)
              )
            );
          console.log(`Member role updated in org ${clerkOrgId}: ${clerkUserId}`);
        }
        break;
      }

      case "organizationMembership.deleted": {
        const { organization, public_user_data } = evt.data;
        const clerkOrgId = organization.id;
        const clerkUserId = public_user_data.user_id;

        const org = await db.query.orgs.findFirst({
          where: eq(orgs.clerkOrgId, clerkOrgId),
        });

        if (org) {
          await db
            .delete(orgMembers)
            .where(
              and(
                eq(orgMembers.orgId, org.id),
                eq(orgMembers.clerkUserId, clerkUserId)
              )
            );
          console.log(`Member removed from org ${clerkOrgId}: ${clerkUserId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }
  } catch (error) {
    console.error(`Error processing webhook ${eventType}:`, error);
    return new Response("Error processing webhook", { status: 500 });
  }

  return new Response("", { status: 200 });
}

function mapClerkRole(clerkRole: string): string {
  // Map Clerk's role names to our internal role names
  switch (clerkRole) {
    case "org:admin":
      return "admin";
    case "org:member":
      return "member";
    default:
      // Check if it's a custom role or owner
      if (clerkRole.includes("admin")) return "admin";
      if (clerkRole.includes("owner")) return "owner";
      return "member";
  }
}
