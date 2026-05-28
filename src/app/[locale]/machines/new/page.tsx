import { NewMachinePageClient } from "@/components/new-machine-page";
import { isLocale } from "@/i18n/routing";

type NewMachinePageProps = {
  params: Promise<{
    locale: string;
  }>;
};

export default async function NewMachinePage({ params }: NewMachinePageProps) {
  const { locale: localeParam } = await params;
  const locale = isLocale(localeParam) ? localeParam : "de";

  return (
    <main className="page">
      <section className="page-header">
        <h1>Neue Maschine</h1>
        <p>Erfasse die wichtigsten Grunddaten. Danach erscheint die Maschine in der Liste.</p>
      </section>
      <NewMachinePageClient locale={locale} />
    </main>
  );
}
