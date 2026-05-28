import { MaintenanceManagement } from "@/components/maintenance-management";
import { isLocale } from "@/i18n/routing";

type MaintenancePageProps = {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<{
    filter?: string;
    taskId?: string;
  }>;
};

export default async function MaintenancePage({ params, searchParams }: MaintenancePageProps) {
  const { locale: localeParam } = await params;
  const query = await searchParams;
  const locale = isLocale(localeParam) ? localeParam : "de";

  return <MaintenanceManagement initialFilter={query?.filter} initialFocusedTaskId={query?.taskId} locale={locale} />;
}
