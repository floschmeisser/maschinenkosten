import { SettingsPanel } from "@/components/shared-ui-components";
import { isLocale } from "@/i18n/routing";

type SettingsPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function SettingsPage({ params }: SettingsPageProps) {
  const { locale: localeParam } = await params;
  const locale = isLocale(localeParam) ? localeParam : "de";

  return (
    <main className="page">
      <section className="page-header">
        <h1>Einstellungen</h1>
      </section>
      <SettingsPanel locale={locale} />
    </main>
  );
}
