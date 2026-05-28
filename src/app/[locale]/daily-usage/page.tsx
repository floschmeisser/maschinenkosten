import { DailyUsageEntry } from "@/components/daily-usage-entry";
import { isLocale } from "@/i18n/routing";

type DailyUsagePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function DailyUsagePage({ params }: DailyUsagePageProps) {
  const { locale: localeParam } = await params;
  const locale = isLocale(localeParam) ? localeParam : "de";

  return <DailyUsageEntry locale={locale} />;
}
