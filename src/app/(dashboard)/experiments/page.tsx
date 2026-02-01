import { ExperimentsClient } from "@/components/experiments/experiments-client";

// Force dynamic rendering
export const dynamic = "force-dynamic";

export default function ExperimentsPage() {
  return <ExperimentsClient />;
}
