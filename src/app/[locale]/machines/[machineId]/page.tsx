import { notFound } from "next/navigation";
import { MachineDetail } from "@/components/machine-management";
import { getMachineById } from "@/lib/app/machines";

type MachineDetailPageProps = {
  params: Promise<{
    machineId: string;
  }>;
};

export default async function MachineDetailPage({ params }: MachineDetailPageProps) {
  const { machineId } = await params;
  const machine = getMachineById(machineId);

  if (!machine) {
    notFound();
  }

  return <MachineDetail machine={machine} />;
}
