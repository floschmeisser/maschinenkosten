import { LoginPanel } from "@/components/shared-ui-components";
import { isLocale } from "@/i18n/routing";

type LoginPageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function LoginPage({ params }: LoginPageProps) {
  const { locale: localeParam } = await params;
  const locale = isLocale(localeParam) ? localeParam : "de";

  return (
    <main className="page">
      <section className="page-header">
        <h1>Einloggen</h1>
      </section>
      <LoginPanel locale={locale} />
    </main>
  );
}
