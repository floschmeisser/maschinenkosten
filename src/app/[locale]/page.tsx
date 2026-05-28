import { Dashboard } from "@/components/dashboard";
import { isLocale } from "@/i18n/routing";

type HomePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function HomePage({ params }: HomePageProps) {
  const { locale: localeParam } = await params;
  const locale = isLocale(localeParam) ? localeParam : "de";

  return <Dashboard locale={locale} />;
}
