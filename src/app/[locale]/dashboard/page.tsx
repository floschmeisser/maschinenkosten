import { Dashboard } from "@/components/dashboard";
import { isLocale } from "@/i18n/routing";

type DashboardPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function DashboardPage({ params }: DashboardPageProps) {
  const { locale: localeParam } = await params;
  const locale = isLocale(localeParam) ? localeParam : "de";

  return <Dashboard locale={locale} />;
}
