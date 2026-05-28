import { MachineDetailPageClient } from "@/components/machine-detail-page";
import { defaultLocale, isLocale } from "@/i18n/routing";

type MachineDetailPageProps = {
  params: Promise<{
    locale: string;
    machineId: string;
  }>;
};

export default async function MachineDetailPage({ params }: MachineDetailPageProps) {
  const { locale, machineId } = await params;
  return <MachineDetailPageClient locale={isLocale(locale) ? locale : defaultLocale} machineId={machineId} />;
}
