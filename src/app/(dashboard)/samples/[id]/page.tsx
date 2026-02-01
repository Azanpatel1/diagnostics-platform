import { notFound } from "next/navigation";
import { getSample } from "@/actions/samples";
import { SampleDetail } from "@/components/samples/sample-detail";

interface SamplePageProps {
  params: Promise<{ id: string }>;
}

export default async function SamplePage({ params }: SamplePageProps) {
  const { id } = await params;
  const result = await getSample(id);

  if (!result.success || !result.data) {
    notFound();
  }

  return <SampleDetail sample={result.data} />;
}
