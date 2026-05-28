import { MachineDetailPageClient } from "@/components/machine-detail-page";

type MachineDetailPageProps = {
  params: Promise<{
    machineId: string;
  }>;
};

export default async function MachineDetailPage({ params }: MachineDetailPageProps) {
  const { machineId } = await params;
  return <MachineDetailPageClient machineId={machineId} />;
}
