import { MachineManagement } from "@/components/machine-management";
import { isLocale } from "@/i18n/routing";

type MachinesPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function MachinesPage({ params }: MachinesPageProps) {
  const { locale: localeParam } = await params;
  const locale = isLocale(localeParam) ? localeParam : "de";

  return <MachineManagement locale={locale} />;
}
