import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { LandingPageSwitcher } from "@/components/landing/landing-page-switcher";

export default async function HomePage() {
  const { userId } = await auth();

  // If user is logged in, redirect to dashboard
  if (userId) {
    redirect("/dashboard");
  }

  return <LandingPageSwitcher />;
}
